import bpy
import bpy_extras
import os
import json
import bmesh
import blf
import textwrap
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import uuid
import json
import os
import uvicorn
import threading
import langchain
from langchain.messages import HumanMessage, SystemMessage, AIMessage
from langchain_ollama import ChatOllama
from langchain_core.output_parsers import StrOutputParser
import PIL
from PIL import Image
from io import BytesIO
import base64
from datetime import datetime, timezone
import requests
import logging


IMPORTED_OBJECT_NAME = "TARGET"
TOLERANCE = 0.1

time_sums = 0

hints_remaining = 3
submitted = False
bpy.types.Scene.submit_button_text = bpy.props.StringProperty(default="Submit")
bpy.types.Scene.llm_response = bpy.props.StringProperty(default="")
bpy.types.Scene.show_llm_in_panel = bpy.props.BoolProperty(default=False)
# Track whether an LLM response is currently being generated
bpy.types.Scene.llm_loading = bpy.props.BoolProperty(default=False)

# Globals used to communicate between the worker thread and the main thread
llm_thread_result = None
llm_thread_done = False
llm_thread_lock = threading.Lock()


def read_info_json():
    info_json_path = os.path.join(EXTRA_INFORMATION_JSON_DIR, "info.json")
    with open(info_json_path, "r") as f:
        info_data = json.load(f)
    return info_data.get("expectedCompletionTime"), info_data.get(
        "expectedNumOfActions"
    )


def get_current_timestamp():
    return datetime.now(timezone.utc).replace(tzinfo=timezone.utc).timestamp()


start_time = get_current_timestamp()


def convert_to_base64(pil_image):
    """
    Convert PIL images to Base64 encoded strings

    :param pil_image: PIL image
    :return: Re-sized Base64 string
    """

    buffered = BytesIO()
    pil_image.save(buffered, format="JPEG")  # You can change the format if needed
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return img_str


def get_screenshot_base64():
    area = None
    for current_area in bpy.context.window.screen.areas:
        if current_area.type == "VIEW_3D":
            area = current_area
            break

    if area == None:
        print("No area??")
        return ""

    region = None
    for current_region in area.regions:
        if current_region.type == "WINDOW":
            region = current_region
            break

    if region == None:
        print("No region??")
        return ""

    with bpy.context.temp_override(
        window=bpy.context.window,
        screen=bpy.context.window.screen,
        area=area,
        region=region,
        space=area.spaces[0],
    ):
        # Save screenshot to the addon directory (next to this file)
        addon_dir = os.path.dirname(__file__) + "\\images"
        out_path = os.path.join(addon_dir + "\\images", "woah.png")
        bpy.ops.screen.screenshot_area(filepath=out_path)

        base_64 = convert_to_base64(Image.open(out_path))
        return base_64


SYSTEM_PROMPT = """
You are an assistant designed to give hints to a user learning how to 3D model in Blender.

You will be given information about where the vertices of the target object are located, where
the vertices of the object the user is creating are located, and the number of vertices for
both objects. There will always be two objects.

You will also be provided with the user's list of actions up to this point, so you can ask them
to undo if you need to.

The most important thing is be concise, and give a very simple hint. DO NOT GIVE ANY MARKDOWN.

Answer in at most 2 sentences.
"""

message_history: list[SystemMessage | HumanMessage | AIMessage] = [
    SystemMessage(SYSTEM_PROMPT)
]


def prompt_func(data):
    text = data["text"]
    image = data["image"]

    image_part = {
        "type": "image_url",
        "image_url": f"data:image/jpeg;base64,{image}",
    }

    content_parts = []

    text_part = {"type": "text", "text": text}

    content_parts.append(image_part)
    content_parts.append(text_part)

    return [HumanMessage(content=content_parts)]


