"""Inspection locale du vampire fourni, sans modification de l'original."""
from pathlib import Path
import bpy,json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath='/Users/robin/Downloads/fantasy vampire 3d model.glb')
s=bpy.context.scene;body=next(o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));rig=next(o for o in s.objects if o.type=='ARMATURE')
points=[body.matrix_world@v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(low+high)/2;h=high.z-low.z
data={'bounds':[list(low),list(high)],'textures':[[i.name,list(i.size)] for i in bpy.data.images], 'bones':{b.name:list(rig.matrix_world@b.head_local) for b in rig.data.bones}}
(ROOT/'logs/surpatore-source.json').write_text(json.dumps(data,indent=2));print('SURPATORE_SOURCE',json.dumps(data),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/surpatore_source.blend'))
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=850;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Studio');s.world.color=(.2,.2,.2)
for name,offset,power in [('Key',(-2,-3,4),450),('Fill',(2,1,3),250)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=center+Vector(offset)*h;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=h*1.35;o=bpy.data.objects.new('Camera',d);s.collection.objects.link(o);s.camera=o
for label,offset in [('front',(0,-5,.2)),('side',(5,0,.2)),('three_quarter',(2,-4,.7))]:
 o.location=center+Vector(offset)*h;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/'previews'/f'surpatore_source_{label}.png');bpy.ops.render.render(write_still=True)
