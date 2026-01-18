import sys
import os
import json

try:
    import bpy
except Exception:
    print("This script must be run inside Blender (bpy required).")
    sys.exit(1)

# Use fixed paths inside the addon folder
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
fbx_path = os.path.join(base_dir, "easy.fbx")
json_path = os.path.join(base_dir, "easy.json")


# Start from a clean scene without removing view layers (avoids missing view_layer in background)
def clear_scene():
    # remove objects
    for obj in list(bpy.data.objects):
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass
    # remove meshes
    for mesh in list(bpy.data.meshes):
        try:
            bpy.data.meshes.remove(mesh, do_unlink=True)
        except Exception:
            pass


clear_scene()

# Import FBX
if not os.path.exists(fbx_path):
    print("FBX file not found:", fbx_path)
    sys.exit(1)

print("Importing FBX:", fbx_path)
bpy.ops.import_scene.fbx(filepath=fbx_path)

scene = bpy.context.scene
objects_out = []

# Use evaluated depsgraph so modifiers are applied
depsgraph = bpy.context.evaluated_depsgraph_get()

for obj in list(scene.objects):
    if obj.type != "MESH":
        continue

    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    if mesh is None:
        continue

    # Collect transformed vertex coordinates (world space)
    verts = []
    for v in mesh.vertices:
        co = obj.matrix_world @ v.co
        verts.append([float(co.x), float(co.y), float(co.z)])

    # Collect polygon faces (preserve quads/ngons when available)
    faces = []
    for poly in mesh.polygons:
        verts_idx = [int(i) for i in poly.vertices]
        faces.append(verts_idx)

    objects_out.append({"name": obj.name, "vertices": verts, "faces": faces})

    # free the evaluated mesh
    eval_obj.to_mesh_clear()

# Build final JSON
out = {
    "questionName": os.path.splitext(os.path.basename(fbx_path))[0],
    "expectedCompletionTime": 10,
    "expectedNumOfActions": 0,
    "objects": objects_out,
}

os.makedirs(os.path.dirname(json_path) or ".", exist_ok=True)
with open(json_path, "w") as f:
    json.dump(out, f, indent=2)

print("Wrote JSON to:", json_path)