def send_llm_message(prompt: str, base64_image: str):
    image_part = {
        "type": "image_url",
        "image_url": f"data:image/jpeg;base64,{base64_image}",
    }
    text_part = {"type": "text", "text": prompt}

    new_msg = HumanMessage(content=[image_part, text_part])
    message_history.append(new_msg)

    llm = ChatOllama(
        model="llava",
        temperature=0,
    )

    chain = llm | StrOutputParser()

    output = chain.invoke(message_history)
    print(output)

    message_history.append(AIMessage(content=output))
    return str(output)


class LLMResponseThread:
    llm_thread_result = None
    llm_thread_done = False
    llm_thread_lock = threading.Lock()

    prompt = ""
    screenshot_b64 = ""

    def __init__(self, prompt: str, screenshot_b64: str) -> None:
        self.prompt = prompt
        self.screenshot_b64 = screenshot_b64

    # Worker will only set the module-level result flag under lock
    def _worker(self):
        global llm_thread_result, llm_thread_done
        try:
            res = send_llm_message(self.prompt, self.screenshot_b64)
        except Exception as e:
            print("LLM worker exception:", e)
            res = ""
        with llm_thread_lock:
            llm_thread_result = res
            llm_thread_done = True

    # Keep checking if the response is ready
    def _poll_timer(self):
        global llm_thread_result, llm_thread_done
        with llm_thread_lock:
            if llm_thread_done:
                res = llm_thread_result
                llm_thread_result = None
                llm_thread_done = False
                try:
                    bpy.context.scene.llm_response = res or ""
                    bpy.context.scene.llm_loading = False
                    print(f"LLM response stored: {bpy.context.scene.llm_response}")
                    for area in bpy.context.screen.areas:
                        if area.type == "VIEW_3D":
                            area.tag_redraw()
                except Exception as e:
                    print("Error updating scene in timer poll:", e)
                return None
        # Not ready yet, check again shortly
        return 0.2


def reset_viewport():
    global submitted

    if not submitted:
        return

    for obj in bpy.context.visible_objects:
        if obj.type != "MESH":
            continue
        mats = obj.data.materials
        if any(
            m and m.name in ("Match_Green", "Match_Red", "Translucent") for m in mats
        ):
            mats.clear()

    target_object = None
    for obj in bpy.context.visible_objects:
        if obj.name == IMPORTED_OBJECT_NAME:
            target_object = obj
            break
    if target_object is not None:
        target_object.display_type = "WIRE"

    # Switch 3D View shading back to Solid and redraw
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    try:
                        space.shading.type = "SOLID"
                    except Exception:
                        pass
            area.tag_redraw()

    submitted = False


