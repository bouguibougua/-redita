"""Vampire U Surpatore fourni : mâchoire fermée au repos, griffe et ouverture.
Blender 5.1.1, aucune installation et aucun fichier source modifié.
"""
from pathlib import Path
import bpy,math,json,struct,hashlib,shutil,argparse,sys
from mathutils import Vector,Quaternion,Matrix
parser=argparse.ArgumentParser(description='Prepare the supplied U Surpatore GLB locally with Blender.')
parser.add_argument('--source',default='/Users/robin/Downloads/u surpatore 3d.glb')
parser.add_argument('--output-dir',default=str(Path(__file__).resolve().parents[1]))
parser.add_argument('--asset-output',help='Optional destination for the game GLB.')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=Path(args.output_dir).resolve()
SOURCE=Path(args.source).resolve()
BONE_NAMES={'Hips':'pelvis','Spine':'spine_01','Spine1':'spine_03','Spine2':'spine_05','Neck':'neck_02','Head':'head','Jaw':'jaw'}
for side,suffix in [('Left','l'),('Right','r')]:
    for name,native in [('Shoulder','clavicle'),('Arm','upperarm'),('ForeArm','lowerarm'),('Hand','hand'),('UpLeg','thigh'),('Leg','calf'),('Foot','foot')]:
        BONE_NAMES[side+name]=native+'_'+suffix
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
for folder in ('models','exports','previews','logs','textures/surpatore'):(ROOT/folder).mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.render.fps=24;scene.unit_settings.system='METRIC'
body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));body.name='Surpatore_Vampire_Fourni'
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.name='Surpatore_Squelette'

def smooth(a,b,t):
    x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)

# Le modèle original crie. On ferme réellement sa mâchoire dans le mesh de base.
# Un os indépendant la rouvre pendant le geste de griffe, sans masque ni image.
hinge=Vector((.075,-.018,.889));angle=.46
body_inverse=body.matrix_world.inverted();head_group=body.vertex_groups['head']
jaw_weights={};original_positions={}
for vertex in body.data.vertices:
    p=body.matrix_world@vertex.co
    head_weight=sum(g.weight for g in vertex.groups if g.group==head_group.index)
    if head_weight<.5:continue
    weight=smooth(.06,.10,p.x)*(1-smooth(.8795,.887,p.z))*smooth(.827,.846,p.z)*(1-smooth(.022,.052,abs(p.y+.018)))
    if weight>.0001:
        original_positions[vertex.index]=p.copy();jaw_weights[vertex.index]=weight
        rotation=Quaternion(Vector((0,1,0)),-angle*weight)
        vertex.co=body_inverse@(hinge+rotation@(p-hinge))
assert len(jaw_weights)>20,'Zone de mâchoire introuvable'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
jaw=rig.data.edit_bones.new('jaw')
jaw.head=rig.matrix_world.inverted()@hinge;jaw.tail=rig.matrix_world.inverted()@(hinge+Vector((.05,0,-.02)))
jaw.parent=rig.data.edit_bones['head']
bpy.ops.object.mode_set(mode='OBJECT')
group=body.vertex_groups.new(name='jaw')
for index,weight in jaw_weights.items():
    vertex=body.data.vertices[index]
    for old in list(vertex.groups):
        body.vertex_groups[old.group].add([index],old.weight*(1-weight),'REPLACE')
    group.add([index],weight,'REPLACE')
body.data.update()

