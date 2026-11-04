"""Prépare le GLB fourni par le concepteur avec Blender 5.1, sans installation.

Commande : Blender --background --factory-startup --python-exit-code 1
  --python eredita3D/scripts/prepare_swordsman.py -- [--inspect]
"""
from pathlib import Path
import json
import math
import sys
import struct
import shutil
import hashlib

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/robin/Downloads/medieval swordsman 3d model.glb')
TARGET_TRIANGLES = 36000
SHIFT = Vector((.02,-.10,0))
FPS = 30
CLIPS = {'Repos':60,'Marche':30,'Coup_Droit':24,'Revers':24,'Mort':54}


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def prepare_mesh():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(objects) == 1
    body = objects[0]
    body.name = 'Guerrier_Importe'
    activate(body)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    original = len(body.data.polygons)
    decimate = body.modifiers.new('Optimisation_Jeu', 'DECIMATE')
    decimate.ratio = min(1, TARGET_TRIANGLES / original)
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    bounds = [body.matrix_world @ v.co for v in body.data.vertices]
    low = Vector(tuple(min(p[i] for p in bounds) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in bounds) for i in range(3)))
    height = high.z-low.z
    center = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    for v in body.data.vertices:
        v.co = ((body.matrix_world @ v.co) - center) * (1.80/height)
    body.matrix_world.identity()
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    for image in bpy.data.images:
        if image.type == 'IMAGE' and max(image.size) > 2048:
            ratio = 2048/max(image.size)
            image.scale(int(image.size[0]*ratio), int(image.size[1]*ratio))
    material = body.data.materials[0]
    material.name = 'Guerrier_Texture_Originale'
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    # Le matériau Tripo peut déclarer un volume inutile pour une figurine opaque.
    principled.inputs['Transmission Weight'].default_value = 0
    bpy.context.view_layer.update()
    print('PREPARATION', json.dumps({'triangles_source': original,
        'triangles_jeu': len(body.data.polygons), 'vertices': len(body.data.vertices),
        'dimensions': list(body.dimensions),
        'textures': [(i.name,list(i.size)) for i in bpy.data.images if i.type=='IMAGE'] }), flush=True)
    return body


def setup_preview():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.world.color = (.18,.18,.18)
    for name,position,power,size in [('Principale',(3,-4,5),450,4),('Remplissage',(-3,-2,3),260,3),('Contour',(0,3,4),400,3)]:
        data = bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        obj = bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    data = bpy.data.cameras.new('Apercu');camera=bpy.data.objects.new('Apercu',data)
    scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=2.25
    scene.view_settings.view_transform = 'AgX'
    return camera


