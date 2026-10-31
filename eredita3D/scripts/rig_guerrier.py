"""Rig de jeu du guerrier existant et export de quatre actions glTF.

Le modèle de référence en T-pose reste intact. Seuls guerrier_jeu.blend,
guerrier_jeu.glb, ses aperçus et la copie publique assets/models sont produits.
Blender 5.1.1 ; aucun addon ni paquet externe à installer.
"""
from pathlib import Path
import json
import math
import shutil
import struct

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'models/guerrier.blend'
BLEND=ROOT/'models/guerrier_jeu.blend'
EXPORT=ROOT/'exports/guerrier_jeu.glb'
PUBLIC=ROOT.parent/'assets/models/guerrier.glb'
FPS=30
CLIPS={'Repos':60,'Marche':30,'Coup_Droit':24,'Revers':24}


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj


def make_rig():
    data=bpy.data.armatures.new('Squelette_Guerrier')
    rig=bpy.data.objects.new('Rig_Guerrier',data)
    bpy.context.scene.collection.objects.link(rig)
    activate(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    specifications=[('root',(0,0,0),(0,0,.12),None),
        ('pelvis',(0,0,.94),(0,0,1.05),'root'),
        ('spine',(0,0,1.05),(0,0,1.25),'pelvis'),
        ('chest',(0,0,1.25),(0,0,1.46),'spine'),
        ('neck',(0,0,1.46),(0,0,1.57),'chest'),
        ('head',(0,0,1.57),(0,0,1.80),'neck')]
    for sign,label in [(-1,'R'),(1,'L')]:
        specifications.extend([
            ('clavicle.'+label,(0,0,1.435),(sign*.205,0,1.435),'chest'),
            ('upper_arm.'+label,(sign*.205,0,1.435),(sign*.475,0,1.435),'clavicle.'+label),
            ('forearm.'+label,(sign*.475,0,1.435),(sign*.735,0,1.435),'upper_arm.'+label),
            ('hand.'+label,(sign*.735,0,1.435),(sign*.825,0,1.435),'forearm.'+label),
            ('thigh.'+label,(sign*.095,0,.94),(sign*.095,0,.53),'pelvis'),
            ('shin.'+label,(sign*.095,0,.53),(sign*.095,0,.14),'thigh.'+label),
            ('foot.'+label,(sign*.095,0,.14),(sign*.095,-.15,.055),'shin.'+label)])
    for name,head,tail,parent in specifications:
        bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:
            bone.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for bone in rig.pose.bones:
        bone.rotation_mode='QUATERNION'
    return rig


def smooth(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)))
    return t*t*(3-2*t)


def mix_weights(first,second,t):
    return {first:1-t,second:t}


def torso_weights(z):
    if z<1.16:
        return mix_weights('pelvis','spine',smooth(1.03,1.16,z))
    return mix_weights('spine','chest',smooth(1.16,1.36,z))


def weights(obj,co):
    name=obj.name
    label='R' if co.x<0 else 'L'
    if name.startswith(('Paume_','Doigt_','Pouce_')):
        return {'hand.'+label:1}
    if name.startswith(('Brassard','Bord_brassard','Rivet_brassard')):
        return {'forearm.'+label:1}
    if name.startswith(('Bras_','Manche_retroussee','Revers_roule')):
        x=abs(co.x)
        if x<.25:
            return mix_weights('chest','upper_arm.'+label,smooth(.13,.25,x))
        if x<.56:
            return mix_weights('upper_arm.'+label,'forearm.'+label,smooth(.43,.53,x))
        return mix_weights('forearm.'+label,'hand.'+label,smooth(.695,.76,x))
    if name.startswith(('Jambe_','Pantalon_jambe','Botte_','Semelle','Rebord_botte','Couture_botte')):
        if co.z>.86:
            return mix_weights('thigh.'+label,'pelvis',smooth(.86,.98,co.z))
        if co.z>.43:
            return mix_weights('shin.'+label,'thigh.'+label,smooth(.44,.59,co.z))
        return mix_weights('foot.'+label,'shin.'+label,smooth(.13,.22,co.z))
    if name.startswith(('Tete','Nez','Oreille','Relief_oreille','Oeil','Iris','Pupille','Paupiere','Sourcil','Levre',
        'Calotte','Meche','Barbe','Moustache','Relief_barbe','Bandeau','Noeud_bandeau','Pan_bandeau')):
        return {'head':1}
    if name.startswith('Cou') and name!='Couture_botte':
        return mix_weights('chest','neck',smooth(1.465,1.53,co.z))
    if name.startswith(('Etoffe','Pli_etoffe','Noeud_etoffe','Ceinture','Boucle_montant','Boucle_traverse','Ardillon',
        'Pan_gilet','Pantalon_ceinture')):
        return {'pelvis':1}
    return torso_weights(co.z)


