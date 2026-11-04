"""Prepare the designer's GLB locally with Blender 5.1.
Use --source SOURCE.glb --output-dir OUTPUT after Blender's -- separator.
The input is left unchanged; output includes an animated GLB, Blender file and previews.
"""
from pathlib import Path
import bpy, json, sys
from mathutils import Vector
import argparse
parser=argparse.ArgumentParser(description='Prepare the supplied human GLB for Eredità.')
parser.add_argument('--source',required=True)
parser.add_argument('--output-dir',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
SOURCE=Path(args.source).resolve()
ROOT=Path(args.output_dir).resolve();ROOT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=body;body.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
original=len(body.data.polygons)
m=body.modifiers.new('Optimisation_Jeu','DECIMATE');m.ratio=18000/original;m.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=m.name)
points=[body.matrix_world@v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
for v in body.data.vertices:v.co=(body.matrix_world@v.co-center)*(1.80/(high.z-low.z))
body.matrix_world.identity();body.name='Agriculteur';body.data.name='Agriculteur_mesh'
for p in body.data.polygons:p.use_smooth=True
for mat in body.data.materials:
 mat.name='Agriculteur_Texture_Originale'
 if mat.use_nodes:
  for node in mat.node_tree.nodes:
   if node.type=='BSDF_PRINCIPLED':
    for name in ['Alpha','Transmission Weight']:
     if name in node.inputs:
      for link in list(node.inputs[name].links):mat.node_tree.links.remove(link)
      node.inputs[name].default_value=1 if name=='Alpha' else 0
for old in list(bpy.data.images):
 if old.type!='IMAGE':continue
 _=old.pixels[0];old.scale(1024,1024)
 normal='normal' in old.name.lower();name='normal' if normal else ('basecolor' if 'basecolor' in old.name else 'roughness_metallic')
 image=bpy.data.images.new('Agriculteur_'+name,width=1024,height=1024,alpha=False)
 image.colorspace_settings.name=old.colorspace_settings.name;image.pixels.foreach_set(old.pixels[:])
 image.file_format='PNG' if normal else 'JPEG';image.filepath_raw=str(ROOT/(name+('.png' if normal else '.jpg')));image.save();image.pack()
 for mat in bpy.data.materials:
  if mat.use_nodes:
   for node in mat.node_tree.nodes:
    if node.type=='TEX_IMAGE' and node.image==old:node.image=image
 bpy.data.images.remove(old)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'farmer-source.blend'))

import bmesh, math, struct, hashlib
from mathutils import Matrix, Quaternion
from mathutils.kdtree import KDTree
def activate(obj):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)

def make_rig():
 data=bpy.data.armatures.new('Squelette_Agriculteur');rig=bpy.data.objects.new('Rig_Agriculteur',data);bpy.context.scene.collection.objects.link(rig)
 activate(rig);bpy.ops.object.mode_set(mode='EDIT')
 specs=[('root',(0,0,0),(0,0,.12),None),('pelvis',(0,.015,.94),(0,.015,1.04),'root'),
 ('spine',(0,.015,1.04),(0,0,1.22),'pelvis'),('chest',(0,0,1.22),(0,0,1.40),'spine'),
 ('neck',(0,0,1.40),(0,0,1.50),'chest'),('head',(0,0,1.50),(0,0,1.79),'neck')]
 for sign,label in [(-1,'R'),(1,'L')]:
  def p(x,y,z):return (sign*x,y,z)
  specs += [('clavicle.'+label,(0,0,1.38),p(.23,0,1.35),'chest'),
   ('upper_arm.'+label,p(.23,0,1.35),p(.51,0,1.34),'clavicle.'+label),
   ('forearm.'+label,p(.51,0,1.34),p(.755,-.005,1.335),'upper_arm.'+label),
   ('hand.'+label,p(.755,-.005,1.335),p(.90,-.01,1.33),'forearm.'+label),
   ('thigh.'+label,p(.14,.015,.94),p(.185,.025,.53),'pelvis'),
   ('shin.'+label,p(.185,.025,.53),p(.19,.035,.135),'thigh.'+label),
   ('foot.'+label,p(.19,.035,.135),p(.20,-.17,.055),'shin.'+label)]
 for name,head,tail,parent in specs:
  b=data.edit_bones.new(name);b.head=head;b.tail=tail
  if parent:b.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 for b in rig.pose.bones:b.rotation_mode='QUATERNION'
 return rig