def render(camera, name, position):
    camera.location = position
    camera.rotation_euler = (Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.render.filepath = str(ROOT/'previews'/name)
    bpy.ops.render.render(write_still=True)


def split_sword(body):
    # La lame est devant le corps : extraction géométrique dans son axe réel.
    start=Vector((-.3656,-.0047,1.0328));end=Vector((.5344,-.4675,.6853))
    axis=end-start
    pixels,width,height=texture_pixels(body)
    activate(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.select_all(action='DESELECT')
    bm=bmesh.from_edit_mesh(body.data)
    for face in bm.faces:
        center=face.calc_center_median()
        t=(center-start).dot(axis)/axis.length_squared
        distance=(center-start-axis*t).length
        uv=sum((loop[bm.loops.layers.uv.active].uv for loop in face.loops),Vector((0,0)))/len(face.loops)
        color=pixels[min(height-1,max(0,int(uv.y*height))),min(width-1,max(0,int(uv.x*width))),:3]
        saturation=(float(color.max())-float(color.min()))/max(.001,float(color.max()))
        # La texture distingue l'acier gris des pans rouges passant derrière lui.
        steel=saturation<.65
        face.select_set(steel and .025<t<1.05 and distance<.105)
    bmesh.update_edit_mesh(body.data)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    sword=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o!=body)
    sword.name='Epee_Acier'
    metal=body.data.materials[0].copy();metal.name='Acier_Epee_Texture'
    sword.data.materials.clear();sword.data.materials.append(metal)
    for face in sword.data.polygons:face.material_index=0
    assert len(sword.data.polygons)>100, 'Extraction de la lame incomplète'
    return sword


def texture_pixels(body):
    image=next(n.image for n in body.data.materials[0].node_tree.nodes
               if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name)
    width,height=image.size
    data=np.empty(width*height*4,dtype=np.float32);image.pixels.foreach_get(data)
    return data.reshape(height,width,4),width,height


def make_rig():
    data=bpy.data.armatures.new('Squelette_Guerrier_Importe')
    rig=bpy.data.objects.new('Rig_Guerrier_Importe',data)
    bpy.context.scene.collection.objects.link(rig)
    activate(rig);bpy.ops.object.mode_set(mode='EDIT')
    specs=[('root',(0,.1,0),(0,.1,.12),None),
        ('pelvis',(-.02,.13,.93),(-.02,.13,1.04),'root'),
        ('spine',(-.02,.13,1.04),(-.02,.11,1.23),'pelvis'),
        ('chest',(-.02,.11,1.23),(0,.09,1.43),'spine'),
        ('neck',(0,.09,1.43),(.02,.08,1.53),'chest'),
        ('head',(.02,.08,1.53),(.02,.09,1.79),'neck')]
    joints={
        'R':[(-.21,.24,1.37),(-.42,.23,1.25),(-.455,.075,1.12),(-.455,.04,1.065),
             (-.11,.13,.93),(-.30,-.075,.52),(-.425,.015,.14),(-.46,-.15,.06)],
        'L':[(.18,.035,1.37),(.365,-.005,1.16),(.495,-.11,.94),(.53,-.12,.85),
             (.09,.14,.93),(.28,.10,.52),(.46,.23,.14),(.51,.06,.06)]}
    for label,j in joints.items():
        specs.extend([('clavicle.'+label,(-.01,.12,1.39),j[0],'chest'),
            ('upper_arm.'+label,j[0],j[1],'clavicle.'+label),
            ('forearm.'+label,j[1],j[2],'upper_arm.'+label),
            ('hand.'+label,j[2],j[3],'forearm.'+label),
            ('thigh.'+label,j[4],j[5],'pelvis'),
            ('shin.'+label,j[5],j[6],'thigh.'+label),
            ('foot.'+label,j[6],j[7],'shin.'+label)])
    for name,head,tail,parent in specs:
        bone=data.edit_bones.new(name);bone.head=Vector(head)+SHIFT;bone.tail=Vector(tail)+SHIFT
        if parent:bone.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
    return rig


def bind_meshes(body,sword,rig):
    # Calcul des poids sur un volume fermé, puis transfert au mesh UV original.
    # Le proxy temporaire ne fait pas partie de l'export.
    from mathutils.kdtree import KDTree
    for obj in (body,sword):
        for vertex in obj.data.vertices:vertex.co+=SHIFT
    proxy=body.copy();proxy.data=body.data.copy();proxy.name='Proxy_Ponderation'
    bpy.context.scene.collection.objects.link(proxy);activate(proxy)
    remesh=proxy.modifiers.new('Volume_Ferme','REMESH')
    remesh.mode='VOXEL';remesh.voxel_size=.018
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    bm=bmesh.new();bm.from_mesh(proxy.data)
    pending=set(bm.verts);components=[]
    while pending:
        seed=pending.pop();component={seed};stack=[seed]
        while stack:
            current=stack.pop()
            for edge in current.link_edges:
                other=edge.other_vert(current)
                if other in pending:pending.remove(other);component.add(other);stack.append(other)
        components.append(component)
    largest=max(components,key=len)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in largest],context='VERTS')
    bm.to_mesh(proxy.data);bm.free()
    rig.data.bones['root'].use_deform=False
    activate(proxy);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    rig.data.bones['root'].use_deform=True
    missing=sum(not v.groups for v in proxy.data.vertices)
    assert missing==0,f'Pondération du volume incomplète : {missing}'
    tree=KDTree(len(proxy.data.vertices))
    for v in proxy.data.vertices:tree.insert(v.co,v.index)
    tree.balance()
    groups={b.name:body.vertex_groups.new(name=b.name) for b in rig.data.bones}
    names={g.index:g.name for g in proxy.vertex_groups}
    for v in body.data.vertices:
        weights={}
        for _,index,distance in tree.find_n(v.co,4):
            factor=1/max(.001,distance)**2
            for group in proxy.data.vertices[index].groups:
                name=names[group.group]
                weights[name]=weights.get(name,0)+group.weight*factor
        source=v.co-SHIFT
        if source.z>1.50:
            weights={'head':1}
        elif abs(source.x)<.18 and source.z>1.42:
            t=smooth(1.42,1.54,source.z);weights={'neck':1-t,'head':t}
        elif abs(source.x)<.18 and 1.04<source.z<=1.42:
            t=smooth(1.10,1.30,source.z);weights={'spine':1-t,'chest':t}
        elif abs(source.x)<.24 and .86<source.z<=1.04:
            weights={'pelvis':1}
        start=Vector((-.3656,-.0047,1.0328));axis=Vector((.90,-.4628,-.3475))
        t=(source-start).dot(axis)/axis.length_squared
        distance=(source-start-axis*t).length
        handle=-.27<t<=.025 and distance<.07
        palm=source.x<-.36 and 1.00<source.z<1.23 and source.y<.17
        if handle:weights={'hand.R':1}
        elif palm:
            blend=1-smooth(1.105,1.23,source.z)
            weights={n:w*(1-blend) for n,w in weights.items()}
            weights['hand.R']=weights.get('hand.R',0)+blend*sum(w for w in weights.values())/max(.00001,1-blend) if blend<.99999 else 1
        top=sorted(weights.items(),key=lambda p:p[1],reverse=True)[:4]
        total=sum(w for _,w in top)
        assert total>0
        for name,w in top:groups[name].add([v.index],w/total,'REPLACE')
    print('PONDERATION',len(proxy.data.vertices),'sommets de calcul, transfert lissé',flush=True)
    bpy.data.objects.remove(proxy,do_unlink=True)
    body.parent=rig
    modifier=body.modifiers.new('Deformation_squelette','ARMATURE');modifier.object=rig
    group=sword.vertex_groups.new(name='hand.R')
    group.add(list(range(len(sword.data.vertices))),1,'REPLACE')
    sword.parent=rig
    modifier=sword.modifiers.new('Deformation_squelette','ARMATURE');modifier.object=rig
    leather=body.data.materials[0].copy();leather.name='Cuir_gilet'
    body.data.materials.append(leather)
    for polygon in body.data.polygons:
        point=polygon.center
        if 1.06<point.z<1.40 and abs(point.x)<.20:polygon.material_index=1


