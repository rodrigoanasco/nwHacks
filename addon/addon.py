import bpy
import os

addon_path = os.path.dirname(__file__)
file_path = os.path.join(addon_path, "", "test.fbx")
obj_file = open(file_path)

bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.fbx_import(filepath=file_path)

for obj in bpy.context.selected_objects:
    obj.name = "IMPORTED MODEL"
    obj.display_type = "WIRE"
