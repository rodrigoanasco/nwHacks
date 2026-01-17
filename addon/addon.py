import bpy
import bpy_extras
import os
import gpu
import bmesh
import blf

IMPORTED_OBJECT_NAME = "TARGET"
TOLERANCE = 0.5


class SubmitButton(bpy.types.Operator):
    """tooltip goes here"""

    bl_idname = "object.submit_operator"
    bl_label = "Submit"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT"

    def execute(self, context):
        imported_object = None
        user_objects = []

        for obj in bpy.context.visible_objects:
            if obj.name == IMPORTED_OBJECT_NAME:
                imported_object = obj
            else:
                user_objects.append(obj)

        if imported_object is None or imported_object.type != "MESH":
            return {"CANCELLED"}

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

        # Create the material
        def set_mat_color(mat, color_tuple):
            mat.diffuse_color = color_tuple
            if mat.use_nodes and mat.node_tree is not None:
                nodes = mat.node_tree.nodes
                principled = None
                for n in nodes:
                    if n.type == "BSDF_PRINCIPLED":
                        principled = n
                        break
                if principled is None:
                    principled = nodes.new(type="ShaderNodeBsdfPrincipled")
                    output = next(
                        (n for n in nodes if n.type == "OUTPUT_MATERIAL"), None
                    )
                    if output is not None:
                        mat.node_tree.links.new(
                            principled.outputs["BSDF"], output.inputs["Surface"]
                        )
                principled.inputs["Base Color"].default_value = color_tuple

        set_mat_color(green, (0.0, 1.0, 0.0, 1.0))
        set_mat_color(red, (1.0, 0.0, 0.0, 1.0))

        # Ensure two material slots on the imported mesh: 0 = green, 1 = red
        mats = imported_object.data.materials
        mats.clear()
        mats.append(green)
        mats.append(red)

        mesh = imported_object.data
        for poly in mesh.polygons:
            # Face is green only if all its vertices are matched; otherwise red
            face_ok = all(matched[i] for i in poly.vertices)
            poly.material_index = 0 if face_ok else 1

        mesh.update()
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
        print(f"presssed: hint")

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
        layout.operator(HintButton.bl_idname, text="Hint")
        layout.operator(SubmitButton.bl_idname, text="Submit")


classes = [Panel, HintButton, SubmitButton]


def register_panel():
    for ui_class in classes:
        bpy.utils.register_class(ui_class)


def unregister_panel():
    for ui_class in classes:
        bpy.utils.unregister_class(ui_class)


def load_model():
    addon_path = os.path.dirname(__file__)
    file_path = os.path.join(addon_path, "", "test.fbx")

    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.fbx_import(filepath=file_path)

    for obj in bpy.context.selected_objects:
        obj.name = IMPORTED_OBJECT_NAME
        # Show faces so material changes are visible in the viewport
        obj.display_type = "SOLID"


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


load_model()
bpy.types.Scene.edge_draw_handler = bpy.types.SpaceView3D.draw_handler_add(
    draw_lengths, (), "WINDOW", "POST_PIXEL"
)

register_panel()