def smooth(a,b,t):
    x=max(0,min(1,(t-a)/(b-a)))
    return x*x*(3-2*x)


def rotate(rig,name,axis,angle):
    bone=rig.pose.bones[name];rest=bone.bone.matrix_local
    parent=bone.parent
    delta=parent.matrix@parent.bone.matrix_local.inverted() if parent else Matrix.Identity(4)
    bone.matrix=delta@Matrix.Translation(rest.translation)@Quaternion(Vector(axis),angle).to_matrix().to_4x4()@rest.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()


def point(rig,name,direction,torso):
    bone=rig.pose.bones[name];rest=bone.bone.matrix_local
    parent=bone.parent
    head=(parent.matrix@parent.bone.matrix_local.inverted()@rest).translation
    original=(bone.bone.tail_local-bone.bone.head_local).normalized()
    rotation=original.rotation_difference(Vector(direction).normalized())
    orientation=torso.to_quaternion()@rotation@rest.to_quaternion()
    bone.matrix=Matrix.Translation(head)@orientation.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def pose(rig,body,kind,t):
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    wave=math.sin(t*math.tau)
    if kind=='Repos':
        rig.pose.bones['root'].location.y=wave*.003
        rotate(rig,'chest',(1,0,0),wave*.012)
    elif kind=='Marche':
        rotate(rig,'chest',(0,0,1),wave*.07)
        for sign,label in [(-1,'R'),(1,'L')]:
            stride=wave*sign
            point(rig,'thigh.'+label,(sign*.04,-stride*.26,-.42),Matrix.Identity(4))
            point(rig,'shin.'+label,(sign*.025,stride*.13+max(0,-stride)*.20,-.40),Matrix.Identity(4))
            point(rig,'foot.'+label,(sign*.02,-.17,-.02+max(0,-stride)*.04),Matrix.Identity(4))
            rotate(rig,'upper_arm.'+label,(1,0,0),-stride*.10)
    elif kind in ('Coup_Droit','Revers'):
        sign=1 if kind=='Coup_Droit' else -1
        strength=smooth(0,.16,t)*(1-smooth(.67,1,t))
        sweep=(-1+2*smooth(.18,.50,t))*sign
        rotate(rig,'spine',(0,0,1),sweep*strength*.13)
        rotate(rig,'chest',(0,0,1),sweep*strength*.27)
        torso=rig.pose.bones['chest'].matrix@rig.pose.bones['chest'].bone.matrix_local.inverted()
        for name,target in [('upper_arm.R',(-.16,-.15,-.12)),
                            ('forearm.R',(.33*sweep,-.28,.18-.23*smooth(.22,.52,t)))]:
            b=rig.data.bones[name];rest=(b.tail_local-b.head_local).normalized()
            direction=rest.lerp(Vector(target).normalized(),strength)
            point(rig,name,direction,torso)
        # L'épée traverse devant le torse, en gardant la main attachée au poignet.
        fore=rig.pose.bones['forearm.R'];delta=fore.matrix@fore.bone.matrix_local.inverted()
        hand=rig.pose.bones['hand.R'];rest=hand.bone.matrix_local
        blade=Vector((.90,-.463,-.347)).normalized()
        target=Vector((sweep*.75,-.85,.15-.35*smooth(.2,.5,t))).normalized()
        direction=blade.lerp(target,strength).normalized()
        orientation=torso.to_quaternion()@blade.rotation_difference(direction)@rest.to_quaternion()
        hand.matrix=Matrix.Translation((delta@rest).translation)@orientation.to_matrix().to_4x4()
    elif kind=='Mort':
        fall=smooth(.16,.84,t)
        rotate(rig,'root',(0,1,0),-fall*1.48)
        rotate(rig,'spine',(1,0,0),smooth(0,.38,t)*.30)
        for label in ('R','L'):
            rotate(rig,'thigh.'+label,(1,0,0),smooth(0,.55,t)*-.35)
            rotate(rig,'shin.'+label,(1,0,0),smooth(0,.50,t)*.70)
        rotate(rig,'upper_arm.L',(0,1,0),fall*.35)
    bpy.context.view_layer.update()
    if kind in ('Marche','Mort'):
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor=min((evaluated.matrix_world@Vector(p)).z for p in evaluated.bound_box)
        # L'axe local Y de root est vertical dans Blender.
        rig.pose.bones['root'].location.y-=floor
        bpy.context.view_layer.update()


