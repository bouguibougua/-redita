"""Rendus d'un modèle de terrain pour le plateau 2D et le choix des biomes.

Appelé par `npm run assets:plaine`. Ne modifie ni le BLEND ni le GLB source.
"""
from pathlib import Path
import bpy
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BIOME = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'plaine'
assert BIOME in ('plaine', 'montagne', 'littoral_rouge', 'littoral_bleu')
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'models' / f'{BIOME}.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'

# Vue orthographique sans bord de studio : un seul fond, toujours sans cultures.
camera = scene.objects['Camera_top']
camera.location = (0, 0, 8)
camera.rotation_euler = (0, 0, 0)
camera.data.ortho_scale = 4.85
scene.camera = camera
scene.render.resolution_x = 768
scene.render.resolution_y = round(768 * 4.85 / 2.82)
scene.render.filepath = str(ROOT / 'previews' / f'{BIOME}_web_top.png')
assert bpy.ops.render.render(write_still=True) == {'FINISHED'}

# Cadrage paysage calculé autour de la géométrie, pour la carte de sélection.
scene.camera = camera = scene.objects['Camera_three_quarter']
scene.render.resolution_x = 768
scene.render.resolution_y = 432
scene.view_layers.update()
inverse = camera.matrix_world.inverted()
points = [inverse @ obj.matrix_world @ Vector(corner)
          for obj in scene.objects if obj.type == 'MESH' and obj.get('terrainRole')
          for corner in obj.bound_box]
aspect = 768 / 432
camera.data.ortho_scale = max(max(abs(p.x) for p in points) * 2,
                                  max(abs(p.y) for p in points) * 2 * aspect) * 1.05
scene.render.filepath = str(ROOT / 'previews' / f'{BIOME}_web_card.png')
assert bpy.ops.render.render(write_still=True) == {'FINISHED'}
print(f'{BIOME.upper()}_WEB: deux rendus prêts pour conversion WebP.')