class SubmitButton(bpy.types.Operator):
    """tooltip goes here"""

    bl_idname = "object.submit_operator"
    bl_label = "Submit"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT"

    def execute(self, context):
        global submitted, time_sums, start_time

        expectedCompletionTime, expectedNumOfActions = read_info_json()
        print(expectedCompletionTime)
        print(expectedNumOfActions)

        if submitted:
            reset_viewport()
            context.scene.submit_button_text = "Submit"
            start_time = get_current_timestamp()
            return {"FINISHED"}

        imported_object = None
        user_objects = []

        for obj in bpy.context.visible_objects:
            if obj.name == IMPORTED_OBJECT_NAME:
                imported_object = obj
            else:
                user_objects.append(obj)

        if imported_object is None or imported_object.type != "MESH":
            return {"CANCELLED"}

        # Switch display to solid so face materials become visible after submitting
        imported_object.display_type = "SOLID"

        imported_verts = [v.co.copy() for v in imported_object.data.vertices]
        user_verts = [
            v.co.copy()
            for u in user_objects
            if u.type == "MESH"
            for v in u.data.vertices
        ]

        if not user_verts:
            return {"CANCELLED"}

        # Mark each imported vertex as matched if any user vertex is within tolerance
        matched = [
            any((uv - iv).length <= TOLERANCE for uv in user_verts)
            for iv in imported_verts
        ]

        # Create/get simple green/red materials
        green = bpy.data.materials.get("Match_Green") or bpy.data.materials.new(
            "Match_Green"
        )
        red = bpy.data.materials.get("Match_Red") or bpy.data.materials.new("Match_Red")
        translucent = bpy.data.materials.get("Translucent") or bpy.data.materials.new(
            "Translucent"
        )

        # Create the material based on a shader graph
        def set_translucent_material_color(
            material, color_tuple, mix_factor=0.407, roughness=0.613
        ):
            material.diffuse_color = color_tuple
            material.use_nodes = True
            node_tree = material.node_tree
            nodes = node_tree.nodes
            links = node_tree.links

            nodes.clear()

            # Create nodes
            output = nodes.new(type="ShaderNodeOutputMaterial")
            output.location = (400, 0)

            mix = nodes.new(type="ShaderNodeMixShader")
            mix.location = (200, 0)
            mix.inputs["Fac"].default_value = mix_factor
            transp = nodes.new(type="ShaderNodeBsdfTransparent")
            transp.location = (0, 100)
            transp.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)

            glossy = nodes.new(type="ShaderNodeBsdfGlossy")
            glossy.location = (0, -100)
            glossy.inputs["Color"].default_value = color_tuple
            glossy.inputs["Roughness"].default_value = roughness

            links.new(transp.outputs["BSDF"], mix.inputs[1])
            links.new(glossy.outputs["BSDF"], mix.inputs[2])
            links.new(mix.outputs["Shader"], output.inputs["Surface"])

            # Ensure Eevee viewport transparency works and shadows are disabled
            try:
                material.blend_method = "BLEND"
                material.shadow_method = "NONE"
            except Exception:
                pass

        def set_principled_material_color(material, color_tuple):
            material.diffuse_color = color_tuple
            material.use_nodes = True
            node_tree = material.node_tree
            nodes = node_tree.nodes
            links = node_tree.links

            nodes.clear()

            output = nodes.new(type="ShaderNodeOutputMaterial")
            output.location = (400, 0)

            principled = nodes.new(type="ShaderNodeBsdfPrincipled")
            principled.location = (0, 0)
            # Principled BSDF uses 'Base Color'
            principled.inputs["Base Color"].default_value = color_tuple

            links.new(principled.outputs["BSDF"], output.inputs["Surface"])

        set_principled_material_color(green, (0.0, 1.0, 0.0, 1.0))
        set_principled_material_color(red, (1.0, 0.0, 0.0, 1.0))
        set_translucent_material_color(translucent, (1.0, 1.0, 1.0, 1.0))

        # Ensure two material slots on the imported mesh: 0 = green, 1 = red
        imported_objects_mats = imported_object.data.materials
        imported_objects_mats.clear()
        imported_objects_mats.append(green)
        imported_objects_mats.append(red)

        user_object_mats = user_objects[0].data.materials
        user_object_mats.clear()
        user_object_mats.append(translucent)

        mesh = user_objects[0].data
        for poly in mesh.polygons:
            poly.material_index = 0

        mesh = imported_object.data
        all_faces_ok = True
        for poly in mesh.polygons:
            # Face is green only if all its vertices are matched; otherwise red
            face_ok = all(matched[i] for i in poly.vertices)
            poly.material_index = 0 if face_ok else 1
            if not face_ok:
                all_faces_ok = False
        mesh.update()

        # Switch 3D View to Material Preview so materials are visible, then redraw
        for area in bpy.context.screen.areas:
            if area.type == "VIEW_3D":
                for space in area.spaces:
                    if space.type == "VIEW_3D":
                        space.shading.type = "MATERIAL"
                area.tag_redraw()

        # Compute elapsed time for this submit attempt
        elapsed = get_current_timestamp() - start_time

        if all_faces_ok:
            # Total time is accumulated time plus this final interval
            total_time = time_sums + elapsed
        else:
            # Add elapsed to accumulated time and continue timing
            time_sums += elapsed
            # restart interval timing from now
            start_time = get_current_timestamp()

        submitted = True
        if not all_faces_ok:
            context.scene.submit_button_text = "Try Again"

        number_of_actions = bpy.context.window_manager.operators
        if all_faces_ok:
            # Prepare an LLM prompt summarizing the submission for feedback
            prompt = f"""
          The user submitted their model for feedback.

          Here are the number of actions they took to create what is shown in the image: {number_of_actions}

          Please provide concise feedback (at most 2 sentences) about how the user can streamline the workflow for
          creating the model.
          """

            # Capture screenshot on the main thread (Blender API must not be called from worker)
            try:
                screenshot_b64 = get_screenshot_base64() or ""
            except Exception as e:
                print("Screenshot capture failed on submit:", e)
                screenshot_b64 = ""

            # Prepare scene state and redraw so the UI shows loading
            context.scene.llm_response = ""
            context.scene.llm_loading = True
            for area in bpy.context.screen.areas:
                if area.type == "VIEW_3D":
                    area.tag_redraw()

            # Start the LLM worker thread and register the poll timer
            llmResponseThread = LLMResponseThread(prompt, screenshot_b64)
            threading.Thread(target=llmResponseThread._worker, daemon=True).start()
            try:
                bpy.app.timers.register(
                    llmResponseThread._poll_timer, first_interval=0.1
                )
            except Exception as e:
                print("Failed to register poll timer on submit:", e)

        # Include timing information when the submission passed
        if all_faces_ok:
            # send total time in seconds (as a string for consistency)
            submission_info["time_seconds"] = str(total_time)
            # reset accumulated time for a fresh session
            time_sums = 0
            start_time = get_current_timestamp()

        submission_info = {
            "userId": str(123),
            "questionName": "House_1",
            "passed": str(True if all_faces_ok else False),
            "number_of_actions": str(number_of_actions),
            "time_taken": str(total_time),
        }

        post_request_data = requests.post(
            "http://localhost:3000/api/submit", json=submission_info
        )

        return {"FINISHED"}


