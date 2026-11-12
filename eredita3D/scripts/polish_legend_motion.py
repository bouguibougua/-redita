"""Retouche locale des trois rigs existants : foulées, appuis, interpolation quaternion et boucles.
À exécuter après les scripts de préparation ; aucun appel Tripo ou modification de statistiques.
"""
from pathlib import Path
import bpy,math,json,struct,hashlib
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[2]
FILES={'lupu':'lupu_mannaru.glb','mazzeru':'mazzeru.glb','roccapina':'lion-roccapina.glb'}
FPS=60

def read_glb(raw):
 length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);start=20+length
 return doc,raw[start+8: start+8+struct.unpack_from('<I',raw,start)[0]]
def preserve_images(source,output):
 original,data=read_glb(source);doc,binary=read_glb(output);binary=bytearray(binary);hashes=[]
 assert len(original.get('images',[]))==len(doc.get('images',[]))
 for before,after in zip(original.get('images',[]),doc.get('images',[])):
  assert before.get('name')==after.get('name'),'Ordre des textures modifié à vérifier'
  view=original['bufferViews'][before['bufferView']];image=data[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  while len(binary)%4:binary.append(0)
  doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(image)})
  after['bufferView']=len(doc['bufferViews'])-1;after['mimeType']=before['mimeType'];binary.extend(image);hashes.append(hashlib.sha256(image).hexdigest())
 while len(binary)%4:binary.append(0)
 # Enlever les images réencodées devenues inutiles ; conserver chaque texture originale une seule fois.
 used=set()
 def collect(value):
  if isinstance(value,dict):
   for key,item in value.items():
    if key=='bufferView':used.add(item)
    else:collect(item)
  elif isinstance(value,list):
   for item in value:collect(item)
 collect(doc);mapping={old:i for i,old in enumerate(sorted(used))};packed=bytearray();views=[]
 for index in sorted(used):
  view=dict(doc['bufferViews'][index]);start=view.get('byteOffset',0)
  while len(packed)%4:packed.append(0)
  views.append({**view,'byteOffset':len(packed)});packed.extend(binary[start:start+view['byteLength']])
 def remap(value):
  if isinstance(value,dict):
   for key,item in value.items():
    if key=='bufferView':value[key]=mapping[item]
    else:remap(item)
  elif isinstance(value,list):
   for item in value:remap(item)
 remap(doc);doc['bufferViews']=views;binary=packed
 while len(binary)%4:binary.append(0)
 doc.setdefault('asset',{}).setdefault('extras',{})['legendMotionPolish']=1
 doc['buffers'][0]['byteLength']=len(binary);encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 return struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary,hashes

def relaxed_guard(rig,amount):
 for side,sign in [('Left',1),('Right',-1)]:
  bone=next(b for b in rig.pose.bones if b.name.endswith(side+'Arm'))
  world=rig.matrix_world@bone.matrix;p=world.translation.copy()
  rotation=Quaternion(Vector((0,1,0)),.52*sign*amount).to_matrix().to_4x4()
  bone.matrix=rig.matrix_world.inverted()@Matrix.Translation(p)@rotation@Matrix.Translation(-p)@world
  bpy.context.view_layer.update()

def sample_pose(rig):return {b.name:(b.rotation_quaternion.copy(),b.location.copy()) for b in rig.pose.bones}
def short(q,reference):
 q=q.copy()
 if q.dot(reference)<0:q.negate()
 return q
def control(prev,current,next):
 inv=current.conjugated();v1=(inv@short(prev,current)).to_exponential_map();v2=(inv@short(next,current)).to_exponential_map()
 return current@Quaternion(-(v1+v2)*.25)
def interpolate(values,t,loop):
 n=len(values)-1;i=min(n-1,int(t*n));u=t*n-i
 prev=(i-1)%n if loop else max(0,i-1);after=(i+2)%n if loop else min(n,i+2)
 q0,p0=values[i];q1,p1=values[i+1];qm,pm=values[prev];qp,pp=values[after]
 c0=control(qm,q0,q1) if loop or i>0 else q0
 c1=control(q0,q1,qp) if loop or i+1<n else q1
 q=q0.slerp(short(q1,q0),u).slerp(c0.slerp(short(c1,c0),u),2*u*(1-u));q.normalize()
 # Hermite ; borner chaque composante pour empêcher le bassin de traverser les appuis.
 m0=(p1-pm)*.5;m1=(pp-p0)*.5
 p=p0*(2*u**3-3*u*u+1)+m0*(u**3-2*u*u+u)+p1*(-2*u**3+3*u*u)+m1*(u**3-u*u)
 p=Vector(tuple(max(min(p0[k],p1[k]),min(max(p0[k],p1[k]),p[k])) for k in range(3)))
 return q,p

