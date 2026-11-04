from pathlib import Path
import bpy,json
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'models/surpatore_source.blend'))
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=True
s.render.resolution_x=s.render.resolution_y=1000;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Studio');s.world.color=(.2,.2,.2)
for name,pos,power in [('Principal',(3,-3,4),450),('Retour',(-2,1,3),250)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=.28
o=bpy.data.objects.new('Camera',d);s.collection.objects.link(o);s.camera=o
target=Vector((.10,-.015,.90))
for suffix,offset in [('face',(.8,0,.02)),('side',(.1,-.8,.02))]:
 s.camera.location=target+Vector(offset);s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/'previews'/f'surpatore_head_{suffix}.png');bpy.ops.render.render(write_still=True)
body=next(o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
points=[(v.index,body.matrix_world@v.co) for v in body.data.vertices]
mouth=[(i,list(p)) for i,p in points if .82<p.z<.91 and .08<p.x and abs(p.y+.02)<.08]
(ROOT/'logs/surpatore-mouth.json').write_text(json.dumps(mouth))
print('MOUTH',len(mouth),flush=True)
