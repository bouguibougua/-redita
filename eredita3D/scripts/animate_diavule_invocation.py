"""Reprend les poses et le rythme du clip fourni (1,636 s) sur le Diavule Tripo.
Blender --background --python animate_diavule_invocation.py
Le rig et les textures du modèle fourni sont conservés.
"""
from pathlib import Path
import bpy,math,json,shutil
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'models/diavule.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.fps=30
rig=next(o for o in scene.objects if o.type=='ARMATURE')
rig.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
axes={b.name:b.bone.matrix_local.to_quaternion().inverted() for b in rig.pose.bones}
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
def smooth(a,b,t):
    v=max(0,min(1,(t-a)/(b-a)));return v*v*(3-2*v)
def rotate(name,axis,angle):
    b=rig.pose.bones.get(name)
    if b:b.rotation_quaternion=b.rotation_quaternion@Quaternion((axes[name]@Vector(axis)).normalized(),angle)
def sample_pose(sec, keys):
    for (a,va),(b,vb) in zip(keys,keys[1:]):
        if sec<=b:return va+(vb-va)*smooth(a,b,sec)
    return keys[-1][1]
def aim(name,direction):
    # Oriente l'axe du bras sans changer sa longueur ni le roulis du rig fourni.
    bone=rig.pose.bones[name];matrix=bone.matrix.copy()
    delta=(matrix.to_quaternion()@Vector((0,1,0))).rotation_difference(Vector(direction).normalized())
    rotated=delta.to_matrix().to_4x4()@matrix;rotated.translation=matrix.translation
    bone.matrix=rotated;bpy.context.view_layer.update()
def pose(kind,t):
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    sec=t*(49/30 if kind=='Invocation' else 1.6)
    invocation=kind=='Invocation';flap=math.sin(t*math.tau)
    # Les poses sont calées sur le clip : compression, poussée d'ailes,
    # suspension bras levé, descente rapide, absorption puis reprise d'appui.
    cast=sample_pose(sec,[(0,0),(.22,0),(.60,1),(1.08,1),(1.40,.35),(1.53,0),(49/30,0)]) if invocation else 0
    lift=sample_pose(sec,[(0,0),(.20,0),(.46,.25),(.70,.43),(1.04,.45),(1.17,.38),(1.42,0),(49/30,0)]) if invocation else 0
    crouch=sample_pose(sec,[(0,.20),(.18,.58),(.40,0),(1.20,0),(1.44,1),(1.54,.65),(49/30,0)]) if invocation else 0
    spread=sample_pose(sec,[(0,.12),(.17,.05),(.43,1),(.55,1),(1.05,.62),(1.28,.32),(1.46,.05),(49/30,.16)]) if invocation else .16+.065*flap
    fold=sample_pose(sec,[(0,.15),(.20,.42),(.43,-.12),(.76,.18),(1.14,.10),(1.44,.36),(49/30,.15)]) if invocation else .15+.09*flap
    hover=lift/.45
    rotate('mixamorig:Spine',(1,0,0),-.12*cast+.25*crouch+.012*flap*(not invocation))
    rotate('mixamorig:Spine1',(0,0,1),-.11*cast)
    rotate('mixamorig:Spine2',(0,1,0),-.08*cast)
    rotate('mixamorig:Head',(1,0,0),-.30*cast+.10*crouch)
    rotate('mixamorig:Head',(0,0,1),.15*cast)
    for side,sign in [('Left',1),('Right',-1)]:
        rotate('Wing_'+side,(0,1,0),sign*(-.95*spread))
        rotate('Wing_'+side,(0,0,1),sign*fold)
        rotate('WingTip_'+side,(0,1,0),sign*(-.15*spread))
        rotate('WingTip_'+side,(0,0,1),sign*(.18*math.sin(sec*7-.7)*(hover if invocation else .5)+.22*crouch))
        rotate('mixamorig:'+side+'Arm',(0,1,0),sign*(1.15-(2.60 if side=='Left' else .40)*cast-.18*crouch))
        rotate('mixamorig:'+side+'ForeArm',(0,0,1),-sign*(.14+.28*crouch))
        rotate('mixamorig:'+side+'UpLeg',(1,0,0),-.14-(.34 if side=='Left' else .20)*hover-.63*crouch)
        rotate('mixamorig:'+side+'Leg',(1,0,0),.22+(.56 if side=='Left' else 1.02)*hover+1.05*crouch)
        rotate('mixamorig:'+side+'Foot',(1,0,0),-.08-.24*hover-.42*crouch)
        rotate('mixamorig:'+side+'UpLeg',(0,1,0),sign*(.07+.09*crouch))
        for finger in ['Index','Middle','Ring','Pinky']:
            for segment in [1,2,3]:rotate('mixamorig:'+side+'Hand'+finger+str(segment),(1,0,0),-.20*cast)
    bpy.context.view_layer.update()
    # Coude droit fléchi, paume devant le torse pendant l'élévation.
    def between(a,b):return tuple(x+(y-x)*cast for x,y in zip(a,b))
    aim('mixamorig:RightArm',between((-.32,-.12,-.94),(-.60,-.48,-.44)))
    aim('mixamorig:RightForeArm',between((-.12,-.25,-.96),(.13,-.50,.86)))
    # Calage du pied le plus bas : pas de pieds qui flottent à la réception.
    foot_floor=min((rig.pose.bones['mixamorig:'+side+'ToeBase'].head.z for side in ['Left','Right']))
    rest_floor=min((rig.data.bones['mixamorig:'+side+'ToeBase'].head_local.z for side in ['Left','Right']))
    rig.pose.bones['mixamorig:Hips'].location=axes['mixamorig:Hips']@Vector((0,0,rest_floor-foot_floor+lift))
clips={'Battement':48,'Invocation':49};actions={};rig.animation_data_create()
for name,end in clips.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(end+1):
        scene.frame_set(frame);pose(name,frame/end)
        for b in rig.pose.bones:
            b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name);b.keyframe_insert('location',frame=frame,group=b.name)
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
report=json.loads((ROOT/'logs/diavule-validation.json').read_text());report.update({'reference':'ScreenRecording_11-08-2026 18.mov','invocationDuration':49/30,'keyPoses':{'ghost':0,'flash':.3,'spreadWings':.5,'raisedLeftArm':.7,'landing':1.44,'takeoff':.43,'apex':1.04},'bytes':out.stat().st_size,'revision':3,'motion':'anticipation, wing-driven lift, raised arm, bent legs, grounded landing'})
(ROOT/'logs/diavule-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
