"""Prepare the designer's ravager and axe locally in Blender 5.1.
Run with --source, --axe and --output-dir after Blender's -- separator.
Sources are read only; the output includes GLB, editable blend, sprite and previews.
"""
from pathlib import Path
import bpy,math,json,hashlib,struct,sys,argparse
from mathutils import Vector,Matrix,Quaternion
p=argparse.ArgumentParser();p.add_argument('--source',default='/Users/robin/Downloads/ravageur 3d.glb');p.add_argument('--axe',default='/Users/robin/Downloads/hache 3D.glb');p.add_argument('--output-dir',required=True);p.add_argument('--prepared-axe',help='Optional local inspection cache, already simplified to 2200 triangles.')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);ROOT=Path(a.output_dir).resolve();ROOT.mkdir(parents=True,exist_ok=True);SOURCE=Path(a.source).resolve();AXE=Path(a.axe).resolve()
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest();axe_hash=hashlib.sha256(AXE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCE));s=bpy.context.scene;s.render.fps=30
body=next(o for o in s.objects if o.type=='MESH');body.name='Ravageur_Fourni';rig=next(o for o in s.objects if o.type=='ARMATURE');rig.name='Ravageur_Squelette'
points=[body.matrix_world@v.co for v in body.data.vertices];low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));factor=1.80/(high.z-low.z);center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
root=bpy.data.objects.new('Ravageur_Normalisation',None);s.collection.objects.link(root)
for o in [o for o in s.objects if o.parent is None and o!=root]:world=o.matrix_world.copy();o.parent=root;o.matrix_world=world
root.matrix_world=Matrix.Scale(factor,4)@Matrix.Translation(-center);bpy.context.view_layer.update()
# A separate imported axe mesh is kept rigid on a dedicated hand child bone.
old=set(s.objects)
if a.prepared_axe:
 with bpy.data.libraries.load(str(Path(a.prepared_axe).resolve()),link=False) as (data_in,data_out):data_out.objects=[n for n in data_in.objects if n.startswith('tripo_node')]
 for o in data_out.objects:
  if o:s.collection.objects.link(o)
else:bpy.ops.import_scene.gltf(filepath=str(AXE))
axe=next(o for o in s.objects if o not in old and o.type=='MESH');axe.name='Hache_Fournie'
bpy.ops.object.select_all(action='DESELECT');axe.select_set(True);bpy.context.view_layer.objects.active=axe;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
if len(axe.data.polygons)>2300:
 mod=axe.modifiers.new('Optimisation_Hache','DECIMATE');mod.ratio=2200/len(axe.data.polygons);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
# Source haft runs from upper right to lower left. Align it vertically, with the blade forward.
source_grip=Vector((.15,0,.55));haft=Vector((-.8,0,-.5)).normalized();rotation=haft.rotation_difference(Vector((0,0,1))).to_matrix();turn=Matrix.Rotation(math.pi/2,3,'Z')
canonical=turn@rotation;grip_rest=rig.matrix_world@rig.data.bones['hand_r'].head_local
for v in axe.data.vertices:v.co=rig.matrix_world.inverted()@(grip_rest+(canonical@(v.co-source_grip))*.82)
axe.matrix_world=rig.matrix_world.copy()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
b=rig.data.edit_bones.new('axe');b.head=rig.matrix_world.inverted()@grip_rest;b.tail=b.head+rig.matrix_world.inverted().to_3x3()@Vector((0,0,.20));b.parent=rig.data.edit_bones['hand_r'];bpy.ops.object.mode_set(mode='OBJECT')
axe.vertex_groups.clear();g=axe.vertex_groups.new(name='axe');g.add(list(range(len(axe.data.vertices))),1,'REPLACE');world=axe.matrix_world.copy();axe.parent=rig;axe.matrix_world=world;mod=axe.modifiers.new('Hache_Attachee_Main','ARMATURE');mod.object=rig
body['source_sha256']=source_hash;axe['source_sha256']=axe_hash;axe['rigid_hand_attachment']='axe -> hand_r'
for ob in [body,axe]:
 for poly in ob.data.polygons:poly.use_smooth=True
