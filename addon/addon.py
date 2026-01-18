import bpy
import bpy_extras
import os
import json
import bmesh
import blf
import requests

IMPORTED_OBJECT_NAME = "TARGET"
TOLERANCE = 0.1

hints_remaining = 3
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
        global submitted
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
        for poly in mesh.polygons:
            # Face is green only if all its vertices are matched; otherwise red
            face_ok = all(matched[i] for i in poly.vertices)
            poly.material_index = 0 if face_ok else 1
        mesh.update()

        # Switch 3D View to Material Preview so materials are visible, then redraw
        for area in bpy.context.screen.areas:
            if area.type == "VIEW_3D":
                for space in area.spaces:
                    if space.type == "VIEW_3D":
                        space.shading.type = "MATERIAL"
                area.tag_redraw()

        submitted = True
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
            "vertex_coordinates": [list(v.co) for v in user_object.data.vertices],
            "location": user_object.location,
        }

        target_object_data = {
            "vertex_count": len(target_object.data.vertices),
            "vertex_coordinates": [list(v.co) for v in target_object.data.vertices],
            "location": target_object.location,
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

        hints_remaining -= 1

        return {"FINISHED"}


class ResetButton(bpy.types.Operator):
    """tooltip goes here"""

    bl_idname = "object.reset_operator"
    bl_label = "Reset"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT"

    def execute(self, context):
        global submitted

        if not submitted:
            return

        for obj in bpy.context.visible_objects:
            if obj.type != "MESH":
                continue
            mats = obj.data.materials
            if any(
                m and m.name in ("Match_Green", "Match_Red", "Translucent")
                for m in mats
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
        layout.operator(SubmitButton.bl_idname, text="Submit")
        layout.operator(ResetButton.bl_idname, text="Reset")


classes = [Panel, HintButton, SubmitButton, ResetButton]


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


load_model()
register_panel()
