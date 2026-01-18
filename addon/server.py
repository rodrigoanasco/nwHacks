from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import uuid
import json
import os

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
