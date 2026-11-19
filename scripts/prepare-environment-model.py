"""Prépare un modèle Tripo du paysage PC (arbre, buisson, rocher) pour l'instanciation.

Blender --background --python scripts/prepare-environment-model.py -- source.glb destination.glb triangles_proche triangles_loin [apercu.png]

Les exports Tripo bruts comptent ~2 millions de triangles et des dizaines de textures :
impossible de les instancier des centaines de fois. Le script :
  1. échantillonne la couleur de base des textures dans des couleurs de sommets (pleine résolution) ;
  2. fusionne tous les morceaux et soude les coutures ;
  3. réduit le maillage (version proche, puis version lointaine *_far.glb) ;
  4. pose la base à y = 0, centre le pied, supprime matériaux et UV ;
  5. exporte un GLB sans texture (couleurs de sommets seules), plus un aperçu facultatif.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path

import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, destination = Path(args[0]), Path(args[1])
near_target, far_target = int(args[2]), int(args[3])
preview = Path(args[4]) if len(args) > 4 else None

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

pixel_cache = {}


def image_pixels(image):
    key = image.name
    if key not in pixel_cache:
        w, h = image.size
        data = np.empty(w * h * image.channels, dtype=np.float32)
        image.pixels.foreach_get(data)
        pixel_cache[key] = (data.reshape(h, w, image.channels)[:, :, :3], w, h)
    return pixel_cache[key]


def base_color_source(material):
    """(image ou None, facteur RGB) de l'entrée Base Color du Principled BSDF."""
    if not material or not material.use_nodes:
        return None, (0.6, 0.6, 0.6)
    for node in material.node_tree.nodes:
        if node.type != 'BSDF_PRINCIPLED':
            continue
        socket = node.inputs['Base Color']
        factor = tuple(socket.default_value[:3])
        stack = [link.from_node for link in socket.links]
        while stack:
            current = stack.pop()
            if current.type == 'TEX_IMAGE' and current.image:
                return current.image, (1.0, 1.0, 1.0)
            for entry in current.inputs:
                stack.extend(link.from_node for link in entry.links)
        return None, factor
    return None, (0.6, 0.6, 0.6)


meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in meshes:
    mesh = obj.data
    count = len(mesh.loops)
    colors = np.ones((count, 4), dtype=np.float32)
    uv_layer = mesh.uv_layers.active
    uvs = np.zeros(count * 2, dtype=np.float32)
    if uv_layer:
        uv_layer.data.foreach_get('uv', uvs)
    uvs = uvs.reshape(count, 2)
    loop_material = np.zeros(count, dtype=np.int32)
    poly_material = np.zeros(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get('material_index', poly_material)
    loop_totals = np.zeros(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get('loop_total', loop_totals)
    loop_material = np.repeat(poly_material, loop_totals)
    for index, material in enumerate(mesh.materials):
        selected = loop_material == index
        if not selected.any():
            continue
        image, factor = base_color_source(material)
        if image is None or not uv_layer or not image.size[0]:
            colors[selected, :3] = factor
            continue
        pixels, w, h = image_pixels(image)
        u = np.mod(uvs[selected, 0], 1.0) * (w - 1)
        v = np.mod(uvs[selected, 1], 1.0) * (h - 1)
        colors[selected, :3] = pixels[v.round().astype(np.int64), u.round().astype(np.int64)]
    attribute = mesh.color_attributes.new(name='Col', type='BYTE_COLOR', domain='CORNER')
    # Les pixels JPEG sont encodés sRGB : on les écrit tels quels dans color_srgb.
    attribute.data.foreach_set('color_srgb', np.clip(colors, 0, 1).ravel())
    mesh.color_attributes.active_color = attribute

pixel_cache.clear()
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
model = bpy.context.view_layer.objects.active
model.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for obj in list(bpy.context.scene.objects):
    if obj != model:
        bpy.data.objects.remove(obj, do_unlink=True)

# Soudure des coutures entre morceaux (seuil relatif à la taille).
size = max(model.dimensions)
mesh = model.data
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 2e-4)
bm.to_mesh(mesh)
bm.free()
for layer in list(mesh.uv_layers):
    mesh.uv_layers.remove(layer)
mesh.materials.clear()

# Base à z = 0 (Blender Z-up), pied centré : centre XY de la tranche basse (tronc).
coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
mesh.vertices.foreach_get('co', coords)
coords = coords.reshape(-1, 3)
z_min, z_max = coords[:, 2].min(), coords[:, 2].max()
low = coords[coords[:, 2] < z_min + (z_max - z_min) * 0.08]
foot = low[:, :2].mean(axis=0) if len(low) > 8 else (coords[:, :2].min(axis=0) + coords[:, :2].max(axis=0)) / 2
coords -= np.array([foot[0], foot[1], z_min], dtype=np.float32)
mesh.vertices.foreach_set('co', coords.ravel())
mesh.update()


def triangle_count():
    mesh = model.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def decimate(target):
    current = triangle_count()
    if current <= target:
        return
    modifier = model.modifiers.new('reduction', 'DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = max(0.0001, target / current)
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def export(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    for polygon in model.data.polygons:
        polygon.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    model.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_yup=True, use_selection=True,
                              export_vertex_color='ACTIVE', export_materials='NONE', export_texcoords=False,
                              export_normals=True, export_apply=True)


report = {'source_triangles': None}
decimate(near_target)
near_triangles = triangle_count()
export(destination)
dims = list(model.dimensions)

if preview:
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.film_transparent = False
    scene.world = scene.world or bpy.data.worlds.new('fond')
    camera_data = bpy.data.cameras.new('apercu')
    camera = bpy.data.objects.new('apercu', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    height = dims[2]
    reach = max(dims) * 1.9
    camera.location = Vector((reach * 0.75, -reach * 0.75, height * 0.5 + reach * 0.45))
    direction = Vector((0, 0, height * 0.45)) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(preview)
    bpy.ops.render.render(write_still=True)

decimate(far_target)
far_triangles = triangle_count()
far_path = destination.with_name(destination.stem + '_far.glb')
export(far_path)

print('ENV_MODEL ' + json.dumps({
    'file': destination.name, 'near_triangles': near_triangles, 'far_triangles': far_triangles,
    'bytes': destination.stat().st_size, 'far_bytes': far_path.stat().st_size,
    'dimensions_xyz_blender': [round(d, 3) for d in dims],
}))