def make_actions(rig,body):
    rig.animation_data_create();actions={}
    bpy.context.scene.render.fps=FPS
    for name,end in CLIPS.items():
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame in range(0,end+1,2):
            bpy.context.scene.frame_set(frame)
            pose(rig,body,name,frame/end)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                bone.keyframe_insert('location',frame=frame,group=bone.name)
        actions[name]=action;rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,0,action);track.mute=True
    return actions


def export_and_validate(rig,body,sword):
    texture_dir=ROOT/'textures/swordsman'
    texture_dir.mkdir(parents=True,exist_ok=True)
    for image in list(bpy.data.images):
        if image.type!='IMAGE':continue
        maximum=2048 if 'basecolor' in image.name else 1024
        if max(image.size)>maximum:
            ratio=maximum/max(image.size)
            image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
        image.file_format='PNG' if 'normal' in image.name else 'JPEG'
        suffix='.png' if image.file_format=='PNG' else '.jpg'
        image.filepath_raw=str(texture_dir/(Path(image.name).stem+suffix))
        image.save()
        # Recharger le fichier réduit évite de réutiliser les octets 4K empaquetés
        # par l'importeur, qui restent sinon attachés à l'image redimensionnée.
        replacement=bpy.data.images.load(image.filepath_raw,check_existing=False)
        replacement.colorspace_settings.name=image.colorspace_settings.name
        name=image.name
        for material in bpy.data.materials:
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type=='TEX_IMAGE' and node.image==image:node.image=replacement
        bpy.data.images.remove(image)
        replacement.name=name;replacement.pack()
    activate(rig);body.select_set(True);sword.select_set(True)
    export=ROOT/'exports/guerrier_importe.glb'
    rig.animation_data.action=None
    bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
        export_frame_range=False,export_skins=True,export_def_bones=True,export_morph=False,
        export_cameras=False,export_lights=False,export_image_format='AUTO',export_image_quality=90,export_yup=True)
    raw=export.read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length])
    names={a['name'] for a in g.get('animations',[])}
    assert set(CLIPS).issubset(names),names
    assert g.get('skins')
    accessors=g['accessors'];triangles=0
    for mesh in g['meshes']:
        for p in mesh['primitives']:
            assert 'JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes']
            triangles+=accessors[p['indices']]['count']//3
    report={'source':str(SOURCE),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'source_triangles':1932310,'triangles':triangles,'bytes':len(raw),
        'animations':sorted(names),'bones':len(g['skins'][0]['joints']),
        'meshes':len(g['meshes']),'materials':len(g['materials']),
        'textures':[(i.name,list(i.size)) for i in bpy.data.images if i.type=='IMAGE']}
    (ROOT/'logs/swordsman-validation.json').write_text(json.dumps(report,indent=2))
    print('VALIDATION',json.dumps(report),flush=True)
    return export