def lupu_gait(rig,t):
 # Réutiliser les solveurs IK éprouvés du rig fourni, sans relancer le rigging ni la pondération.
 ns={'rig':rig,'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix,'Quaternion':Quaternion}
 if not hasattr(lupu_gait,'helpers'):
  source=(ROOT/'eredita3D/scripts/prepare_lupu.py').read_text();lupu_gait.helpers=source[source.index('def smooth('):source.index("CLIPS={'Repos'")]
 exec(lupu_gait.helpers,ns)
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update();ns['body_stance'](0,t,True)
 def stride(phase):
  phase%=1;stance=.62;reach=.27
  if phase<stance:return reach-2*reach*phase/stance,0
  u=(phase-stance)/(1-stance);m=-2*reach*(1-stance)/stance
  forward=(-reach)*(2*u**3-3*u*u+1)+m*(u**3-2*u*u+u)+reach*(-2*u**3+3*u*u)+m*(u**3-u*u)
  return forward,.10*math.sin(math.pi*u)**2
 for side,sign in [('Left',1),('Right',-1)]:
  y,z=stride(t+(0 if side=='Right' else .5));target=Vector((sign*.26,.39+y,.15+z))
  ns['ik']([side+'UpLeg',side+'Leg',side+'Foot'],target,Vector((sign*.5,-1,0)))
  foot=rig.pose.bones[side+'Foot'];ns['aim'](side+'Foot',foot.head+Vector((sign*.025,-.23,-.09)))
  y,z=stride(t+(0 if side=='Left' else .5));target=Vector((sign*.32,-.31+y,.10+z))
  ns['ik']([side+'Arm',side+'ForeArm',side+'Hand'],target,Vector((sign,.25,.05)))
  forearm=rig.pose.bones[side+'ForeArm'];ns['orient_palm'](side+'ForeArm',forearm.tail-forearm.head,(0,-1,0),1)
  hand=rig.pose.bones[side+'Hand'];direction=Vector((sign*.05,-1,-.2));ns['aim'](side+'Hand',hand.head+direction*.15);ns['orient_palm'](side+'Hand',direction,(0,0,-1),1)
 bpy.context.view_layer.update()

def main():
 report_path=ROOT/'eredita3D/logs/legend-motion-polish.json'
 report=json.loads(report_path.read_text()) if report_path.exists() else {}
 for kind,filename in FILES.items():
  path=ROOT/'assets/models'/filename;source=path.read_bytes()
  if read_glb(source)[0].get('asset',{}).get('extras',{}).get('legendMotionPolish')==1:
   print('ALREADY_POLISHED',kind,flush=True);continue
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=str(path));scene=bpy.context.scene;scene.render.fps=24
  rig=next(o for o in scene.objects if o.type=='ARMATURE')
  for track in rig.animation_data.nla_tracks:track.mute=True
  originals=list(bpy.data.actions);walk='Quatre_Pattes' if kind=='lupu' else 'Marche';data={}
  idle=next(a for a in originals if a.name=='Repos');rig.animation_data.action=idle;scene.frame_set(0);base=sample_pose(rig)
  for action in originals:
   name=action.name;rig.animation_data.action=action;start,end=action.frame_range;frames=max(1,round(end-start));poses=[]
   for frame in range(frames+1):
    scene.frame_set(math.floor(start+frame),subframe=(start+frame)%1);bpy.context.view_layer.update()
    if kind=='roccapina':
     t=frame/frames
     def smooth(a,b,x):
      u=max(0,min(1,(x-a)/(b-a)));return u*u*(3-2*u)
     amount=1
     if name.startswith('Frappe'):amount=1-smooth(0,.23,t)*(1-smooth(.60,1,t))
     elif name=='Mort':amount=1-smooth(.1,.7,t)
     relaxed_guard(rig,amount)
    pose=sample_pose(rig)
    for bone,(q,p) in pose.items():
     if kind!='lupu' and name==walk and (bone.endswith('UpLeg') or bone.endswith('Leg')):
      neutral=base[bone][0];delta=neutral.conjugated()@q
      if delta.w<0:delta.negate()
      q=neutral@Quaternion(delta.to_exponential_map()*(1.55 if bone.endswith('UpLeg') else 1.2));pose[bone]=(q,p)
     if poses:pose[bone]=(short(pose[bone][0],poses[-1][bone][0]),p)
    poses.append(pose)
   loop=name in ['Repos',walk]
   if loop:poses[-1]={bone:(short(q,poses[-2][bone][0]),p.copy()) for bone,(q,p) in poses[0].items()}
   data[name]={'duration':(end-start)/24,'poses':poses,'loop':loop}
  rig.animation_data.action=None
  for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
  for action in originals:bpy.data.actions.remove(action)
  scene.render.fps=FPS;seams={};generated={}
  for name,info in data.items():
   action=bpy.data.actions.new(name);rig.animation_data.action=action;count=round(info['duration']*FPS);first=None;last=None
   for frame in range(count+1):
    scene.frame_set(frame);t=frame/count
    if kind=='lupu' and name==walk:lupu_gait(rig,t)
    else:
     for b in rig.pose.bones:
      values=[pose[b.name] for pose in info['poses']];q,p=interpolate(values,t,info['loop']);b.rotation_quaternion=q;b.location=p
    if frame==0:first=sample_pose(rig)
    if frame==count:last=sample_pose(rig)
    for b in rig.pose.bones:
     b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
   if info['loop']:seams[name]={'rotation':max(first[n][0].rotation_difference(last[n][0]).angle for n in first),'position':max((first[n][1]-last[n][1]).length for n in first)}
   for layer in action.layers:
    for strip in layer.strips:
     for bag in strip.channelbags:
      for curve in bag.fcurves:
       for key in curve.keyframe_points:key.interpolation='LINEAR'
   generated[name]=action;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
  rig.animation_data.action=generated['Repos'];scene.frame_set(0)
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_nla_strips=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO')
  polished,images=preserve_images(source,path.read_bytes());path.write_bytes(polished)
  for seam in seams.values():assert seam['rotation']<.002 and seam['position']<.0001,seam
  report[kind]={'inputSha256':hashlib.sha256(source).hexdigest(),'sha256':hashlib.sha256(polished).hexdigest(),'bytes':len(polished),'fps':FPS,'clips':{n:info['duration'] for n,info in data.items()},'loops':seams,'originalImageSha256':images}
  print('POLISHED',kind,json.dumps(report[kind]),flush=True)
 report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