points=[body.matrix_world@v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
factor=1.8/(high.z-low.z);center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
roots=[o for o in scene.objects if o.parent is None and o.type!='MESH']
root=bpy.data.objects.new('Surpatore_Normalisation',None);scene.collection.objects.link(root)
for obj in roots:
    world=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=world
root.matrix_world=Matrix.Rotation(-math.pi/2,4,'Z')@Matrix.Scale(factor,4)@Matrix.Translation(-center)
body['source_sha256']=source_hash;body['source_design']=SOURCE.name;body['bouche_fermee_au_repos']=True;body['sommets_machoire']=len(jaw_weights)
for material in body.data.materials:
    material.name='Surpatore_Texture_Originale'
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':node.inputs['Transmission Weight'].default_value=0
        if node.type=='TEX_IMAGE' and node.image:
            image=node.image
            _=image.pixels[0]  # Load imported packed pixels before reducing the texture.
            if max(image.size)>2048:
                ratio=2048/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
            image.file_format='JPEG';image.filepath_raw=str(ROOT/'textures/surpatore/surpatore_basecolor_2048.jpg');image.save()
            replacement=bpy.data.images.load(image.filepath_raw,check_existing=False);replacement.colorspace_settings.name=image.colorspace_settings.name;replacement.name='Surpatore_BaseColor_2048';node.image=replacement;replacement.pack()
bpy.context.view_layer.update()
arm_inverse=rig.matrix_world.to_3x3().inverted();axes={}
for bone in rig.pose.bones:
    bone.rotation_mode='QUATERNION';axes[bone.name]=bone.bone.matrix_local.to_quaternion().inverted()

def rotate(name,axis,amount):
    bone=rig.pose.bones.get(BONE_NAMES[name])
    if bone:
        local=(axes[bone.name]@(arm_inverse@Vector(axis))).normalized()
        bone.rotation_quaternion=bone.rotation_quaternion@Quaternion(local,amount)

def translate(name,delta):
    bone=rig.pose.bones[BONE_NAMES[name]];bone.location=axes[bone.name]@(arm_inverse@Vector(delta))

def aim(name,target):
    bone=rig.pose.bones[BONE_NAMES[name]];goal=rig.matrix_world.inverted()@target
    rotation=(bone.tail-bone.head).normalized().rotation_difference((goal-bone.head).normalized())@bone.matrix.to_quaternion()
    bone.matrix=Matrix.LocRotScale(bone.head,rotation,bone.matrix.to_scale());bpy.context.view_layer.update()

def right_arm_ik(target):
    bpy.context.view_layer.update();a,b,c=[rig.matrix_world@rig.pose.bones[BONE_NAMES[n]].head for n in ('RightArm','RightForeArm','RightHand')]
    l1=(b-a).length;l2=(c-b).length;direction=(target-a).normalized()
    distance=max(abs(l1-l2)+.0001,min((target-a).length,l1+l2-.0001));target=a+direction*distance
    along=(l1*l1-l2*l2+distance*distance)/(2*distance);pole=Vector((-1,0,0));perp=(pole-direction*pole.dot(direction)).normalized()
    elbow=a+direction*along+perp*math.sqrt(max(0,l1*l1-along*along))
    aim('RightArm',elbow);aim('RightForeArm',target)

right_rest=rig.matrix_world@rig.pose.bones['hand_r'].head
raised=Vector((-.36,-.14,1.69));struck=Vector((.04,-.29,1.25))
def pose(kind,t):
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    wave=math.sin(t*math.tau)
    if kind=='Repos':rotate('Spine',(1,0,0),wave*.012)
    elif kind=='Marche':
        translate('Hips',(0,0,.012*(1-math.cos(t*math.tau*2))))
        for side,sign in [('Left',1),('Right',-1)]:
            stride=wave*sign;rotate(side+'UpLeg',(1,0,0),-stride*.25);rotate(side+'Leg',(1,0,0),max(0,-stride)*.32)
        rotate('RightArm',(1,0,0),wave*.15);rotate('Spine',(0,0,1),wave*.025)
    elif kind=='Griffe':
        raise_arm=smooth(0,.22,t);strike=smooth(.30,.66,t);recover=smooth(.77,1,t)
        target=right_rest.lerp(raised,raise_arm).lerp(struck,strike).lerp(right_rest,recover)
        rotate('Spine',(0,0,1),(.11-.25*strike)*raise_arm*(1-recover))
        rotate('Spine2',(1,0,0),.10*strike*(1-recover));right_arm_ik(target)
        mouth=smooth(.07,.28,t)*(1-smooth(.72,.96,t));rotate('Jaw',(1,0,0),angle*mouth)
    elif kind=='Mort':
        fall=smooth(.06,.78,t);rotate('Hips',(1,0,0),1.49*fall);translate('Hips',(0,-.12*fall,-.68*fall))
        rotate('RightArm',(1,0,0),-.20*fall)
    bpy.context.view_layer.update()

CLIPS={'Repos':48,'Marche':24,'Griffe':24,'Mort':42};actions={};rig.animation_data_create()
for name,end in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(0,end+1,2):
        scene.frame_set(frame);pose(name,frame/end)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name);bone.keyframe_insert('location',frame=frame,group=bone.name)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    actions[name]=action;rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Repos'];scene.frame_set(0);pose('Repos',0)