def close_sword_hand(obj):
    if obj.name.startswith('Doigt_D_'):
        length=[.075,.087,.081,.066][int(obj.name.split('_')[-1])]
        inv=obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            co=obj.matrix_world@vertex.co
            t=max(0,min(1,(-co.x-.810)/length))
            angle=.7-2.7*t
            co.x=-.79-.026*math.cos(angle)
            co.z=1.418+.026*math.sin(angle)+(co.z-1.433)
            vertex.co=inv@co
    elif obj.name.startswith('Pouce_D'):
        inv=obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            co=obj.matrix_world@vertex.co
            co.y*=.75;co.z-=.014
            vertex.co=inv@co


def skin_model(rig):
    original=[obj for obj in bpy.context.scene.objects if obj.type=='MESH'
        and not any(c.name.startswith('90_') for c in obj.users_collection)]
    sword=bpy.data.objects['Epee_Acier']
    for obj in original:
        activate(obj)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        close_sword_hand(obj)
        if obj==sword:
            # Dans la pose de liaison, garde devant la paume et lame vers l'avant.
            obj.matrix_world=Matrix.Translation(Vector((-.803,-.058,1.418)))@Matrix.Rotation(-math.pi/2,4,'X')
        bpy.context.view_layer.update()
        matrix=obj.matrix_world.copy()
        for vertex in obj.data.vertices:
            vertex.co=matrix@vertex.co
        obj.parent=None;obj.matrix_world=Matrix.Identity(4)
        groups={name:obj.vertex_groups.new(name=name) for name in rig.data.bones.keys()}
        for vertex in obj.data.vertices:
            values={'hand.R':1} if obj==sword else weights(obj,vertex.co)
            for name,value in values.items():
                if value>1e-6:
                    groups[name].add([vertex.index],value,'REPLACE')
    activate(original[0])
    body=[obj for obj in original if obj!=sword]
    for obj in body:obj.select_set(True)
    bpy.context.view_layer.objects.active=body[0]
    bpy.ops.object.join()
    body=bpy.context.object;body.name='Guerrier_Anime'
    for obj in (body,sword):
        obj.parent=rig
        modifier=obj.modifiers.new('Deformation_squelette','ARMATURE')
        modifier.object=rig;modifier.use_vertex_groups=True
        obj['asset']='guerrier_corse'
    return body,sword


def rotate_global(rig,name,axis,angle):
    bone=rig.pose.bones[name]
    parent=bone.parent
    delta=parent.matrix@parent.bone.matrix_local.inverted() if parent else Matrix.Identity(4)
    rest=bone.bone.matrix_local
    rotation=Quaternion(Vector(axis),angle).to_matrix().to_4x4()
    bone.matrix=delta@Matrix.Translation(rest.translation)@rotation@rest.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()


def point_bone(rig,name,direction,torso_delta,roll=0):
    bone=rig.pose.bones[name]
    rest=bone.bone.matrix_local
    parent=bone.parent
    head=(parent.matrix@parent.bone.matrix_local.inverted()@rest).translation
    original=(bone.bone.tail_local-bone.bone.head_local).normalized()
    direction=Vector(direction).normalized()
    rotation=original.rotation_difference(direction)
    orientation=torso_delta.to_quaternion()@rotation@rest.to_quaternion()
    if roll:
        orientation=Quaternion(torso_delta.to_quaternion()@direction,roll)@orientation
    bone.matrix=Matrix.Translation(head)@orientation.to_matrix().to_4x4()
    bpy.context.view_layer.update()


