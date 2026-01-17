import bpy
import bpy_extras
import os
import gpu
import bmesh
import blf

addon_path = os.path.dirname(__file__)
file_path = os.path.join(addon_path, "", "test.fbx")
obj_file = open(file_path)

bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.fbx_import(filepath=file_path)

for obj in bpy.context.selected_objects:
    obj.name = "IMPORTED MODEL"
    obj.display_type = "WIRE"


def draw_lengths():
    current_object = bpy.context.active_object
    object_data = current_object.data

    region = bpy.context.region
    view_3d = bpy.context.region_data

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


bpy.types.Scene.my_draw_handler = bpy.types.SpaceView3D.draw_handler_add(
    draw_lengths, (), "WINDOW", "POST_PIXEL"
)


bpy.context.area.tag_redraw()
