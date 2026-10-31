"""Crée le premier test 3D Eredità avec l’API Blender, sans toucher au jeu.

Exécution depuis n’importe quel dossier :
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --factory-startup --python-exit-code 1 --python /chemin/create_test_scene.py
"""

from pathlib import Path
import json
import math
import struct

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "models" / "test.blend"
GLB_PATH = ROOT / "exports" / "test.glb"
PREVIEW_PATH = ROOT / "previews" / "test.png"


def material(name, color, roughness):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    return result


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def area_light(name, location, energy, size):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, (0.0, 0.0, 0.8))
    return obj


def validate_glb():
    data = GLB_PATH.read_bytes()
    magic, version, total_length = struct.unpack_from("<4sII", data)
    assert magic == b"glTF" and version == 2
    assert total_length == len(data)
    json_length, chunk_type = struct.unpack_from("<I4s", data, 12)
    assert chunk_type == b"JSON"
    document = json.loads(data[20:20 + json_length])
    assert len(document["meshes"]) == 2, "Le GLB doit contenir le cube et le sol."
    colors = {
        item["name"]: item["pbrMetallicRoughness"]["baseColorFactor"]
        for item in document["materials"]
    }
    assert colors["Bleu"][2] > colors["Bleu"][0]
    assert math.isclose(colors["Gris"][0], colors["Gris"][1])
    assert math.isclose(colors["Gris"][1], colors["Gris"][2])


def main():
    for path in (BLEND_PATH, GLB_PATH, PREVIEW_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)

    # Réinitialise uniquement la scène en mémoire, sans enregistrer de préférences.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"

    blue = material("Bleu", (0.025, 0.15, 0.8), 0.32)
    gray = material("Gris", (0.28, 0.28, 0.28), 0.85)

    # Le cube mesure deux mètres de côté ; sa face inférieure repose à z = 0.
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0.0, 0.0, 1.0))
    cube = bpy.context.object
    cube.name = "Cube_Bleu"
    cube.data.materials.append(blue)
    bevel = cube.modifiers.new("Aretes_adoucies", type="BEVEL")
    bevel.width = 0.055
    bevel.segments = 4

    bpy.ops.mesh.primitive_plane_add(size=200.0, location=(0.0, 0.0, 0.0))
    floor = bpy.context.object
    floor.name = "Sol_Gris"
    floor.data.materials.append(gray)

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.15, 0.15, 0.15, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world
    area_light("Lumiere_principale", (4.0, -4.0, 7.0), 1100.0, 5.0)
    area_light("Lumiere_douce", (-4.0, -1.0, 4.0), 450.0, 4.0)
    area_light("Lumiere_arriere", (1.0, 4.0, 6.0), 800.0, 3.0)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (6.0, -8.0, 6.0)
    point_at(camera, (0.0, 0.0, 0.85))
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 7.0
    scene.camera = camera

    # Rendu CPU pour que le test fonctionne aussi en mode background sans GPU.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    cube.select_set(True)
    floor.select_set(True)
    bpy.context.view_layer.objects.active = cube

    # Seuls les deux maillages sont exportés ; le .blend garde le studio complet.
    assert bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH), export_format="GLB", use_selection=True,
        export_apply=True, export_cameras=False, export_lights=False,
    ) == {"FINISHED"}
    validate_glb()
    assert bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH)) == {"FINISHED"}
    assert bpy.ops.render.render(write_still=True) == {"FINISHED"}

    # Relit le fichier sauvegardé pour vérifier que la scène est bien ouvrable.
    assert bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH)) == {"FINISHED"}
    assert len([obj for obj in bpy.context.scene.objects if obj.type == "MESH"]) == 2
    saved_cube = bpy.data.objects["Cube_Bleu"]
    saved_floor = bpy.data.objects["Sol_Gris"]
    bottom = min((saved_cube.matrix_world @ Vector(corner)).z for corner in saved_cube.bound_box)
    assert math.isclose(bottom, saved_floor.location.z, abs_tol=1e-6)
    assert saved_cube.data.materials[0].name == "Bleu"
    assert saved_floor.data.materials[0].name == "Gris"
    for path in (BLEND_PATH, GLB_PATH, PREVIEW_PATH):
        assert path.is_file() and path.stat().st_size > 0, f"Fichier manquant : {path}"
        print(f"FICHIER_VALIDE {path} ({path.stat().st_size} octets)", flush=True)
    print("EREDITA3D_TEST_OK", flush=True)


if __name__ == "__main__":
    main()
