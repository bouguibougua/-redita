"""Ajoute un rig d'ailes au FBX Tripo fourni, puis exporte deux clips en GLB.
Usage : blender -b --python prepare_diavule.py -- /chemin/diabule\ 3D.zip
Le mesh et sa texture restent ceux de l'archive ; aucun appel payant Tripo.
"""
from pathlib import Path
import bpy,sys,zipfile,tempfile,math,json,hashlib,shutil
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[1]
source=Path(sys.argv[sys.argv.index('--')+1])
for f in ('models','exports','textures/diavule','logs'):(ROOT/f).mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
with tempfile.TemporaryDirectory() as tmp:
    with zipfile.ZipFile(source) as archive:
        for entry in archive.infolist():
            assert (Path(tmp)/entry.filename).resolve().is_relative_to(Path(tmp).resolve())
            archive.extract(entry,tmp)
    bpy.ops.import_scene.fbx(filepath=str(next(Path(tmp).glob('*.fbx'))))
    # Pack before the temporary extraction is removed.
    for image in bpy.data.images:
        if image.source=='FILE':image.pack()
scene=bpy.context.scene;scene.render.fps=30
body=next(o for o in scene.objects if o.type=='MESH');body.name='Diavule_Modele_Tripo'
rig=next(o for o in scene.objects if o.type=='ARMATURE');rig.name='Diavule_Squelette'
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for side,sign in [('Left',1),('Right',-1)]:
    wing=rig.data.edit_bones.new('Wing_'+side);wing.head=(.055*sign,.035,.735);wing.tail=(.245*sign,.055,.89)
    wing.parent=rig.data.edit_bones['mixamorig:Spine2']
    tip=rig.data.edit_bones.new('WingTip_'+side);tip.head=wing.tail;tip.tail=(.365*sign,.16,.42);tip.parent=wing
bpy.ops.object.mode_set(mode='OBJECT')
def smooth(a,b,x):
    v=max(0,min(1,(x-a)/(b-a)));return v*v*(3-2*v)
winggroups={n:body.vertex_groups.new(name=n) for n in ['Wing_Left','Wing_Right','WingTip_Left','WingTip_Right']}
counts={'Left':0,'Right':0}
for vertex in body.data.vertices:
    p=body.matrix_world@vertex.co;x,y,z=p
    boundary=.035-(.033*smooth(.76,.90,z))
    wing=smooth(.035,.13,abs(x))*smooth(boundary-.02,boundary+.025,y)*smooth(.08,.16,z)
    if wing<.001:continue
    side='Left' if x>0 else 'Right';counts[side]+=1
    tip=.7*smooth(.17,.36,abs(x))*(.4+.6*(1-smooth(.35,.85,z)))
    old=[(g.group,g.weight) for g in vertex.groups]
    for index,weight in old:body.vertex_groups[index].add([vertex.index],weight*(1-wing),'REPLACE')
    winggroups['Wing_'+side].add([vertex.index],wing*(1-tip),'REPLACE')
    winggroups['WingTip_'+side].add([vertex.index],wing*tip,'REPLACE')
# Normalize to the same height convention as other imported characters.
points=[body.matrix_world@v.co for v in body.data.vertices];low=min(p.z for p in points);high=max(p.z for p in points)
root=bpy.data.objects.new('Diavule_Normalisation',None);scene.collection.objects.link(root)
for obj in list(scene.objects):
    if obj!=root and obj.parent is None:
        world=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=world
scale=1.8/(high-low);root.scale=(scale,)*3;root.location.z=-low*scale
for mat in body.data.materials:
    mat.name='Diavule_Texture_Originale';mat.use_nodes=True
    for node in mat.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':node.inputs['Roughness'].default_value=.78;node.inputs['Metallic'].default_value=0
        if node.type=='TEX_IMAGE' and node.image:
            image=node.image
            if max(image.size)>2048:image.scale(2048,2048)
            image.filepath_raw=str(ROOT/'textures/diavule/diavule_basecolor.jpg');image.file_format='JPEG';image.save()
            # Reload the resized file: otherwise glTF can reuse the original packed 4K bytes.
            replacement=bpy.data.images.load(image.filepath_raw,check_existing=False)
            replacement.colorspace_settings.name=image.colorspace_settings.name;replacement.pack();node.image=replacement
axes={b.name:b.bone.matrix_local.to_quaternion().inverted() for b in rig.pose.bones}
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
def rotate(name,axis,angle):
    b=rig.pose.bones[name];b.rotation_quaternion=b.rotation_quaternion@Quaternion((axes[name]@Vector(axis)).normalized(),angle)
def pose(kind,t):
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    pulse=math.sin(t*math.tau)
    cast=math.sin(math.pi*t)**2 if kind=='Invocation' else 0
    for side,sign in [('Left',1),('Right',-1)]:
        rotate('Wing_'+side,(0,0,1),sign*(.06+.40*pulse))
        rotate('Wing_'+side,(0,1,0),sign*(.05+.12*math.cos(t*math.tau)))
        rotate('WingTip_'+side,(0,0,1),sign*.19*math.sin(t*math.tau-.65))
        rotate('mixamorig:'+side+'Arm',(0,1,0),sign*(1.05-.62*cast))
        rotate('mixamorig:'+side+'ForeArm',(0,0,1),sign*(.18+.27*cast))
        rotate('mixamorig:'+side+'UpLeg',(1,0,0),-.15-(.08 if sign>0 else 0))
        rotate('mixamorig:'+side+'Leg',(1,0,0),.30+( .12 if sign>0 else 0))
        rotate('mixamorig:'+side+'Foot',(1,0,0),-.12)
    rotate('mixamorig:Spine',(1,0,0),-.025+.025*pulse-.08*cast)
    rotate('mixamorig:Head',(1,0,0),.08*cast)
clips={'Battement':48,'Invocation':72};actions={}
rig.animation_data_create()
for name,end in clips.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(0,end+1,2):
        scene.frame_set(frame);pose(name,frame/end)
        for b in rig.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation='LINEAR'
    actions[name]=action;rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
rig.animation_data.action=actions['Battement'];scene.frame_set(0)
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'exports/diavule.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,
    export_force_sampling=True,export_nla_strips=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)
shutil.copy2(out,ROOT.parent/'assets/models/diavule.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/diavule.blend'))
report={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),
        'wingVertices':counts,'wingBones':list(winggroups),'clips':list(clips),'bytes':out.stat().st_size,'tripoCredits':0}
(ROOT/'logs/diavule-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
