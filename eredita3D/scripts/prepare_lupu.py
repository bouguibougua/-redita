"""Rig et animations locales du modèle fourni pour U Lupu Mannaru, Blender 5.1.
Le GLB original est uniquement lu. Aucun équilibrage n'est modifié.
"""
from pathlib import Path
import bpy,bmesh,math,json,struct,hashlib,shutil
from mathutils import Vector,Matrix,Quaternion
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/robin/Downloads/U lupu mannaru 3d.glb')
HASH=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
for name in ('models','exports','previews','logs','textures/lupu'):(ROOT/name).mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.render.fps=24;scene.unit_settings.system='METRIC'
body=next(o for o in scene.objects if o.type=='MESH');body.name='Lupu_Modele_Fourni'
world=body.matrix_world.copy();body.parent=None;body.data.transform(world);body.matrix_world=Matrix.Identity(4)
points=[v.co for v in body.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
base=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z));scale=1.8/(high.z-low.z)
body.data.transform(Matrix.Scale(scale,4)@Matrix.Translation(-base));body.data.update()
for obj in list(scene.objects):
    if obj!=body:bpy.data.objects.remove(obj,do_unlink=True)
for material in body.data.materials:
    material.name='Lupu_Texture_Originale'
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':node.inputs['Transmission Weight'].default_value=0
        if node.type=='TEX_IMAGE' and node.image:
            image=node.image;ratio=min(1,2048/max(image.size));image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
            image.file_format='JPEG';image.filepath_raw=str(ROOT/'textures/lupu/lupu_basecolor_2048.jpg');image.save()
            replacement=bpy.data.images.load(image.filepath_raw,check_existing=False);replacement.colorspace_settings.name=image.colorspace_settings.name
            replacement.name='Lupu_BaseColor_2048';node.image=replacement

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

data=bpy.data.armatures.new('Lupu_Squelette');rig=bpy.data.objects.new('Lupu_Squelette',data);scene.collection.objects.link(rig)
activate(rig);bpy.ops.object.mode_set(mode='EDIT')
specs=[('Hips',(0,-.08,.86),(0,-.09,1.0),None),('Spine',(0,-.09,1.0),(0,-.10,1.20),'Hips'),
    ('Chest',(0,-.10,1.20),(0,-.15,1.39),'Spine'),('Neck',(0,-.15,1.39),(0,-.28,1.47),'Chest'),
    ('Head',(0,-.28,1.47),(0,-.35,1.78),'Neck'),
    ('Tail1',(0,.12,.81),(0,.30,.59),'Hips'),('Tail2',(0,.30,.59),(0,.47,.36),'Tail1'),('Tail3',(0,.47,.36),(0,.60,.21),'Tail2')]
for side,sign in [('Left',1),('Right',-1)]:
    specs.extend([(side+'Shoulder',(sign*.035,-.12,1.29),(sign*.30,-.13,1.25),'Chest'),
        (side+'Arm',(sign*.30,-.13,1.25),(sign*.55,-.27,1.01),side+'Shoulder'),
        (side+'ForeArm',(sign*.55,-.27,1.01),(sign*.68,-.33,.94),side+'Arm'),
        (side+'Hand',(sign*.68,-.33,.94),(sign*.87,-.40,1.01),side+'ForeArm'),
        (side+'UpLeg',(sign*.15,-.08,.87),(sign*.33,-.22,.49),'Hips'),
        (side+'Leg',(sign*.33,-.22,.49),(sign*.46,-.20,.15),side+'UpLeg'),
        (side+'Foot',(sign*.46,-.20,.15),(sign*.49,-.43,.06),side+'Leg')])
for name,head,tail,parent in specs:
    bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'