def pose(rig,kind,t):
    for bone in rig.pose.bones:
        bone.matrix_basis=Matrix.Identity(4)
    breathing=math.sin(t*math.tau)
    swing=0
    if kind in ('Coup_Droit','Revers'):
        # Anticipation brève, traversée du plan avant, puis retour en garde.
        keys=[(0,0),(.16,-1),(.43,1),(.68,.75),(1,0)]
        for (a,x),(b,y) in zip(keys,keys[1:]):
            if a<=t<=b:
                u=smooth(a,b,t);swing=x+(y-x)*u;break
        swing*=1 if kind=='Coup_Droit' else -1
    rotate_global(rig,'spine',(0,0,1),swing*.18)
    rotate_global(rig,'chest',(0,0,1),swing*.28)
    rotate_global(rig,'head',(0,0,1),-swing*.10)
    chest=rig.pose.bones['chest']
    torso_delta=chest.matrix@chest.bone.matrix_local.inverted()
    if kind in ('Coup_Droit','Revers'):
        upper=(-.25,-.24-.04*abs(swing),-.14)
        fore=(.34*swing,-.52,.13-.1*abs(swing))
    else:
        wave=math.sin(t*math.tau) if kind=='Marche' else 0
        upper=(-.11,-.06+wave*.08,-.27)
        fore=(-.06,-.18+wave*.04,-.19)
    point_bone(rig,'upper_arm.R',upper,torso_delta)
    point_bone(rig,'forearm.R',fore,torso_delta)
    point_bone(rig,'hand.R',fore,torso_delta,roll=-.15)
    point_bone(rig,'upper_arm.L',(.12,-.03,-.28),torso_delta)
    point_bone(rig,'forearm.L',(.03,-.16,-.24),torso_delta)
    point_bone(rig,'hand.L',(.02,-.10,-.10),torso_delta)
    if kind=='Marche':
        for sign,label in [(-1,'R'),(1,'L')]:
            stride=math.sin(t*math.tau)*sign
            rotate_global(rig,'thigh.'+label,(1,0,0),stride*.38)
            rotate_global(rig,'shin.'+label,(1,0,0),max(0,-stride)*.55)
            rotate_global(rig,'foot.'+label,(1,0,0),-stride*.12)
    elif kind=='Repos':
        rig.pose.bones['root'].location.z=breathing*.003
    bpy.context.view_layer.update()


def make_actions(rig):
    rig.animation_data_create()
    actions={}
    for kind,end in CLIPS.items():
        action=bpy.data.actions.new(kind)
        rig.animation_data.action=action
        for frame in range(0,end+1,2):
            bpy.context.scene.frame_set(frame)
            pose(rig,kind,frame/end)
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                bone.keyframe_insert('location',frame=frame,group=bone.name)
        actions[kind]=action
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new();track.name=kind
        track.strips.new(kind,0,action)
        track.mute=True
    return actions


def validate_export():
    raw=EXPORT.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',raw,0)
    assert magic==b'glTF' and version==2 and length==len(raw)
    size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size])
    names={animation['name'] for animation in doc.get('animations',[])}
    assert set(CLIPS).issubset(names), names
    assert doc.get('skins') and all(len(skin['joints'])>=18 for skin in doc['skins'])
    assert any(node.get('name')=='Epee_Acier' for node in doc['nodes'])
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            assert 'JOINTS_0' in primitive['attributes'] and 'WEIGHTS_0' in primitive['attributes']
    return {'animations':sorted(names),'bones':len(doc['skins'][0]['joints']),
        'bytes':len(raw),'meshes':len(doc['meshes'])}


def main():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    bpy.context.scene.render.fps=FPS
    bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=60
    rig=make_rig()
    body,sword=skin_model(rig)
    actions=make_actions(rig)
    activate(rig);body.select_set(True);sword.select_set(True)
    EXPORT.parent.mkdir(parents=True,exist_ok=True)
    assert bpy.ops.export_scene.gltf(filepath=str(EXPORT),export_format='GLB',use_selection=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
        export_anim_slide_to_zero=True,export_cameras=False,export_lights=False)=={'FINISHED'}
    report=validate_export()
    rig.animation_data.action=actions['Repos']
    bpy.context.scene.frame_set(0)
    for track in rig.animation_data.nla_tracks:track.mute=True
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    PUBLIC.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(EXPORT,PUBLIC)
    for kind in ('Coup_Droit','Revers'):
        rig.animation_data.action=actions[kind]
        for suffix,frame in [('preparation',4),('impact',11)]:
            bpy.context.scene.frame_set(frame)
            bpy.context.scene.render.filepath=str(ROOT/f'previews/guerrier_{kind.lower()}_{suffix}.png')
            bpy.ops.render.render(write_still=True)
    (ROOT/'logs/guerrier-jeu-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print('GUERRIER_ANIME_OK '+json.dumps(report),flush=True)


if __name__=='__main__':main()
