"""Optimise localement la pancarte Tripo, sans nouvelle génération.
Blender --background --python scripts/prepare-shop-sign.py -- source.glb destination.glb
L'orientation d'exposition est choisie dans shop-scene.js.
"""
import bpy
import json
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
for image in bpy.data.images:
    if image.type != 'IMAGE' or not image.size[0]:
        continue
    if max(image.size) > 512:
        factor = 512 / max(image.size)
        image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))
    image.pack()
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_yup=True)
triangles = 0
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
print('SHOP_SIGN ' + json.dumps({'triangles': triangles, 'bytes': destination.stat().st_size,
    'textures': [list(im.size) for im in bpy.data.images if im.type == 'IMAGE']}))
