"""Améliore le Tir du GLB préparé : IK des bras, visée, décoche et retour au repos.
Exécuter après prepare_mazzeru.py ; seules l'animation Tir et la prise de l'arc changent.
Aucun service externe ni nouvelle génération 3D.
"""
import bpy, math, json, struct, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'assets/models/mazzeru.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUTPUT))
scene=bpy.context.scene;scene.render.fps=24
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
idle=next(a for a in bpy.data.actions if a.name=='Repos')
rig.animation_data.action=idle;scene.frame_set(0);bpy.context.view_layer.update()
base={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
get=lambda name:rig.pose.bones['mixamorig:'+name]
world=lambda bone:rig.matrix_world@bone.head
starts={side:world(get(side+'Hand')).copy() for side in ['Left','Right']}
bow=bpy.data.objects['Arc_Mazzeru_Fourni']
if not bow.get('eredita_vertical_bow'):
 # Normaliser les axes du maillage : arc vertical, courbure vers l'avant (-Y Blender).
 pts=np.array([tuple(bow.matrix_world@v.co) for v in bow.data.vertices])
 center=pts.mean(axis=0);values,axes=np.linalg.eigh(np.cov((pts-center).T));axes=axes[:,np.argsort(values)[::-1]]
 if axes[2,0]<0:axes[:,0]*=-1
 projected=(pts-center)@axes
 midpoint=(projected.min(axis=0)+projected.max(axis=0))/2
 projected-=midpoint
 for v,p in zip(bow.data.vertices,projected):v.co=Vector((float(p[2]),-float(p[1]),float(p[0])))
 hand=get('LeftHand');hand_world=rig.matrix_world@hand.matrix
 parent_world=hand_world@Matrix.Translation((0,hand.length,0))
 bow.matrix_parent_inverse=parent_world.inverted();bow.matrix_basis=Matrix.Translation(world(hand))
 bow['eredita_vertical_bow']=True

def smooth(a,b,t):
 x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)
def rotate_world(bone,axis,angle):
 b=get(bone);m=rig.matrix_world@b.matrix;p=m.translation.copy()
 b.matrix=rig.matrix_world.inverted()@Matrix.Translation(p)@Quaternion(Vector(axis),angle).to_matrix().to_4x4()@Matrix.Translation(-p)@m
 bpy.context.view_layer.update()
def aim_bone(b,target):
 p=world(b);current=(rig.matrix_world@b.tail)-p
 rotation=current.rotation_difference(target-p)
 m=rig.matrix_world@b.matrix
 b.matrix=rig.matrix_world.inverted()@Matrix.Translation(p)@rotation.to_matrix().to_4x4()@Matrix.Translation(-p)@m
 bpy.context.view_layer.update()
def arm(side,target,pole):
 upper,lower,hand=[get(side+n) for n in ['Arm','ForeArm','Hand']]
 shoulder=world(upper);middle=world(lower);wrist=world(hand)
 l1=(middle-shoulder).length;l2=(wrist-middle).length;direction=target-shoulder
 distance=max(.001,min(direction.length,(l1+l2)*.985));direction.normalize();target=shoulder+direction*distance
 across=pole-shoulder;across-=direction*across.dot(direction)
 if across.length<.001:across=direction.cross(Vector((0,0,1)))
 across.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 elbow=shoulder+direction*along+across*math.sqrt(max(0,l1*l1-along*along))
 aim_bone(upper,elbow);aim_bone(lower,target)
 # La paume reste orientée comme au repos ; les doigts gardent une prise souple.
 for name in ['Index','Middle','Ring','Pinky']:
  b=rig.pose.bones.get('mixamorig:'+side+'Hand'+name+'1')
  if b:b.rotation_quaternion=b.rotation_quaternion@Quaternion((1,0,0),.35)
old=next(a for a in bpy.data.actions if a.name=='Tir')
for track in list(rig.animation_data.nla_tracks):
 if any(strip.action==old for strip in track.strips):rig.animation_data.nla_tracks.remove(track)
rig.animation_data.action=None;bpy.data.actions.remove(old)
action=bpy.data.actions.new('Tir');rig.animation_data.action=action
for frame in range(31):
 scene.frame_set(frame)
 for b in rig.pose.bones:b.matrix_basis=base[b.name].copy()
 bpy.context.view_layer.update();t=frame/30
 lift=smooth(0,.28,t)*(1-smooth(.79,1,t));draw=smooth(.22,.51,t)*(1-smooth(.60,.66,t))
 recoil=smooth(.60,.64,t)*(1-smooth(.66,.78,t))
 rotate_world('Spine1',(0,0,1),-.28*lift)
 rotate_world('Spine2',(1,0,0),.035*lift)
 rotate_world('Head',(0,0,1),.26*lift)
 left=starts['Left'].lerp(Vector((.04,-.57,1.49+recoil*.025)),lift)
 nock=Vector((.02,-.49+draw*.30+recoil*.08,1.51+draw*.025))
 right=starts['Right'].lerp(nock,lift)
 arm('Left',left,Vector((.40,-.24,1.20)))
 arm('Right',right,Vector((-.55,.10,1.53)))
 for b in rig.pose.bones:
  b.rotation_mode='QUATERNION';b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
rig.animation_data.action=idle;scene.frame_set(0)
track=rig.animation_data.nla_tracks.new();track.name='Tir';track.strips.new('Tir',0,action);track.mute=True
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_nla_strips=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)
raw=OUTPUT.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
report={'clips':[a.get('name') for a in doc['animations']],'attack_frames':30,'fps':24,'duration':1.25,'release_seconds':.75,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'method':'baked two-bone IK, draw/aim/release/recovery'}
assert set(report['clips'])=={'Repos','Marche','Tir','Mort'}
(ROOT/'eredita3D/logs/mazzeru-archery-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('MAZZERU_ARCHERY',json.dumps(report),flush=True)