class HintButton(bpy.types.Operator):
    """tooltip goes here"""

    bl_idname = "object.hint_operator"
    bl_label = "Hint"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT"

    def execute(self, context):
        global hints_remaining

        if hints_remaining == 0:
            return {"FINISHED"}

        # Get the information on the user object
        user_object = None
        target_object = None
        for obj in bpy.context.visible_objects:
            if obj.name == IMPORTED_OBJECT_NAME:
                target_object = obj
            else:
                user_object = obj

        if user_object is None or target_object is None:
            print("NO user object?")
            return {"FINISHED"}

        user_object_data = {
            "vertex_count": len(user_object.data.vertices),
            "vertex_coordinates": [
                f"({v.co.x}, {v.co.y}, {v.co.z})," for v in user_object.data.vertices
            ],
            "location": f"({user_object.location.x}, {user_object.location.y}, {user_object.location.z})",
        }

        target_object_data = {
            "vertex_count": len(target_object.data.vertices),
            "vertex_coordinates": [
                f"({v.co.x}, {v.co.y}, {v.co.z})," for v in target_object.data.vertices
            ],
            "location": f"({target_object.location.x}, {target_object.location.y}, {target_object.location.z})",
        }

        # Get the actions the user has taken up to this point
        actions = ""
        for operator in bpy.context.window_manager.operators:
            actions += operator.bl_idname + "\n"

        prompt = f"""
        The user is current stuck on create a 3D model. These are the actions they have taken so far:

        {actions}

        Here is some information about the object they are trying to model. Everything is given in (x, y, z) coordinates according to Blender's standards:

        {json.dumps(target_object_data)}

        Here is what the object the user has modeled so far is like:

        {json.dumps(user_object_data)}

        Please provide them with information about how they can continue on. Do not give them the answer.

        """

        # Capture screenshot on the main thread (Blender API must not be called from worker)
        try:
            screenshot_b64 = get_screenshot_base64() or ""
        except Exception as e:
            print("Screenshot capture failed:", e)
            screenshot_b64 = ""

        # Prepare scene state and redraw
        context.scene.llm_response = ""
        context.scene.llm_loading = True
        for area in bpy.context.screen.areas:
            if area.type == "VIEW_3D":
                area.tag_redraw()

        llmResponseThread = LLMResponseThread(prompt, screenshot_b64)
        threading.Thread(target=llmResponseThread._worker, daemon=True).start()
        # Register the polling timer once from the main thread
        try:
            bpy.app.timers.register(llmResponseThread._poll_timer, first_interval=0.1)
        except Exception as e:
            print("Failed to register poll timer:", e)

        hints_remaining -= 1
        return {"FINISHED"}