# Keep original UVs and designs; fresh packed images ensure reduced texture bytes are exported.
images={n.image for ob in [body,axe] for mat in ob.data.materials for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
for old_image in images:
 _=old_image.pixels[0];maximum=1024;old_image.scale(maximum,maximum)
 name=('Ravageur_' if 'hooded' in old_image.name else 'Hache_')+('Normal' if 'normal' in old_image.name.lower() else 'BaseColor' if 'basecolor' in old_image.name.lower() else 'RoughnessMetallic')
 image=bpy.data.images.new(name,width=maximum,height=maximum,alpha=False);image.colorspace_settings.name=old_image.colorspace_settings.name;image.pixels.foreach_set(old_image.pixels[:]);image.file_format='PNG' if 'Normal' in name else 'JPEG';image.filepath_raw=str(ROOT/(name+('.png' if image.file_format=='PNG' else '.jpg')));image.save();image.pack()
 for ob in [body,axe]:
  for mat in ob.data.materials:
   for n in mat.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.image==old_image:n.image=image
for ob,name in [(body,'Ravageur_Texture_Originale'),(axe,'Hache_Bois_Texture')]:
 for m in ob.data.materials:
  m.name=name
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    n.inputs['Transmission Weight'].default_value=0;n.inputs['Alpha'].default_value=1
    for link in list(n.inputs['Alpha'].links):m.node_tree.links.remove(link)
axe.data.update();update_view=bpy.context.view_layer.update()
metal=axe.data.materials[0].copy();metal.name='Hache_Acier_Texture';axe.data.materials.append(metal)
for face in axe.data.polygons:
 world=axe.matrix_world@face.center
 if (world-grip_rest).z>.27:face.material_index=1
for b in rig.pose.bones:b.rotation_mode='QUATERNION'

def update():bpy.context.view_layer.update()
def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def align_joint(name,child,target):
 b=rig.pose.bones[name];end=rig.pose.bones[child].head;goal=rig.matrix_world.inverted()@Vector(target);q=(end-b.head).normalized().rotation_difference((goal-b.head).normalized())@b.matrix.to_quaternion();b.matrix=Matrix.LocRotScale(b.head,q,b.matrix.to_scale());update()
def arm(side,target):
 upper,fore,hand=['upperarm_'+side,'lowerarm_'+side,'hand_'+side];a,b,c=[rig.matrix_world@rig.pose.bones[n].head for n in [upper,fore,hand]];l1=(b-a).length;l2=(c-b).length;direction=(target-a).normalized();distance=min(l1+l2-.001,max(abs(l1-l2)+.001,(target-a).length));goal=a+direction*distance
 pole=Vector((-1 if side=='r' else 1,.15,-.10));perp=(pole-direction*pole.dot(direction)).normalized();along=(l1*l1-l2*l2+distance*distance)/(2*distance);elbow=a+direction*along+perp*math.sqrt(max(0,l1*l1-along*along))
 align_joint(upper,fore,elbow);align_joint(fore,hand,goal)
def rotate_world(name,axis,angle):
 b=rig.pose.bones[name];rest=b.bone.matrix_local;delta=b.parent.matrix@b.parent.bone.matrix_local.inverted() if b.parent else Matrix.Identity(4);axis=(rig.matrix_world.to_3x3().inverted()@Vector(axis)).normalized();b.matrix=delta@Matrix.Translation(rest.translation)@Quaternion(axis,angle).to_matrix().to_4x4()@rest.to_quaternion().to_matrix().to_4x4();update()
def hand_fingers(side):
 hand=rig.pose.bones['hand_'+side];delta=hand.matrix@hand.bone.matrix_local.inverted();normal=(delta.to_3x3()@(rig.matrix_world.inverted().to_3x3()@Vector((0,0,-1)))).normalized()
 for finger in ['index','middle','ring','pinky']:
  one=rig.pose.bones[finger+'_01_'+side];two=rig.pose.bones[finger+'_02_'+side];forward=(two.head-one.head).normalized()
  for i,angle in [(1,.75),(2,1.45)]:
   name=finger+'_'+str(i).zfill(2)+'_'+side;child=finger+'_'+str(i+1).zfill(2)+'_'+side;b=rig.pose.bones[name];length=(rig.pose.bones[child].head-b.head).length;direction=forward*math.cos(angle)+normal*math.sin(angle);target=rig.matrix_world@(b.head+direction*length);align_joint(name,child,target)

def pose(kind,t):
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 update();wave=math.sin(t*math.tau)
 if kind=='Repos':rotate_world('spine_03',(1,0,0),wave*.012)
 if kind=='Marche':
  for side,sign in [('l',1),('r',-1)]:
   rotate_world('thigh_'+side,(1,0,0),wave*sign*.28);rotate_world('calf_'+side,(1,0,0),max(0,-wave*sign)*.43)
  rotate_world('spine_03',(0,0,1),wave*.035)
 strength=smooth(0,.23,t)*(1-smooth(.72,1,t)) if kind=='Coup_Hache' else 0;strike=smooth(.25,.62,t) if kind=='Coup_Hache' else 0
 if kind=='Coup_Hache':rotate_world('spine_03',(0,0,1),strength*(.10-.22*strike));rotate_world('spine_05',(1,0,0),strength*strike*.11)
 for side,sign in [('r',-1),('l',1)]:
  shoulder=rig.matrix_world@rig.pose.bones['upperarm_'+side].head;target=shoulder+Vector((sign*.10,-.10,-.45))
  if kind=='Marche':target.y+=wave*sign*.10
  if side=='r' and kind=='Coup_Hache':target=target.lerp(Vector((-.28,-.02,1.61)).lerp(Vector((-.16,-.47,1.06)),strike),strength)
  arm(side,target)
  wrist=rig.matrix_world@rig.pose.bones['hand_'+side].head;direction=Vector((sign*.015,-.03,-.12));align_joint('hand_'+side,'middle_metacarpal_'+side,wrist+direction);hand_fingers(side)
 # Independent hand child keeps the axe solid through all poses.
 grip=rig.matrix_world@rig.pose.bones['hand_r'].head+Vector((0,-.02,-.08));tilt=-.10
 if kind=='Coup_Hache':tilt=(-.48+1.95*strike)*strength-.1*(1-strength)
 if kind=='Marche':tilt+=wave*.08
 b=rig.pose.bones['axe'];world=Matrix.Translation(grip)@Matrix.Rotation(tilt,4,'X');rest_orientation=(rig.matrix_world@b.bone.matrix_local).to_quaternion().to_matrix().to_4x4();world=world@rest_orientation;m=rig.matrix_world.inverted()@world;b.matrix=Matrix.LocRotScale(m.translation,m.to_quaternion(),Vector((1,1,1)));update()
 if kind=='Mort':
  fall=smooth(.08,.88,t);rotate_world('root',(0,1,0),fall*1.48)
  evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());floor=min((evaluated.matrix_world@Vector(p)).z for p in evaluated.bound_box);root_b=rig.pose.bones['root'];m=root_b.matrix.copy();m.translation+=rig.matrix_world.inverted().to_3x3()@Vector((0,0,-floor));root_b.matrix=m;update()

