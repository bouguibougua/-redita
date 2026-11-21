"""Prépare les animaux de boutique Tripo sans conversion distante payante.

Blender --background --python scripts/prepare-shop-animal.py -- source.glb destination.glb
Conserve le maillage et les matériaux PBR ; réduit les images à 1024 pixels.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
for image in bpy.data.images:
    if image.type != 'IMAGE' or not image.size[0]:
        continue
    if max(image.size) > 1024:
        factor = 1024 / max(image.size)
        image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))
    image.pack()
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_yup=True)
triangles = 0
points = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
minimum = [min(point[i] for point in points) for i in range(3)]
maximum = [max(point[i] for point in points) for i in range(3)]
print('SHOP_ANIMAL ' + json.dumps({
    'triangles': triangles,
    'bytes': destination.stat().st_size,
    'bounds_blender_z_up': [minimum, maximum],
    'textures': [list(image.size) for image in bpy.data.images if image.type == 'IMAGE'],
}))
