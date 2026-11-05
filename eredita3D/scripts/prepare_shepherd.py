"""Animate the supplied shepherd locally, preserving its native rig, UVs and clothes.
Blender --background --python prepare_shepherd.py -- --source PATH --output-dir PATH
"""
from pathlib import Path
import bpy,math,json,hashlib,struct,sys,argparse
from mathutils import Vector,Matrix,Quaternion
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output-dir',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);SOURCE=Path(a.source).resolve();ROOT=Path(a.output_dir).resolve();ROOT.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest();bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCE));s=bpy.context.scene;s.render.fps=30
body=next(o for o in s.objects if o.type=='MESH');body.name='Berger_Fourni';rig=next(o for o in s.objects if o.type=='ARMATURE');rig.name='Berger_Squelette'
points=[body.matrix_world@v.co for v in body.data.vertices];low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));factor=1.8/(high.z-low.z);center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
root=bpy.data.objects.new('Berger_Normalisation',None);s.collection.objects.link(root)
for o in [o for o in s.objects if o.parent is None and o!=root]:world=o.matrix_world.copy();o.parent=root;o.matrix_world=world
root.matrix_world=Matrix.Scale(factor,4)@Matrix.Translation(-center);bpy.context.view_layer.update();body['source_sha256']=source_hash
for poly in body.data.polygons:poly.use_smooth=True
for material in body.data.materials:
 material.name='Berger_Texture_Originale'
 for node in material.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image:
   old=node.image;_=old.pixels[0];old.scale(1024,1024)
   image=bpy.data.images.new('Berger_BaseColor',width=1024,height=1024,alpha=False);image.colorspace_settings.name=old.colorspace_settings.name;image.pixels.foreach_set(old.pixels[:]);image.file_format='JPEG';image.filepath_raw=str(ROOT/'berger-basecolor.jpg');image.save();image.pack();node.image=image
  if node.type=='BSDF_PRINCIPLED':
   node.inputs['Alpha'].default_value=1
   for link in list(node.inputs['Alpha'].links):material.node_tree.links.remove(link)
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
rest_feet={side:(rig.matrix_world@rig.data.bones['foot_'+side].head_local).copy() for side in ['l','r']}
def update():bpy.context.view_layer.update()
def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def align_joint(name,child,target):
 b=rig.pose.bones[name];end=rig.pose.bones[child].head;goal=rig.matrix_world.inverted()@Vector(target);q=(end-b.head).normalized().rotation_difference((goal-b.head).normalized())@b.matrix.to_quaternion();b.matrix=Matrix.LocRotScale(b.head,q,b.matrix.to_scale());update()
def rotate_world(name,axis,angle):
 b=rig.pose.bones[name];rest=b.bone.matrix_local;delta=b.parent.matrix@b.parent.bone.matrix_local.inverted() if b.parent else Matrix.Identity(4);axis=(rig.matrix_world.to_3x3().inverted()@Vector(axis)).normalized();b.matrix=delta@Matrix.Translation(rest.translation)@Quaternion(axis,angle).to_matrix().to_4x4()@rest.to_quaternion().to_matrix().to_4x4();update()
def chain(upper,lower,end,target,pole):
 a,b,c=[rig.matrix_world@rig.pose.bones[n].head for n in [upper,lower,end]];l1=(b-a).length;l2=(c-b).length;direction=(target-a).normalized();distance=min(l1+l2-.001,max(abs(l1-l2)+.001,(target-a).length));goal=a+direction*distance
 pole=Vector(pole);perp=(pole-direction*pole.dot(direction)).normalized();along=(l1*l1-l2*l2+distance*distance)/(2*distance);elbow=a+direction*along+perp*math.sqrt(max(0,l1*l1-along*along));align_joint(upper,lower,elbow);align_joint(lower,end,goal)
def fingers(side,amount):
 hand=rig.pose.bones['hand_'+side];delta=hand.matrix@hand.bone.matrix_local.inverted();normal=(delta.to_3x3()@(rig.matrix_world.inverted().to_3x3()@Vector((0,0,-1)))).normalized()
 for finger in ['index','middle','ring','pinky']:
  first=rig.pose.bones[finger+'_01_'+side];second=rig.pose.bones[finger+'_02_'+side];forward=(second.head-first.head).normalized()
  for i,angle in [(1,amount*.5),(2,amount)]:
   name=finger+'_'+str(i).zfill(2)+'_'+side;child=finger+'_'+str(i+1).zfill(2)+'_'+side;b=rig.pose.bones[name];length=(rig.pose.bones[child].head-b.head).length;direction=forward*math.cos(angle)+normal*math.sin(angle);align_joint(name,child,rig.matrix_world@(b.head+direction*length))
