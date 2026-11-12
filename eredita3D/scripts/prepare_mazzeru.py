"""Prépare localement Mazzeru et son arc fournis, sans modifier les originaux."""
import bpy,math,json,hashlib,struct
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path('/Users/robin/Downloads/mazzeru 3d.glb')
SWORD=Path('/Users/robin/Downloads/arc 3d.glb')
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE,SWORD)}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.render.fps=24
rig=next(o for o in scene.objects if o.type=='ARMATURE')
bodies=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
# Forme de contrôle de l’importeur : invisible, mais elle fausserait la taille et le sol.
for o in list(scene.objects):
 if o.type=='MESH' and o not in bodies:bpy.data.objects.remove(o,do_unlink=True)
points=[]
depsgraph=bpy.context.evaluated_depsgraph_get()
for o in bodies:
 evaluated=o.evaluated_get(depsgraph);mesh=evaluated.to_mesh()
 points.extend(evaluated.matrix_world@v.co for v in mesh.vertices);evaluated.to_mesh_clear()
lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
root=bpy.data.objects.new('Mazzeru_Normalisation',None);scene.collection.objects.link(root)
for o in list(scene.objects):
 if o!=root and o.parent is None:
  world=o.matrix_world.copy();o.parent=root;o.matrix_world=world
root.scale=(1.8/(hi.z-lo.z),)*3;root.location=-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))*root.scale.x
bpy.context.view_layer.update()
before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(SWORD));sword=next(o for o in scene.objects if o not in before and o.type=='MESH');sword.name='Arc_Mazzeru_Fourni'
bpy.context.view_layer.objects.active=sword
bpy.ops.object.select_all(action='DESELECT');sword.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
source_triangles=sum(len(p.vertices)-2 for p in sword.data.polygons)
modifier=sword.modifiers.new('Epee_Optimisation_6000','DECIMATE');modifier.ratio=min(1,6000/source_triangles);modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
# Arc original vertical ; prise au milieu de la poignée.
points=[sword.matrix_world@v.co for v in sword.data.vertices];low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
grip=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z+(high.z-low.z)*.50))
rotation=Vector((0,0,1)).rotation_difference(Vector((0,.5,.866)).normalized()).to_matrix()
for v in sword.data.vertices:v.co=rotation@((sword.matrix_world@v.co-grip)*(1.10/(high.z-low.z)))
sword.matrix_world=Matrix.Identity(4)
for image in list(bpy.data.images):
 if image.type!='IMAGE' or max(image.size)<=1024:continue
 ratio=1024/max(image.size);image.scale(max(1,round(image.size[0]*ratio)),max(1,round(image.size[1]*ratio)))
 # L’exporteur encode les pixels redimensionnés, sans réutiliser l’image empaquetée originale.
 image.pack()
hand=rig.pose.bones['mixamorig:LeftHand'];hand_world=rig.matrix_world@hand.matrix
# Blender parente au bout de l’os : inverse explicite pour garder la prise dans la paume.
parent_world=hand_world@Matrix.Translation((0,hand.length,0))
palm=hand_world@Vector((0,hand.length*.45,0))
sword.parent=rig;sword.parent_type='BONE';sword.parent_bone=hand.name
sword.matrix_parent_inverse=parent_world.inverted();sword.matrix_basis=Matrix.Translation(palm)
bpy.context.view_layer.update()
axes={b.name:b.bone.matrix_local.to_quaternion().inverted() for b in rig.pose.bones};arm_inverse=rig.matrix_world.to_3x3().inverted()
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
base_basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
def rotate(name,axis,angle):
 b=rig.pose.bones.get('mixamorig:'+name)
 if b:b.rotation_quaternion=b.rotation_quaternion@Quaternion((axes[b.name]@(arm_inverse@Vector(axis))).normalized(),angle)
def smooth(a,b,t):
 x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)
def pose(kind,t):
 for b in rig.pose.bones:b.matrix_basis=base_basis[b.name].copy()
 wave=math.sin(t*math.tau)
 if kind!='Tir':
  rotate('LeftArm',(0,1,0),1.05);rotate('RightArm',(0,1,0),-1.05)
  rotate('LeftForeArm',(0,0,1),-.1);rotate('RightForeArm',(0,0,1),.1)
 if kind=='Repos':rotate('Spine',(1,0,0),wave*.012)
 elif kind=='Marche':
  rotate('Hips',(0,0,1),wave*.035)
  for side,sign in [('Left',1),('Right',-1)]:
   stride=wave*sign;rotate(side+'UpLeg',(1,0,0),-stride*.32);rotate(side+'Leg',(1,0,0),max(0,-stride)*.4)
   rotate(side+'Arm',(1,0,0),stride*.12);rotate(side+'ForeArm',(1,0,0),-.12)
 elif kind=='Tir':
  amount=smooth(0,.2,t)*(1-smooth(.65,1,t));draw=smooth(.2,.5,t)*(1-smooth(.52,.64,t))
  rotate('LeftArm',(0,1,0),1.05*(1-amount));rotate('RightArm',(0,1,0),-1.05*(1-amount))
  rotate('LeftForeArm',(0,0,1),-.1*(1-amount));rotate('RightForeArm',(0,0,1),.1*(1-amount))
  rotate('Spine',(0,0,1),-.25*amount)
  rotate('LeftArm',(0,0,1),-1.2*amount);rotate('LeftArm',(1,0,0),-.3*amount)
  rotate('LeftForeArm',(0,0,1),.25*amount)
  rotate('RightArm',(0,0,1),.8*amount);rotate('RightArm',(1,0,0),-.2*amount)
  rotate('RightForeArm',(0,0,1),(1.1+.35*draw)*amount)
  rotate('RightHand',(0,1,0),-.15*draw)
 elif kind=='Mort':rotate('Hips',(1,0,0),1.5*smooth(.05,.8,t))
clips={'Repos':48,'Marche':24,'Tir':24,'Mort':42}
rig.animation_data_create();actions={}
for name,end in clips.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,end+1,2):
  scene.frame_set(frame);pose(name,frame/end)
  for b in rig.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
 actions[name]=action;rig.animation_data.action=None
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Repos'];scene.frame_set(0);pose('Repos',0)
bpy.ops.object.select_all(action='DESELECT')
for o in [root]+list(root.children_recursive):o.select_set(True)
bpy.context.view_layer.objects.active=rig
output=ROOT/'assets/models/mazzeru.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_nla_strips=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)
raw=output.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
report={'sources':hashes,'weapon_source_triangles':source_triangles,'weapon_triangles':sum(len(p.vertices)-2 for p in sword.data.polygons),'bytes':len(raw),'canonical_height':1.8,'clips':[a.get('name') for a in doc.get('animations',[])],'sha256':hashlib.sha256(raw).hexdigest()}
assert set(report['clips'])==set(clips)
for p in (SOURCE,SWORD):assert hashlib.sha256(p.read_bytes()).hexdigest()==hashes[str(p)]
(ROOT/'eredita3D/logs/mazzeru-animation-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('MAZZERU_VALIDATION',json.dumps(report),flush=True)