# Pondération automatique sur un proxy fermé, puis transfert aux sommets UV intacts.
proxy=body.copy();proxy.data=body.data.copy();proxy.name='Proxy_Temporaire';scene.collection.objects.link(proxy);activate(proxy)
remesh=proxy.modifiers.new('Volume_Ponderation','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.022
bpy.ops.object.modifier_apply(modifier=remesh.name)
bm=bmesh.new();bm.from_mesh(proxy.data);pending=set(bm.verts);components=[]
while pending:
    seed=pending.pop();component={seed};stack=[seed]
    while stack:
        current=stack.pop()
        for edge in current.link_edges:
            other=edge.other_vert(current)
            if other in pending:pending.remove(other);component.add(other);stack.append(other)
    components.append(component)
largest=max(components,key=len);bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in largest],context='VERTS')
bm.to_mesh(proxy.data);bm.free()
activate(proxy);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
assert all(v.groups for v in proxy.data.vertices),'Pondération automatique incomplète'
tree=KDTree(len(proxy.data.vertices))
for v in proxy.data.vertices:tree.insert(v.co,v.index)
tree.balance();names={g.index:g.name for g in proxy.vertex_groups};groups={b.name:body.vertex_groups.new(name=b.name) for b in rig.data.bones}
for vertex in body.data.vertices:
    weights={}
    for _,index,distance in tree.find_n(vertex.co,4):
        factor=1/max(.002,distance)**2
        for entry in proxy.data.vertices[index].groups:
            name=names[entry.group];weights[name]=weights.get(name,0)+entry.weight*factor
    # Les dents et mèches séparées conservent la tête ; griffes rigides aux extrémités.
    if vertex.co.z>1.46:weights={'Head':1}
    elif abs(vertex.co.x)>.46 and .72<vertex.co.z<1.22:
        # Garder l'avant-bras et la paume dans la même chaîne : la surface UV
        # très découpée peut faire diffuser les poids thermiques vers le torse.
        side='Left' if vertex.co.x>0 else 'Right';x=abs(vertex.co.x)
        def blend(a,b):
            t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
        hand=blend(.63,.74);forearm=blend(.46,.56)*(1-hand)
        weights={side+'Hand':hand,side+'ForeArm':forearm,side+'Arm':1-hand-forearm}
    elif vertex.co.z<.13 and abs(vertex.co.x)>.30 and vertex.co.y<.05:
        weights={('Left' if vertex.co.x>0 else 'Right')+'Foot':1}
    if vertex.co.y>.14 and vertex.co.z<.87:
        # La queue descend près des chevilles dans la pose source : empêcher
        # ses mèches de suivre les pieds lorsque le bassin se penche.
        tail={}
        for name in ('Tail1','Tail2','Tail3'):
            bone=rig.data.bones[name];segment=bone.tail_local-bone.head_local
            t=max(0,min(1,(vertex.co-bone.head_local).dot(segment)/segment.length_squared))
            distance=(vertex.co-bone.head_local-segment*t).length
            tail[name]=1/max(.02,distance)**4
        total_tail=sum(tail.values());blend=max(0,min(1,(vertex.co.y-.14)/.09));blend=blend*blend*(3-2*blend)
        total_original=sum(weights.values());weights={n:w/total_original*(1-blend) for n,w in weights.items()}
        for name,weight in tail.items():weights[name]=weights.get(name,0)+weight/total_tail*blend
    top=sorted(weights.items(),key=lambda p:p[1],reverse=True)[:4];total=sum(w for _,w in top)
    assert total>0
    for name,weight in top:groups[name].add([vertex.index],weight/total,'REPLACE')
proxy_count=len(proxy.data.vertices);bpy.data.objects.remove(proxy,do_unlink=True)
body.parent=rig;modifier=body.modifiers.new('Deformation_Lupu','ARMATURE');modifier.object=rig
print('LUPU_RIG',len(data.bones),'bones, proxy',proxy_count,'vertices',flush=True)

def smooth(a,b,t):
    t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)

def turn(name,axis,angle):
    bone=rig.pose.bones[name]
    rotation=Quaternion(Vector(axis),angle)@bone.matrix.to_quaternion()
    bone.matrix=Matrix.LocRotScale(bone.head,rotation,bone.matrix.to_scale());bpy.context.view_layer.update()

def aim(name,target):
    bone=rig.pose.bones[name];direction=(bone.tail-bone.head).normalized();wanted=(target-bone.head).normalized()
    rotation=direction.rotation_difference(wanted)@bone.matrix.to_quaternion()
    bone.matrix=Matrix.LocRotScale(bone.head,rotation,bone.matrix.to_scale());bpy.context.view_layer.update()

