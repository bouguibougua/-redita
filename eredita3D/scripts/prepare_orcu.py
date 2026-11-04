"""Prépare le modèle fourni pour L'Orcu : échelle, texture et animations simples.
Le fichier source dans Downloads est uniquement lu, jamais modifié.
"""
from pathlib import Path
import bpy, math, json, struct, hashlib
from mathutils import Vector, Quaternion, Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/robin/Downloads/orc barbarian 3d model.glb')
for folder in ('models','exports','previews','logs'):(ROOT/folder).mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.render.fps=24;scene.unit_settings.system='METRIC'
# L'importeur ajoute une forme de contrôle Icosphere : elle n'appartient pas au personnage.
meshes=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
assert len(meshes)==1
body=meshes[0];body.name='Orcu_Modele_Fourni'
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.name='Orcu_Squelette'
roots=[o for o in scene.objects if o.parent is None and o!=body and o.type!='MESH']
points=[body.matrix_world@v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
height=high.z-low.z;assert height>0
factor=1.8/height;center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
root=bpy.data.objects.new('Orcu_Normalisation',None);scene.collection.objects.link(root)
for obj in roots:
    world=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=world
root.scale=(factor,)*3;root.location=-center*factor
for mat in body.data.materials:
    mat.name='Orcu_Texture_Originale'
    for node in mat.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':node.inputs['Transmission Weight'].default_value=0
texture_dir=ROOT/'textures/orcu';texture_dir.mkdir(parents=True,exist_ok=True)
for image in list(bpy.data.images):
    if image.type=='IMAGE' and max(image.size)>2048:
        ratio=2048/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
        image.file_format='JPEG';image.filepath_raw=str(texture_dir/'orcu_basecolor_2048.jpg');image.save()
        replacement=bpy.data.images.load(image.filepath_raw,check_existing=False)
        replacement.colorspace_settings.name=image.colorspace_settings.name
        for material in bpy.data.materials:
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image==image:node.image=replacement
        bpy.data.images.remove(image);replacement.name='Orcu_BaseColor_2048'

bpy.context.view_layer.update()
arm_inverse=rig.matrix_world.to_3x3().inverted()
axes={}
for bone in rig.pose.bones:
    bone.rotation_mode='QUATERNION'
    axes[bone.name]=bone.bone.matrix_local.to_quaternion().inverted()

def rotate(name,world_axis,angle):
    bone=rig.pose.bones.get('mixamorig:'+name)
    if bone:
        axis=(axes[bone.name]@(arm_inverse@Vector(world_axis))).normalized()
        bone.rotation_quaternion=bone.rotation_quaternion@Quaternion(axis,angle)

def translate(name,world_delta):
    bone=rig.pose.bones['mixamorig:'+name]
    bone.location=axes[bone.name]@(arm_inverse@Vector(world_delta))

def smooth(a,b,t):
    x=max(0,min(1,(t-a)/(b-a)));return x*x*(3-2*x)

def pose(kind,t):
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    wave=math.sin(t*math.tau)
    if kind=='Repos':
        rotate('Spine',(1,0,0),wave*.012)
    elif kind=='Marche':
        rotate('Hips',(0,0,1),wave*.035)
        for label,sign in [('Left',1),('Right',-1)]:
            stride=wave*sign
            rotate(label+'UpLeg',(1,0,0),-stride*.30)
            rotate(label+'Leg',(1,0,0),max(0,-stride)*.32)
            rotate(label+'Arm',(1,0,0),stride*.19)
            rotate(label+'ForeArm',(1,0,0),-.08)
    elif kind.startswith('Frappe_'):
        label='Right' if kind.endswith('Droite') else 'Left'
        other='Left' if label=='Right' else 'Right'
        strength=smooth(0,.18,t)*(1-smooth(.58,1,t))
        strike=smooth(.18,.43,t)
        rotate('Spine',(0,0,1),(.14 if label=='Right' else -.14)*strength*(1-2*strike))
        rotate(label+'Arm',(1,0,0),strength*(.32-1.65*strike))
        rotate(label+'ForeArm',(1,0,0),strength*(.20-.35*strike))
        rotate(other+'Arm',(1,0,0),-.30*strength)
        rotate(other+'ForeArm',(1,0,0),-.22*strength)
    elif kind=='Mort':
        fall=smooth(.06,.76,t)
        rotate('Hips',(1,0,0),1.49*fall)
        rotate('Spine',(0,1,0),-.12*fall)
        rotate('LeftArm',(1,0,0),-.28*fall);rotate('RightArm',(1,0,0),-.36*fall)
        translate('Hips',(0,-1.8*.08*fall,-1.8*.38*fall))

CLIPS={'Repos':48,'Marche':30,'Frappe_Droite':24,'Frappe_Gauche':24,'Mort':42}
rig.animation_data_create();actions={}
for name,end in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(0,end+1,2):
        scene.frame_set(frame);pose(name,frame/end)
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
            bone.keyframe_insert('location',frame=frame,group=bone.name)
    actions[name]=action;rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Repos'];scene.frame_set(0);pose('Repos',0);bpy.context.view_layer.update()
objects=[root]+list(root.children_recursive)
objects=[o for o in objects if o.type!='MESH' or o==body]
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=ROOT/'exports/orcu.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=False,
    export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,
    export_nla_strips=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)=={'FINISHED'}

# Aperçus du modèle importé et des poses pour contrôle visuel.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.22,.22,.22)
for name,position,power in [('Soleil',(-3,-4,5),550),('Ciel',(3,1,4),350)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=4
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=position
    light.rotation_euler=(Vector((0,0,.9))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Camera');data.type='ORTHO';data.ortho_scale=2.5
camera=bpy.data.objects.new('Camera',data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(2.3,-4.5,2.0);camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/orcu.blend'))
for name,frame,suffix in [('Repos',0,'repos'),('Marche',8,'marche'),('Frappe_Droite',11,'attaque'),('Mort',36,'mort')]:
    rig.animation_data.action=actions[name];scene.frame_set(frame)
    scene.render.filepath=str(ROOT/'previews'/f'orcu_{suffix}.png');bpy.ops.render.render(write_still=True)

raw=glb.read_bytes();size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
names=[a['name'] for a in doc.get('animations',[])]
assert set(names)==set(CLIPS),names
assert triangles==10501 and len(doc.get('skins',[]))==1 and len(doc['materials'])==1
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
report={'source':str(SOURCE),'source_sha256':source_hash,'triangles':triangles,'bytes':len(raw),
        'materials':1,'textures':[[i.name,list(i.size)] for i in bpy.data.images if i.type=='IMAGE'],
        'clips':names,'canonical_height':1.8,'note':'Animations simples créées sur le squelette fourni ; aucune règle de combat modifiée.'}
(ROOT/'logs/orcu-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('ORCU_VALIDATION',json.dumps(report),flush=True)
