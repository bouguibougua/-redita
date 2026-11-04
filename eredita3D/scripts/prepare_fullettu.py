"""Prépare les GLB fournis : follet animé et lanterne liée à la main gauche.
Blender 5.1.1, sans modification des fichiers originaux ni des règles du jeu.
"""
from pathlib import Path
import bpy, math, json, struct, hashlib, shutil
from mathutils import Vector, Quaternion, Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCES=[Path('/Users/robin/Downloads')/n for n in ('u fullettu 3d.glb','lantern fullettu 3d.glb')]
HASHES={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES}
for folder in ('models','exports','previews','logs','textures/fullettu'):(ROOT/folder).mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCES[0]))
scene=bpy.context.scene;scene.render.fps=24;scene.unit_settings.system='METRIC'
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
body.name='Fullettu_Modele_Fourni'
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.name='Fullettu_Squelette'
points=[body.matrix_world@v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
factor=1.8/(high.z-low.z);center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
roots=[o for o in scene.objects if o.parent is None and o.type!='MESH']
root=bpy.data.objects.new('Fullettu_Normalisation',None);scene.collection.objects.link(root)
for obj in roots:
    world=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=world
root.scale=(factor,)*3;root.location=-center*factor
bpy.context.view_layer.update()

before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(SOURCES[1]))
lantern=next(o for o in scene.objects if o not in before and o.type=='MESH')
lantern.name='Lanterne_Fullettu_Main_Gauche'
lantern['accessoire']='lanterne';lantern['main']='gauche'
# La lanterne reste un mesh indépendant ; son anse est placée dans la main.
original_lantern_triangles=sum(len(p.vertices)-2 for p in lantern.data.polygons)
bpy.ops.object.select_all(action='DESELECT');lantern.select_set(True);bpy.context.view_layer.objects.active=lantern
decimate=lantern.modifiers.new('Optimisation_Lanterne','DECIMATE');decimate.ratio=.35
bpy.ops.object.modifier_apply(modifier=decimate.name)
world_points=[lantern.matrix_world@v.co for v in lantern.data.vertices]
llow=Vector(tuple(min(p[i] for p in world_points) for i in range(3)))
lhigh=Vector(tuple(max(p[i] for p in world_points) for i in range(3)))
scale=.42/(lhigh.z-llow.z)
grip=Vector(((llow.x+lhigh.x)/2,(llow.y+lhigh.y)/2,llow.z+(lhigh.z-llow.z)*.94))
left_hand=rig.matrix_world@rig.pose.bones['mixamorig:LeftHand'].head
lantern_world=Matrix.Translation(left_hand+Vector((.025,-.025,-.055)))@Matrix.Scale(scale,4)@Matrix.Translation(-grip)@lantern.matrix_world
lantern.parent=rig;lantern.parent_type='BONE';lantern.parent_bone='mixamorig:LeftHand'
bpy.context.view_layer.update();lantern.matrix_world=lantern_world
bpy.context.view_layer.update()

for obj,label,size in [(body,'Fullettu',2048),(lantern,'Lanterne',1024)]:
    for material in obj.data.materials:
        material.name=label+'_Texture_Originale'
        for node in material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':node.inputs['Transmission Weight'].default_value=0
            if node.type!='TEX_IMAGE' or not node.image:continue
            image=node.image
            if max(image.size)>size:
                ratio=size/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
            image.file_format='JPEG';image.filepath_raw=str(ROOT/'textures/fullettu'/f'{label.lower()}_basecolor_{size}.jpg');image.save()
            replacement=bpy.data.images.load(image.filepath_raw,check_existing=False)
            replacement.colorspace_settings.name=image.colorspace_settings.name;replacement.name=label+'_BaseColor'
            node.image=replacement

arm_inverse=rig.matrix_world.to_3x3().inverted()
axes={}
for bone in rig.pose.bones:
    bone.rotation_mode='QUATERNION';axes[bone.name]=bone.bone.matrix_local.to_quaternion().inverted()

def rotate(name,world_axis,angle):
    bone=rig.pose.bones.get('mixamorig:'+name)
    if bone:
        axis=(axes[bone.name]@(arm_inverse@Vector(world_axis))).normalized()
        bone.rotation_quaternion=bone.rotation_quaternion@Quaternion(axis,angle)

def translate(name,delta):
    bone=rig.pose.bones['mixamorig:'+name];bone.location=axes[bone.name]@(arm_inverse@Vector(delta))

def smooth(a,b,t):
    x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)

def hand_position(side):
    bpy.context.view_layer.update();return rig.matrix_world@rig.pose.bones['mixamorig:'+side+'Hand'].head

right_rest=hand_position('Right')
reach=Vector((-.28,-.53,.84));behind=Vector((-.16,.10,.89))

def aim(name,target):
    bone=rig.pose.bones['mixamorig:'+name]
    goal=rig.matrix_world.inverted()@target
    direction=(bone.tail-bone.head).normalized();wanted=(goal-bone.head).normalized()
    rotation=direction.rotation_difference(wanted)@bone.matrix.to_quaternion()
    bone.matrix=Matrix.LocRotScale(bone.head,rotation,bone.matrix.to_scale())
    bpy.context.view_layer.update()