def main():
    for folder in ['models','exports','previews','logs']:
        (ROOT/folder).mkdir(parents=True, exist_ok=True)
    if '--use-inspection' in sys.argv:
        inspection_file=ROOT/'models/swordsman_inspect.blend'
        bpy.ops.wm.open_mainfile(filepath=str(inspection_file))
        body=bpy.data.objects['Guerrier_Importe']
        for obj in list(bpy.context.scene.objects):
            if obj!=body:bpy.data.objects.remove(obj,do_unlink=True)
    else:body = prepare_mesh()
    camera = setup_preview()
    if '--inspect' in sys.argv:
        for name,position in [('swordsman_source_front.png',(0,-5,1.15)),
                              ('swordsman_source_side.png',(5,0,1.15)),
                              ('swordsman_source_back.png',(0,5,1.15))]:
            render(camera,name,position)
        inspection_file = ROOT / 'models' / 'swordsman_inspect.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(inspection_file))
        return
    sword=split_sword(body);rig=make_rig();bind_meshes(body,sword,rig)
    actions=make_actions(rig,body)
    export=export_and_validate(rig,body,sword)
    rig.animation_data.action=actions['Repos'];bpy.context.scene.frame_set(0)
    blend_file=ROOT/'models/guerrier_importe.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))
    for kind,frame in [('Repos',0),('Marche',8),('Coup_Droit',10),('Revers',10),('Mort',44)]:
        rig.animation_data.action=actions[kind];bpy.context.scene.frame_set(frame)
        if kind=='Mort':
            camera.location=(-.6,-5,2.5)
            camera.rotation_euler=(Vector((-.65,0,.25))-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.ortho_scale=2.4
            bpy.context.scene.render.filepath=str(ROOT/'previews/guerrier_importe_mort.png')
            bpy.ops.render.render(write_still=True)
        else:render(camera,'guerrier_importe_'+kind.lower()+'.png',(0,-5,1.15))
    public=ROOT.parent/'assets/models/guerrier.glb'
    shutil.copyfile(export,public)
    print('PUBLIC',public,flush=True)


if __name__ == '__main__':
    main()