def bind(body,rig):
 # Heat weights on a watertight voxel proxy avoid disconnected UV islands and hat rims.
 proxy=body.copy();proxy.data=body.data.copy();bpy.context.scene.collection.objects.link(proxy);activate(proxy)
 mod=proxy.modifiers.new('Volume_Ponderation','REMESH');mod.mode='VOXEL';mod.voxel_size=.017
 bpy.ops.object.modifier_apply(modifier=mod.name)
 bm=bmesh.new();bm.from_mesh(proxy.data);pending=set(bm.verts);components=[]
 while pending:
  v=pending.pop();part={v};stack=[v]
  while stack:
   v=stack.pop()
   for e in v.link_edges:
    other=e.other_vert(v)
    if other in pending:pending.remove(other);part.add(other);stack.append(other)
  components.append(part)
 largest=max(components,key=len);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in largest],context='VERTS');bm.to_mesh(proxy.data);bm.free()
 rig.data.bones['root'].use_deform=False
 activate(proxy);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
 rig.data.bones['root'].use_deform=True
 assert all(v.groups for v in proxy.data.vertices),'Incomplete proxy weights'
 tree=KDTree(len(proxy.data.vertices))
 for v in proxy.data.vertices:tree.insert(v.co,v.index)
 tree.balance();groups={b.name:body.vertex_groups.new(name=b.name) for b in rig.data.bones};names={g.index:g.name for g in proxy.vertex_groups}
 for v in body.data.vertices:
  weights={}
  for _,index,distance in tree.find_n(v.co,4):
   f=1/max(.001,distance)**2
   for g in proxy.data.vertices[index].groups:
    name=names[g.group];weights[name]=weights.get(name,0)+g.weight*f
  x,y,z=v.co
  # Keep face, hair and straw hat rigid. Smooth neck and shoulder transitions remain deformable.
  if z>1.50:weights={'head':1}
  elif abs(x)<.18 and z>1.40:
   t=smooth(1.40,1.52,z);weights={'neck':1-t,'head':t}
  elif abs(x)<.17 and 1.04<z<=1.40:
   t=smooth(1.10,1.29,z);weights={'spine':1-t,'chest':t}
  elif abs(x)<.23 and .89<z<=1.04:weights={'pelvis':1}
  weights=sorted(weights.items(),key=lambda x:x[1],reverse=True)[:4];total=sum(w for _,w in weights)
  assert total>0
  for name,w in weights:groups[name].add([v.index],w/total,'REPLACE')
 bpy.data.objects.remove(proxy,do_unlink=True);body.parent=rig
 mod=body.modifiers.new('Deformation_Squelette','ARMATURE');mod.object=rig

def update():bpy.context.view_layer.update()

def orient(rig,name,direction):
 b=rig.pose.bones[name];rest=b.bone.matrix_local
 head=(b.parent.matrix@b.parent.bone.matrix_local.inverted()@rest).translation if b.parent else rest.translation
 original=(b.bone.tail_local-b.bone.head_local).normalized()
 rotation=original.rotation_difference(Vector(direction).normalized())
 b.matrix=Matrix.Translation(head)@rotation.to_matrix().to_4x4()@rest.to_quaternion().to_matrix().to_4x4();update()

def rotate(rig,name,axis,angle):
 b=rig.pose.bones[name];r=b.bone.matrix_local
 delta=b.parent.matrix@b.parent.bone.matrix_local.inverted() if b.parent else Matrix.Identity(4)
 b.matrix=delta@Matrix.Translation(r.translation)@Quaternion(Vector(axis),angle).to_matrix().to_4x4()@r.to_quaternion().to_matrix().to_4x4();update()

def two_bone(rig,upper,lower,target,pole):
 a=rig.pose.bones[upper];b=rig.pose.bones[lower];start=a.head.copy();target=Vector(target)
 axis=target-start;distance=min(a.length+b.length-.0001,max(abs(a.length-b.length)+.0001,axis.length));axis.normalize()
 pole=Vector(pole);bend=pole-axis*pole.dot(axis);bend.normalize()
 along=(a.length*a.length-b.length*b.length+distance*distance)/(2*distance)
 knee=start+axis*along+bend*math.sqrt(max(0,a.length*a.length-along*along))
 orient(rig,upper,knee-start);orient(rig,lower,target-rig.pose.bones[lower].head)

def flat_foot(rig,name):
 b=rig.pose.bones[name];b.matrix=Matrix.Translation(b.head)@b.bone.matrix_local.to_quaternion().to_matrix().to_4x4();update()