def right_arm_ik(target):
    # IK analytique de deux os, coudes vers l'extérieur ; rotations ensuite cuites.
    bpy.context.view_layer.update()
    a,b,c=[rig.matrix_world@rig.pose.bones['mixamorig:'+name].head for name in ('RightArm','RightForeArm','RightHand')]
    l1=(b-a).length;l2=(c-b).length
    direction=(target-a).normalized();distance=max(abs(l1-l2)+.0001,min((target-a).length,l1+l2-.0001))
    target=a+direction*distance
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    pole=Vector((-1,0,-.35));perp=(pole-direction*pole.dot(direction)).normalized()
    elbow=a+direction*along+perp*math.sqrt(max(0,l1*l1-along*along))
    aim('RightArm',elbow);aim('RightForeArm',target)

def pose(kind,t):
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    if kind=='Repos':rotate('Spine',(1,0,0),math.sin(t*math.tau)*.012)
    elif kind=='Bonds':
        lift=math.sin(t*math.pi)**2
        translate('Hips',(0,0,.095*lift-.025*(1-lift)))
        rotate('Spine',(1,0,0),.055*lift)
        for side,sign in [('Left',1),('Right',-1)]:
            rotate(side+'UpLeg',(1,0,0),-.16-.16*lift+sign*.025*math.sin(t*math.tau))
            rotate(side+'Leg',(1,0,0),.24+.19*lift)
            rotate(side+'Foot',(1,0,0),-.07*lift)
            rotate(side+'Arm',(1,0,0),-.08*lift)
    elif kind=='Recolte':
        take=smooth(0,.24,t);hide=smooth(.42,.72,t);release=smooth(.83,1,t)
        target=right_rest.lerp(reach,take).lerp(behind,hide).lerp(right_rest,release)
        rotate('Spine',(1,0,0),.10*take*(1-hide)*(1-release))
        rotate('Spine',(0,0,1),-.18*hide*(1-release))
        right_arm_ik(target)
        for finger in ('Index','Middle','Ring','Pinky'):
            for segment in (1,2):rotate('RightHand'+finger+str(segment),(1,0,0),-.10*math.sin(math.pi*smooth(.18,.48,t)))
    elif kind=='Mort':
        fall=smooth(.05,.80,t);rotate('Hips',(1,0,0),1.49*fall)
        translate('Hips',(0,-.12*fall,-.65*fall));rotate('RightArm',(1,0,0),-.28*fall)
    bpy.context.view_layer.update()

CLIPS={'Repos':48,'Bonds':16,'Recolte':72,'Mort':42}
rig.animation_data_create();actions={}
for name,end in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(0,end+1,2):
        scene.frame_set(frame);pose(name,frame/end)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
            bone.keyframe_insert('location',frame=frame,group=bone.name)
    # Les poses échantillonnées sont déjà lissées ; éviter les dépassements Bézier.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    actions[name]=action;rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Repos'];scene.frame_set(0);pose('Repos',0)
objects=[root]+list(root.children_recursive);objects=[o for o in objects if o.type!='MESH' or o in (body,lantern)]
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=ROOT/'exports/fullettu.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=False,
    export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,
    export_nla_strips=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)=={'FINISHED'}
shutil.copyfile(glb,ROOT.parent/'assets/models/fullettu.glb')

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=850;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.2,.2,.2)
for name,position,power in [('Principal',(-3,-4,5),550),('Remplissage',(3,1,4),350)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=position
    o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=2.4
camera=bpy.data.objects.new('Camera',d);scene.collection.objects.link(camera);scene.camera=camera

def view(position):
    camera.location=position;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler()

view((2.3,-4.5,2.0));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/fullettu.blend'))
metrics={}
for name,frame,suffix,position in [('Repos',0,'repos',(2.3,-4.5,2.0)),('Bonds',8,'bond',(2.3,-4.5,2.0)),
    ('Recolte',20,'recolte',(2.3,-4.5,2.0)),('Recolte',54,'main_dos',(-2.5,4.5,1.8)),('Mort',36,'mort',(2.3,-4.5,2.0))]:
    rig.animation_data.action=actions[name];scene.frame_set(frame);bpy.context.view_layer.update();view(position)
    metrics[suffix]={'right_hand':list(hand_position('Right')),'left_hand':list(hand_position('Left')),'lantern':list(lantern.matrix_world.translation)}
    scene.render.filepath=str(ROOT/'previews'/f'fullettu_{suffix}.png');bpy.ops.render.render(write_still=True)

raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
assert set(a['name'] for a in doc['animations'])==set(CLIPS)
assert len(doc['meshes'])==2 and len(doc['skins'])==1 and len(doc['materials'])==2
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in HASHES.items())
report={'sources':HASHES,'triangles':triangles,'body_triangles':9405,'lantern_source_triangles':original_lantern_triangles,
    'lantern_triangles':triangles-9405,'bytes':len(raw),'meshes':len(doc['meshes']),'materials':len(doc['materials']),
    'clips':list(CLIPS),'canonical_height':1.8,'lantern_bone':'mixamorig:LeftHand','poses':metrics}
(ROOT/'logs/fullettu-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('FULLETTU_VALIDATION',json.dumps(report),flush=True)
