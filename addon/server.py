from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import uuid
import json
import os
import threading
from typing import Dict, List, Optional

from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage

app = FastAPI()

# Paths (relative to addon/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_INPUT_DIR = os.path.join(BASE_DIR, "json_inputs_test")
FBX_OUTPUT_DIR = os.path.join(BASE_DIR, "json_output_test")
CONVERTER_SCRIPT = os.path.join(BASE_DIR, "converters", "json_to_fbx.py")

os.makedirs(JSON_INPUT_DIR, exist_ok=True)
os.makedirs(FBX_OUTPUT_DIR, exist_ok=True)


class ConvertRequest(BaseModel):
    objects: list


@app.post("/convert")
def convert_json_to_fbx(payload: ConvertRequest):
    job_id = str(uuid.uuid4())

    json_path = os.path.join(JSON_INPUT_DIR, f"{job_id}.json")
    fbx_path = os.path.join(FBX_OUTPUT_DIR, f"{job_id}.fbx")

    # Save JSON
    with open(json_path, "w") as f:
        json.dump(payload.dict(), f, indent=2)
    print(payload.dict())
    # Call Blender
    cmd = [
        "blender",
        "-b",
        "-P",
        CONVERTER_SCRIPT,
        "--",
        json_path,
        fbx_path,
    ]

    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Blender conversion failed",
                "stdout": result.stdout,
                "stderr": result.stderr,
            },
        )

    return {
        "status": "success",
        "job_id": job_id,
        "json_path": json_path,
        "fbx_path": fbx_path,
    }


# Create ONE shared LLM instance
llm = ChatOllama(model="llama3.1", temperature=0)

# In-memory session store: session_id -> message history
# NOTE: it resets when server restarts.
_sessions: Dict[str, List[BaseMessage]] = {}
_sessions_lock = threading.Lock()

SYSTEM_HINT_PROMPT = (
    "You are a helpful 3D modeling tutor inside Blender.\n"
    "Goal: provide short, actionable hints that help the user progress.\n"
    "Rules:\n"
    "- Do NOT give the full solution.\n"
    "- Avoid repeating the same hint; each hint should add something new.\n"
    "- Use the provided target/user object info and actions.\n"
    "- Keep it concise (3-8 bullet points max).\n"
    "- If you already gave a similar hint, go one level deeper or suggest a different approach.\n"
)

class HintRequest(BaseModel):
    session_id: str
    prompt: str
    reset: bool = False
    max_turns_kept: int = 20  # keep last N turns of history to avoid huge context

class HintResponse(BaseModel):
    session_id: str
    hint: str
    turns_in_history: int

@app.post("/llm/hint", response_model=HintResponse)
def llm_hint(req: HintRequest):
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    with _sessions_lock:
        if req.reset or req.session_id not in _sessions:
            _sessions[req.session_id] = [SystemMessage(content=SYSTEM_HINT_PROMPT)]

        history = _sessions[req.session_id]

        # Add the new user prompt
        history.append(HumanMessage(content=req.prompt))

        # Trim old turns (keep System + last N*2 messages approx)
        # (System) + (Human/AI pairs)
        # We'll keep last (1 + 2*max_turns_kept) messages
        keep = 1 + 2 * max(1, req.max_turns_kept)
        if len(history) > keep:
            history[:] = [history[0]] + history[-(keep - 1):]

    # Call model OUTSIDE lock (avoid blocking other requests)
    try:
        ai_msg = llm.invoke(history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    # Save assistant response
    with _sessions_lock:
        _sessions[req.session_id].append(AIMessage(content=ai_msg.content))
        turns = (len(_sessions[req.session_id]) - 1) // 2  # rough count of human/ai turns

    return HintResponse(session_id=req.session_id, hint=ai_msg.content, turns_in_history=turns)
