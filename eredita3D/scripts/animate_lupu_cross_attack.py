"""Lupu : garde bipède et attaque en X des deux griffes simultanées.
Retouche uniquement ces clips dans le GLB existant, sans refaire le rig ni la marche.
"""
from pathlib import Path
import bpy,sys,math,json,hashlib,struct
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[2]
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from polish_legend_motion import preserve_images,read_glb
path=ROOT/'assets/models/lupu_mannaru.glb';source=path.read_bytes()
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=60
bpy.ops.import_scene.gltf(filepath=str(path))
rig=next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
source_helpers=(ROOT/'eredita3D/scripts/prepare_lupu.py').read_text()
ns={'rig':rig,'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix,'Quaternion':Quaternion}
exec(source_helpers[source_helpers.index('def smooth('):source_helpers.index("CLIPS={'Repos'")],ns)
smooth=ns['smooth']
def pose(attack,t):
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update();ns['body_stance'](1,t,False);ns['feet'](1,t,False)
 prepare=smooth(0,.24,t) if attack else 0
 cut=smooth(.27,.57,t) if attack else 0
 recover=smooth(.66,1,t) if attack else 0
 ns['turn']('Chest',(1,0,0),.035*cut*(1-recover) if attack else .008*math.sin(math.tau*t))
 for side,sign in [('Left',1),('Right',-1)]:
  guard=Vector((sign*.40,-.28,1.18));high=Vector((sign*.56,-.28,1.54))
  # Plans légèrement décalés pour croiser les avant-bras sans superposer les deux paumes.
  low=Vector((-sign*.16,-.40-sign*.06,1.08))
  target=guard.lerp(high,prepare).lerp(low,cut).lerp(guard,recover)
  ns['ik']([side+'Arm',side+'ForeArm',side+'Hand'],target,Vector((sign,.25,.05)))
  high_dir=Vector((sign*.25,-.2,.8));cut_dir=Vector((-sign*.65,-.25,-.70));guard_dir=Vector((sign*.05,-1,-.2))
  direction=guard_dir.lerp(high_dir,prepare).lerp(cut_dir,cut).lerp(guard_dir,recover).normalized()
  hand=rig.pose.bones[side+'Hand'];ns['aim'](side+'Hand',hand.head+direction*.15)
 bpy.context.view_layer.update()
for name in ['Griffes_Croisees','Garde_Debout']:
 old=bpy.data.actions.get(name)
 if old:
  for track in list(rig.animation_data.nla_tracks):
   if any(s.action==old for s in track.strips):rig.animation_data.nla_tracks.remove(track)
  bpy.data.actions.remove(old)
validation={};actions={}
for name,frames in [('Griffes_Croisees',60),('Garde_Debout',120)]:
 action=bpy.data.actions.new(name);rig.animation_data.action=action;poses=[]
 for frame in range(frames+1):
  scene.frame_set(frame);pose(name=='Griffes_Croisees',frame/frames)
  poses.append({n:list(rig.pose.bones[n].head) for n in ['Head','LeftHand','RightHand','LeftFoot','RightFoot']})
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 actions[name]=action;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
 validation[name]={'duration':frames/60,'headMin':min(p['Head'][2] for p in poses),'headMax':max(p['Head'][2] for p in poses),'footDrift':max((Vector(p[n])-Vector(poses[0][n])).length for p in poses for n in ['LeftFoot','RightFoot'])}
 assert validation[name]['footDrift']<.0001
rig.animation_data.action=bpy.data.actions['Repos'];scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_nla_strips=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO')
result,images=preserve_images(source,path.read_bytes());path.write_bytes(result)
doc=read_glb(result)[0]
def durations(doc):
 return {a['name']:max(doc['accessors'][s['input']]['max'][0] for s in a['samplers']) for a in doc['animations']}
old_times=durations(read_glb(source)[0]);new_times=durations(doc)
for name in ['Repos','Quatre_Pattes','Mort']:assert abs(old_times[name]-new_times[name])<.0001,(name,old_times[name],new_times[name])
report={'inputSha256':hashlib.sha256(source).hexdigest(),'sha256':hashlib.sha256(result).hexdigest(),'bytes':len(result),'fps':60,'clips':[a['name'] for a in doc['animations']],'poses':validation,'clipDurations':new_times,'originalImageSha256':images,'attack':'simultaneous cross slash, upright guard'}
(ROOT/'eredita3D/logs/lupu-cross-attack.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('LUPU_CROSS_ATTACK',json.dumps(report),flush=True)
