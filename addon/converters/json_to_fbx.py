import bpy
import json
import sys
import os

# Get arguments
# blender -b -P json_to_fbx.py -- input.json output.fbx
argv = sys.argv
argv = argv[argv.index("--") + 1:]

json_path = argv[0]
fbx_path = argv[1]

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Load JSON
with open(json_path, "r") as f:
    data = json.load(f)

# Create objects
for obj_data in data["objects"]:
    name = obj_data["name"]
    vertices = obj_data["vertices"]
    faces = obj_data["faces"]

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

# Export FBX
os.makedirs(os.path.dirname(fbx_path), exist_ok=True)

bpy.ops.export_scene.fbx(
    filepath=fbx_path,
    use_selection=False,
    object_types={'MESH'},
    add_leaf_bones=False
)

print("FBX exported to:", fbx_path)