def pose(kind,t):
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 update();wave=math.sin(t*math.tau)
 if kind=='Repos':rotate_world('spine_03',(1,0,0),wave*.012)
 if kind=='Marche':
  for side,sign in [('l',1),('r',-1)]:
   rotate_world('thigh_'+side,(1,0,0),wave*sign*.28);rotate_world('calf_'+side,(1,0,0),max(0,-wave*sign)*.43)
  rotate_world('spine_03',(0,0,1),wave*.035)
 if kind=='Traite':
  pelvis=rig.pose.bones['pelvis'];m=pelvis.matrix.copy();m.translation+=rig.matrix_world.inverted().to_3x3()@Vector((0,0,-.22+wave*.008));pelvis.matrix=m;update()
  rotate_world('spine_03',(1,0,0),.18);rotate_world('spine_05',(1,0,0),.08)
  for side in ['l','r']:
   chain('thigh_'+side,'calf_'+side,'foot_'+side,rest_feet[side],(0,-1,.05));b=rig.pose.bones['foot_'+side];b.matrix=Matrix.LocRotScale(b.head,b.bone.matrix_local.to_quaternion(),b.matrix.to_scale());update()
 strike=smooth(.22,.58,t) if kind=='Frappe' else 0;strength=smooth(0,.20,t)*(1-smooth(.72,1,t)) if kind=='Frappe' else 0
 if kind=='Frappe':rotate_world('spine_03',(0,0,1),strength*(.10-.25*strike));rotate_world('spine_05',(1,0,0),strength*strike*.1)
 for side,sign in [('r',-1),('l',1)]:
  shoulder=rig.matrix_world@rig.pose.bones['upperarm_'+side].head;target=shoulder+Vector((sign*.1,-.1,-.45))
  if kind=='Marche':target.y+=wave*sign*.11
  if kind=='Traite':target=Vector((sign*.15,-.40,.78+wave*sign*.035))
  if kind=='Frappe' and side=='r':target=target.lerp(Vector((-.26,-.12,1.4)).lerp(Vector((-.10,-.60,1.2)),strike),strength)
  chain('upperarm_'+side,'lowerarm_'+side,'hand_'+side,target,(-1 if side=='r' else 1,.15,-.1));wrist=rig.matrix_world@rig.pose.bones['hand_'+side].head;align_joint('hand_'+side,'middle_metacarpal_'+side,wrist+Vector((sign*.015,-.035,-.12)));fingers(side,.35 if kind not in ['Frappe','Traite'] else .95)
 if kind=='Mort':
  rotate_world('root',(0,1,0),smooth(.08,.88,t)*1.48)
  evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());floor=min((evaluated.matrix_world@Vector(p)).z for p in evaluated.bound_box);b=rig.pose.bones['root'];m=b.matrix.copy();m.translation+=rig.matrix_world.inverted().to_3x3()@Vector((0,0,-floor));b.matrix=m;update()
CLIPS={'Repos':60,'Marche':30,'Traite':90,'Frappe':30,'Mort':54};actions={};rig.animation_data_create()
for name,end in CLIPS.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,end+1,2):
  s.frame_set(frame);pose(name,frame/end)
  for b in rig.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 actions[name]=action;rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Repos'];s.frame_set(0);pose('Repos',0)
bpy.ops.object.select_all(action='DESELECT')
for ob in [root]+list(root.children_recursive):ob.select_set(True)
bpy.context.view_layer.objects.active=rig
file=ROOT/'berger.glb';bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO',export_image_quality=90)
raw=file.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);assert set(a['name']for a in doc['animations'])==set(CLIPS);triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes']for p in m['primitives'])
report={'source':str(SOURCE),'source_sha256':source_hash,'triangles':triangles,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'bones':len(doc['skins'][0]['joints']),'clips':list(CLIPS),'texture_size':1024,'height_m':1.8,'simulation_changes':False};(ROOT/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'berger.blend'))
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('Studio');s.world.color=(.18,.18,.18);s.view_settings.view_transform='AgX'
for name,pos,power in [('Key',(-3,-4,5),650),('Fill',(3,-2,3),350),('Rim',(1,3,4),550)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Preview');d.type='ORTHO';d.ortho_scale=2.5;o=bpy.data.objects.new('Preview',d);s.collection.objects.link(o);s.camera=o;o.location=(2.2,-5,1.9);o.rotation_euler=(Vector((0,0,1.0))-o.location).to_track_quat('-Z','Y').to_euler()
for name,frame in [('Repos',0),('Marche',8),('Traite',22),('Frappe',14),('Mort',48)]:
 rig.animation_data.action=actions[name];s.frame_set(frame)
 if name=='Mort':
  evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();points=[evaluated.matrix_world@v.co for v in mesh.vertices];low=Vector(tuple(min(p[i]for p in points)for i in range(3)));high=Vector(tuple(max(p[i]for p in points)for i in range(3)));evaluated.to_mesh_clear();target=(low+high)/2;o.location=target+Vector((2.2,-5,2.7));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();d.ortho_scale=2.4
 s.render.filepath=str(ROOT/(name.lower()+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=actions['Repos'];s.frame_set(0);o.location=(2.2,-5,1.9);d.ortho_scale=2.05;o.rotation_euler=(Vector((0,0,.90))-o.location).to_track_quat('-Z','Y').to_euler();s.render.film_transparent=True;s.render.resolution_x=s.render.resolution_y=512;s.render.filepath=str(ROOT/'berger-sprite.png');bpy.ops.render.render(write_still=True)