def orient_palm(name,direction,normal,amount):
    # Fixer aussi le roulis : aligner seulement l'axe de l'os laisse une paume
    # tournée vers le ciel sur le modèle source aux bras écartés.
    bone=rig.pose.bones[name];rest_y=(bone.bone.tail_local-bone.bone.head_local).normalized()
    def frame(y,n):
        z=(n-y*n.dot(y)).normalized();x=y.cross(z).normalized()
        return Matrix((x,y,z)).transposed()
    rest=frame(rest_y,Vector((0,0,1)))
    wanted=frame(direction.normalized(),Vector(normal))
    goal=(wanted@rest.transposed()).to_quaternion()@bone.bone.matrix_local.to_quaternion()
    rotation=bone.matrix.to_quaternion().slerp(goal,amount)
    bone.matrix=Matrix.LocRotScale(bone.head,rotation,bone.matrix.to_scale());bpy.context.view_layer.update()

def ik(names,target,pole):
    bpy.context.view_layer.update();a,b,c=[rig.pose.bones[n].head.copy() for n in names]
    l1=(b-a).length;l2=(c-b).length;direction=(target-a).normalized()
    distance=max(abs(l1-l2)+.0001,min((target-a).length,l1+l2-.0001));target=a+direction*distance
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    perp=(pole-direction*pole.dot(direction)).normalized()
    elbow=a+direction*along+perp*math.sqrt(max(0,l1*l1-along*along))
    aim(names[0],elbow);aim(names[1],target)

def body_stance(level,t=0,moving=False):
    hips=rig.pose.bones['Hips'];delta=Vector((0,.16*(1-level),-.28*(1-level)))
    if moving:delta.z+=.012*math.cos(t*math.tau*2)
    hips.location=hips.bone.matrix_local.to_quaternion().inverted()@delta;bpy.context.view_layer.update()
    turn('Hips',(1,0,0),1.15*(1-level))
    turn('Spine',(1,0,0),.35*(1-level));turn('Chest',(1,0,0),.05*(1-level))
    turn('Neck',(1,0,0),-.95*(1-level));turn('Head',(1,0,0),-.12*(1-level))
    turn('Tail1',(1,0,0),-.30*(1-level));turn('Tail2',(0,0,1),math.sin(t*math.tau)*.08*(1-level))

def feet(level,t=0,moving=False):
    for side,sign in [('Left',1),('Right',-1)]:
        phase=t+(0 if side=='Right' else .5);wave=math.sin(phase*math.tau)
        target=Vector((sign*(.26+.09*level),.39*(1-level)-.04*level,.15))
        if moving:target.y+=.10*math.cos(phase*math.tau);target.z+=.065*max(0,wave)
        ik([side+'UpLeg',side+'Leg',side+'Foot'],target,Vector((sign*.5,-1,0)))
        foot=rig.pose.bones[side+'Foot'];aim(side+'Foot',foot.head+Vector((sign*.025,-.23,-.09)))

def hands(level,t=0,moving=False,attack=False):
    for side,sign in [('Left',1),('Right',-1)]:
        phase=t+(0 if side=='Left' else .5);wave=math.sin(phase*math.tau)
        ground=Vector((sign*.32,-.31,.10))
        if moving:ground.y+=.10*math.cos(phase*math.tau);ground.z+=.065*max(0,wave)
        if attack:
            high=Vector((sign*.52,-.30,1.54));low=Vector((-sign*.02,-.48,1.08))
            slash=smooth(.25,.47,t) if side=='Right' else smooth(.49,.71,t)
            target=ground.lerp(high.lerp(low,slash),level)
            claw_direction=Vector((-sign*.65,-.25,-.70)) if slash>.2 else Vector((sign*.25,-.2,.8))
            direction=Vector((sign*.05,-1,-.2)).lerp(claw_direction,level).normalized()
        else:target=ground;direction=Vector((sign*.05,-1,-.2))
        ik([side+'Arm',side+'ForeArm',side+'Hand'],target,Vector((sign, .25,.05)))
        forearm=rig.pose.bones[side+'ForeArm']
        orient_palm(side+'ForeArm',forearm.tail-forearm.head,(0,-1,0),1-level)
        hand=rig.pose.bones[side+'Hand'];aim(side+'Hand',hand.head+direction*.15)
        orient_palm(side+'Hand',direction,(0,0,-1),1-level)