CLIPS={'Repos':60,'Marche':30,'Coup_Hache':30,'Mort':54};actions={};rig.animation_data_create()
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
file=ROOT/'ravageur.glb';bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO',export_image_quality=90)
raw=file.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);assert set(a['name'] for a in doc['animations'])==set(CLIPS);assert doc.get('skins');triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
report={'source':str(SOURCE),'source_sha256':source_hash,'axe_source':str(AXE),'axe_source_sha256':axe_hash,'triangles':triangles,'body_triangles':9399,'axe_triangles':len(axe.data.polygons),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'bones':len(doc['skins'][0]['joints']),'clips':list(CLIPS),'texture_size':1024,'height_m':1.8,'simulation_changes':False};(ROOT/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'ravageur.blend'))
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('Studio');s.world.color=(.18,.18,.18);s.view_settings.view_transform='AgX'
for name,pos,power in [('Key',(-3,-4,5),650),('Fill',(3,-2,3),350),('Rim',(1,3,4),550)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Preview');d.type='ORTHO';d.ortho_scale=2.65;o=bpy.data.objects.new('Preview',d);s.collection.objects.link(o);s.camera=o;o.location=(2.2,-5,1.9);o.rotation_euler=(Vector((0,0,1.05))-o.location).to_track_quat('-Z','Y').to_euler()
for name,frame in [('Repos',0),('Marche',8),('Coup_Hache',8),('Coup_Hache',18)]:
 rig.animation_data.action=actions[name];s.frame_set(frame);s.render.filepath=str(ROOT/(name.lower()+'-'+str(frame)+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=actions['Repos'];s.frame_set(0);d.ortho_scale=2.05;o.rotation_euler=(Vector((0,0,.90))-o.location).to_track_quat('-Z','Y').to_euler();s.render.film_transparent=True;s.render.resolution_x=s.render.resolution_y=512;s.render.filepath=str(ROOT/'ravageur-sprite.png');bpy.ops.render.render(write_still=True)