def pose(rig,kind,t):
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 update();wave=math.sin(math.tau*t)
 squat=smooth(.015,.27,t)*(1-smooth(.77,.985,t)) if kind=='Recolte' else 0
 rig.pose.bones['pelvis'].location=Vector((0,.12*squat,-.45*squat)) # Set in armature coordinates below.
 pelvis=rig.pose.bones['pelvis'];pelvis.matrix=Matrix.Translation(Vector((0,.015+.13*squat,.94-.45*squat)))@pelvis.bone.matrix_local.to_quaternion().to_matrix().to_4x4();update()
 if kind=='Repos':rotate(rig,'chest',(1,0,0),wave*.012)
 if kind=='Marche':
  pelvis.matrix.translation.z+=.012*(1-math.cos(math.tau*t*2));update();rotate(rig,'chest',(0,0,1),wave*.05)
 if kind=='Recolte':
  rotate(rig,'spine',(1,0,0),math.radians(23)*squat)
  rotate(rig,'chest',(1,0,0),math.radians(19)*squat)
  rotate(rig,'neck',(1,0,0),math.radians(-14)*squat)
 # Foot targets stay planted during the squat. Knees bend forwards, outside the apron.
 for sign,label in [(-1,'R'),(1,'L')]:
  stride=wave*sign if kind=='Marche' else 0;lift=max(0,math.cos(math.tau*t+(0 if sign==1 else math.pi)))*.075 if kind=='Marche' else 0
  two_bone(rig,'thigh.'+label,'shin.'+label,(sign*.19,.035+stride*.16,.135+lift),(sign*.23,-1,0))
  flat_foot(rig,'foot.'+label)
  shoulder=rig.pose.bones['upper_arm.'+label].head.copy()
  # Relaxed arms hang by the body with a small natural elbow bend.
  hand=shoulder+Vector((sign*.09,-.06+stride*.12,-.50))
  if kind=='Recolte':
   pulse=.5+.5*math.sin((t-.30)*math.tau*3)
   reach=Vector((sign*.20,-.47-(.06*pulse if sign==-1 else 0),.24+.10*(1-pulse))) if sign==-1 else Vector((sign*.23,-.24,.47))
   hand=hand.lerp(reach,squat)
  if kind=='Frappe' and sign==-1:
   strike=smooth(.05,.38,t)*(1-smooth(.48,.96,t));hand=hand.lerp(shoulder+Vector((-.08,-.51,-.10)),strike)
  two_bone(rig,'upper_arm.'+label,'forearm.'+label,hand,(sign*.4,.2,-.5))
  orient(rig,'hand.'+label,(sign*.03,-.03,-.13))
 if kind=='Mort':
  fall=smooth(.08,.90,t);rotate(rig,'root',(0,1,0),fall*1.48)
  evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());floor=min((evaluated.matrix_world@Vector(p)).z for p in evaluated.bound_box)
  rig.pose.bones['root'].location.y-=floor;update()
 update()

rig=make_rig();bind(body,rig)
CLIPS={'Repos':60,'Marche':30,'Recolte':108,'Frappe':24,'Mort':54};actions={};rig.animation_data_create();bpy.context.scene.render.fps=30
for name,end in CLIPS.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,end+1,2):
  bpy.context.scene.frame_set(frame);pose(rig,name,frame/end)
  for b in rig.pose.bones:
   b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
 actions[name]=action;rig.animation_data.action=None
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=None
activate(rig);body.select_set(True)
export=ROOT/'agriculteur.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_def_bones=True,export_morph=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_image_quality=90,export_yup=True)
raw=export.read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert {a['name'] for a in j['animations']}==set(CLIPS)
assert j.get('skins') and all('JOINTS_0' in p['attributes'] for m in j['meshes'] for p in m['primitives'])
report={'source':str(SOURCE),'source_sha256':hashlib.sha256(Path(str(SOURCE)).read_bytes()).hexdigest(),'source_triangles':1927428,'triangles':sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives']),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'bones':len(j['skins'][0]['joints']),'clips':[a['name'] for a in j['animations']],'texture_size':[1024,1024],'height_m':1.8,'simulation_changes':False}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report),flush=True)
rig.animation_data.action=actions['Repos'];bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'agriculteur.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.world.color=(.16,.16,.16);s.view_settings.view_transform='AgX'
for name,position,power,size in [('Key',(-3,-4,5),650,4),('Fill',(3,-2,3),350,3),('Rim',(1,3,4),650,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Preview');c=bpy.data.objects.new('Preview',d);s.collection.objects.link(c);s.camera=c;d.type='ORTHO';d.ortho_scale=2.08
c.location=(2.6,-5,1.65);c.rotation_euler=(Vector((0,0,.89))-c.location).to_track_quat('-Z','Y').to_euler()
for kind,frame in [('Repos',0),('Marche',8),('Recolte',45),('Recolte',64)]:
 rig.animation_data.action=actions[kind];s.frame_set(frame);s.render.filepath=str(ROOT/(kind.lower()+'-'+str(frame)+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=actions['Repos'];s.frame_set(0);s.render.film_transparent=True;s.render.resolution_x=s.render.resolution_y=512;s.render.filepath=str(ROOT/'agriculteur-sprite.png');bpy.ops.render.render(write_still=True)