def pose(kind,t):
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    level=smooth(0,.20,t)*(1-smooth(.88,1,t)) if kind=='Griffes_Croisees' else 0
    body_stance(level,t,kind=='Quatre_Pattes');feet(level,t,kind=='Quatre_Pattes');hands(level,t,kind=='Quatre_Pattes',kind=='Griffes_Croisees')
    if kind=='Repos':turn('Chest',(1,0,0),math.sin(t*math.tau)*.008)
    if kind=='Mort':
        fall=smooth(.05,.85,t);turn('Hips',(0,1,0),1.47*fall)
        hips=rig.pose.bones['Hips'];hips.location+=hips.bone.matrix_local.to_quaternion().inverted()@Vector((0,0,-.15*fall))
    bpy.context.view_layer.update()

CLIPS={'Repos':48,'Quatre_Pattes':24,'Griffes_Croisees':60,'Mort':42}
rig.animation_data_create();actions={}
for name,end in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(end+1):
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
rig.animation_data.action=actions['Repos'];scene.frame_set(0)
activate(body);rig.select_set(True)
glb=ROOT/'exports/lupu_mannaru.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=False,
    export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,
    export_nla_strips=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)=={'FINISHED'}
shutil.copyfile(glb,ROOT.parent/'assets/models/lupu_mannaru.glb')

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.2,.2,.2)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.name='Sol_Apercu_Hors_Export'
material=bpy.data.materials.new('Sol_Studio');material.diffuse_color=(.075,.08,.09,1);floor.data.materials.append(material)
for name,pos,power in [('Principal',(-3,-4,5),550),('Retour',(3,1,4),350)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=2.4
camera=bpy.data.objects.new('Camera',d);scene.collection.objects.link(camera);scene.camera=camera

def view(pos,target):
    camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()

view((2.5,-4.5,2),(0,0,.8));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/lupu_mannaru.blend'))
metrics={}
for name,frame,suffix,pos,target in [('Repos',0,'repos',(2.5,-4.5,2),(0,0,.7)),
    ('Quatre_Pattes',6,'quatre_pattes',(3.5,-2.5,1.6),(0,0,.65)),
    ('Griffes_Croisees',13,'debout',(2.5,-4.5,2),(0,0,.9)),
    ('Griffes_Croisees',28,'griffe_droite',(1.7,-4.5,2),(0,0,.9)),
    ('Griffes_Croisees',43,'griffe_gauche',(1.7,-4.5,2),(0,0,.9)),
    ('Mort',36,'mort',(2.5,-4.5,2),(0,0,.6))]:
    rig.animation_data.action=actions[name];scene.frame_set(frame);bpy.context.view_layer.update();view(pos,target)
    metrics[suffix]={n:list(rig.pose.bones[n].head) for n in ('Hips','Head','LeftHand','RightHand','LeftFoot','RightFoot')}
    scene.render.filepath=str(ROOT/'previews'/f'lupu_{suffix}.png');bpy.ops.render.render(write_still=True)
raw=glb.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert triangles==10406 and len(doc['skins'])==1 and len(doc['materials'])==1
assert set(a['name'] for a in doc['animations'])==set(CLIPS)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==HASH
report={'source':str(SOURCE),'source_sha256':HASH,'triangles':triangles,'bytes':len(raw),'bones':len(data.bones),
    'materials':1,'texture_size':2048,'canonical_standing_height':1.8,'clips':list(CLIPS),'poses':metrics,
    'note':'Squelette local, poids transférés depuis un proxy fermé ; animation en place, aucune modification des statistiques.'}
(ROOT/'logs/lupu-validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print('LUPU_VALIDATION',json.dumps(report),flush=True)