class LLMResponsePopup(bpy.types.Operator):
    """Toggle showing the LLM response inline in the panel."""

    bl_idname = "wm.view_llm_in_panel"
    bl_label = "View LLM Response"

    def execute(self, context):
        try:
            context.scene.show_llm_in_panel = not context.scene.show_llm_in_panel
        except Exception:
            context.scene.show_llm_in_panel = True
        # Trigger redraw
        for area in bpy.context.screen.areas:
            if area.type == "VIEW_3D":
                area.tag_redraw()
        return {"FINISHED"}


class Panel(bpy.types.Panel):
    bl_label = "Panel"
    bl_idname = "PT_SimplePanel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "NAME OF TOOL"

    def draw(self, context):
        layout = self.layout
        if layout is None:
            return
        layout.label(text=f"Hints remaining: {hints_remaining}")
        layout.operator(HintButton.bl_idname, text="Hint")

        # Show loading label while LLM generation is in progress
        if getattr(context.scene, "llm_loading", False):
            layout.label(text="Loading...")
            # continue rendering other UI elements while keeping user informed

        if context.scene.llm_response:
            layout.label(text="LLM response available")
            show = getattr(context.scene, "show_llm_in_panel", False)
            btn_text = "Hide LLM Response" if show else "View LLM Response"
            layout.operator(LLMResponsePopup.bl_idname, text=btn_text)
            # If toggled, render wrapped response inline
            if show:
                max_chars = 80
                wrapped_lines = []
                # Preserve existing paragraphs and wrap each by words
                for para in context.scene.llm_response.splitlines():
                    words = para.split()
                    if not words:
                        # blank paragraph -> blank line
                        wrapped_lines.append("")
                        continue
                    cur_words = []
                    cur_len = 0
                    for w in words:
                        wlen = len(w)
                        if cur_len == 0:
                            # start new line
                            cur_words = [w]
                            cur_len = wlen
                        elif cur_len + 1 + wlen <= max_chars:
                            # append to current line (add a space)
                            cur_words.append(w)
                            cur_len += 1 + wlen
                        else:
                            # flush current line and start new one
                            wrapped_lines.append(" ".join(cur_words))
                            cur_words = [w]
                            cur_len = wlen
                    if cur_words:
                        wrapped_lines.append(" ".join(cur_words))

                for line in wrapped_lines:
                    layout.label(text=line)
        layout.operator(
            SubmitButton.bl_idname, text=bpy.context.scene.submit_button_text
        )


classes = [Panel, HintButton, SubmitButton, LLMResponsePopup]


def register_panel():
    for ui_class in classes:
        bpy.utils.register_class(ui_class)
    for sc in bpy.data.scenes:
        sc.submit_button_text = "Submit"
        # initialize llm_response for existing scenes
        try:
            sc.llm_response = ""
        except Exception:
            pass
        try:
            sc.show_llm_in_panel = False
        except Exception:
            pass
        try:
            sc.llm_loading = False
        except Exception:
            pass


def unregister_panel():
    for ui_class in classes:
        bpy.utils.unregister_class(ui_class)


def load_model(path: str):
    print(path)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.fbx_import(filepath=path)

    for obj in bpy.context.selected_objects:
        obj.name = IMPORTED_OBJECT_NAME
        obj.display_type = "WIRE"


