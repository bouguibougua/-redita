"""Inspection locale du modèle fourni pour U Lupu Mannaru."""
from pathlib import Path
import bpy,json
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath='/Users/robin/Downloads/U lupu mannaru 3d.glb')
s=bpy.context.scene;body=next(o for o in s.objects if o.type=='MESH');body.name='Lupu_Source'
world=body.matrix_world.copy();body.parent=None;body.data.transform(world);body.matrix_world=Matrix.Identity(4)
points=[v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
scale=1.8/(high.z-low.z);base=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
body.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-base));body.data.update()
data={'low':list(low),'high':list(high),'normalized_bounds':[[min(v.co[i] for v in body.data.vertices) for i in range(3)],[max(v.co[i] for v in body.data.vertices) for i in range(3)]], 'textures':[[i.name,list(i.size)] for i in bpy.data.images]}
(ROOT/'logs/lupu-source.json').write_text(json.dumps(data,indent=2));print('LUPU_SOURCE',json.dumps(data),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/lupu_source.blend'))
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=800;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Studio');s.world.color=(.2,.2,.2)
for name,pos,power in [('Principal',(-3,-4,5),550),('Retour',(3,1,4),350)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=2.5;o=bpy.data.objects.new('Camera',d);s.collection.objects.link(o);s.camera=o
for label,pos in [('front',(0,-5,1)),('side',(5,0,1)),('three_quarter',(2.5,-5,1.7))]:
 o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/'previews'/f'lupu_source_{label}.png');bpy.ops.render.render(write_still=True)