objects=[root]+list(root.children_recursive);objects=[o for o in objects if o.type!='MESH' or o==body]
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=ROOT/'exports/surpatore_vampire.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=False,
 export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_nla_strips=True,
 export_cameras=False,export_lights=False,export_extras=True,export_image_format='JPEG',export_jpeg_quality=90)=={'FINISHED'}
if args.asset_output:
    public=Path(args.asset_output).resolve();public.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(glb,public)

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=850;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.2,.2,.2)
for name,pos,power in [('Principal',(-3,-4,5),550),('Remplissage',(3,1,4),350)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=2.4
camera=bpy.data.objects.new('Camera',d);scene.collection.objects.link(camera);scene.camera=camera
def view(position,target=(0,0,.9),scale=2.4):
 camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
view((2.3,-4.5,2.0));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/surpatore_vampire.blend'))
metrics={}
for name,frame,suffix in [('Repos',0,'repos'),('Marche',6,'marche'),('Griffe',6,'griffe_haute'),('Griffe',16,'attaque'),('Mort',36,'mort')]:
 rig.animation_data.action=actions[name];scene.frame_set(frame);bpy.context.view_layer.update();view((2.3,-4.5,2.0))
 metrics[suffix]={'hand':list(rig.matrix_world@rig.pose.bones['hand_r'].head),'jaw_angle':rig.pose.bones['jaw'].rotation_quaternion.angle}
 scene.render.filepath=str(ROOT/'previews'/f'surpatore_{suffix}.png');bpy.ops.render.render(write_still=True)
for name,frame,suffix in [('Repos',0,'bouche_fermee'),('Griffe',12,'bouche_ouverte')]:
 rig.animation_data.action=actions[name];scene.frame_set(frame);bpy.context.view_layer.update()
 view((.35,-3,1.68),(-.03,-.16,1.62),.50)
 scene.render.filepath=str(ROOT/'previews'/f'surpatore_{suffix}.png');bpy.ops.render.render(write_still=True)

raw=glb.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for mesh in doc['meshes'] for p in mesh['primitives'])
assert triangles==8156 and len(doc['meshes'])==len(doc['skins'])==len(doc['materials'])==1
assert set(a['name'] for a in doc['animations'])==set(CLIPS)
assert any(n.get('name')=='jaw' for n in doc['nodes'])
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
report={'source':str(SOURCE),'source_sha256':source_hash,'triangles':triangles,'bytes':len(raw),'meshes':1,'materials':1,'texture_size':2048,
 'clips':list(CLIPS),'canonical_height':1.8,'bones':len(doc['skins'][0]['joints']),'rig':'supplied Unreal skeleton + jaw','output_sha256':hashlib.sha256(raw).hexdigest(),'jaw_vertices':len(jaw_weights),'jaw_open_angle':angle,'poses':metrics}
(ROOT/'logs/surpatore-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SURPATORE_VALIDATION',json.dumps(report),flush=True)