def draw_lengths():
    current_object = None
    for obj in bpy.context.visible_objects:
        if obj.name == IMPORTED_OBJECT_NAME:
            current_object = obj
            break
    if current_object == None or current_object.name != IMPORTED_OBJECT_NAME:
        return
    object_data = current_object.data

    region = bpy.context.region
    view_3d = bpy.context.region_data

    if region == None or view_3d == None:
        return

    b_mesh = bmesh.new()
    b_mesh.from_mesh(object_data)

    for edge in b_mesh.edges:
        vertex_one_coordinate = edge.verts[0].co
        vertex_two_coordinate = edge.verts[1].co

        length = (vertex_one_coordinate - vertex_two_coordinate).length
        midpoint = (vertex_one_coordinate + vertex_two_coordinate) / 2

        midpoint_2d = bpy_extras.view3d_utils.location_3d_to_region_2d(
            region, view_3d, midpoint
        )

        blf.position(0, midpoint_2d.x, midpoint_2d.y, 0)
        blf.draw(0, f"{length}")

    b_mesh.free()


"""
Server code
"""

app = FastAPI()

# Paths (relative to addon/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_INPUT_DIR = os.path.join(BASE_DIR, "json_inputs_test")
FBX_OUTPUT_DIR = os.path.join(BASE_DIR, "json_output_test")
EXTRA_INFORMATION_JSON_DIR = os.path.join(BASE_DIR, "extra_information_json")
CONVERTER_SCRIPT = os.path.join(BASE_DIR, "converters", "json_to_fbx.py")

os.makedirs(JSON_INPUT_DIR, exist_ok=True)
os.makedirs(FBX_OUTPUT_DIR, exist_ok=True)
os.makedirs(EXTRA_INFORMATION_JSON_DIR, exist_ok=True)


class ConvertRequest(BaseModel):
    expectedCompletionTime: int
    expectedNumOfActions: int
    objects: list


@app.post("/convert")
def convert_json_to_fbx(payload: ConvertRequest):
    job_id = str(uuid.uuid4())

    json_path = os.path.join(JSON_INPUT_DIR, f"model.json")
    fbx_path = os.path.join(FBX_OUTPUT_DIR, f"model.fbx")

    # Save JSON
    with open(json_path, "w") as f:
        json.dump(payload.dict(), f, indent=2)

    other_information_json_path = os.path.join(EXTRA_INFORMATION_JSON_DIR, f"info.json")
    with open(other_information_json_path, "w") as f:
        json.dump(
            {
                "expectedCompletionTime": payload.dict()["expectedCompletionTime"],
                "expectedNumOfActions": payload.dict()["expectedNumOfActions"],
            },
            f,
            indent=2,
        )

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


def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")


def _is_port_in_use(host: str, port: int) -> bool:
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            s.connect((host, port))
        return True
    except Exception:
        return False


import time


def wait_for_model_fbx():
    """Wait until model.fbx exists, checking every 0.5 seconds."""
    fbx_path = os.path.join(FBX_OUTPUT_DIR, "test.fbx")
    max_wait = 60  # Maximum 60 seconds
    elapsed = 0
    print(os.path.exists(fbx_path))
    while not os.path.exists(fbx_path) and elapsed < max_wait:
        time.sleep(1.5)
        elapsed += 1.5

    time.sleep(2)
    if os.path.exists(fbx_path):
        load_model(fbx_path)
    else:
        print(f"Timeout waiting for model.fbx after {max_wait} seconds")


register_panel()

# Start server only if there isn't one already listening on the port
_SERVER_HOST = "127.0.0.1"
_SERVER_PORT = 8000

if not _is_port_in_use(_SERVER_HOST, _SERVER_PORT):
    existing = globals().get("server_thread")
    if not existing or not getattr(existing, "is_alive", lambda: False)():
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
else:
    print(
        f"Server already running at {_SERVER_HOST}:{_SERVER_PORT}, not starting another."
    )


wait_for_model_fbx()
