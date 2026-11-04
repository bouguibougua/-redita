"""Champ de blé V1 pour les emplacements du plateau Eredità.
Blender 5.1.1 / bpy, sans dépendance à installer ni texture externe.
Le modèle est visuel : aucune croissance ou règle économique nouvelle.
"""
from pathlib import Path
import bpy
import bmesh
import random
import math
import json
import struct
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
for name in ('models','exports','previews','logs'):
    (ROOT/name).mkdir(parents=True,exist_ok=True)
RNG=random.Random(1745)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.unit_settings.system='METRIC'

def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
SOIL=collection('01_Terre_labouree')
STALKS=collection('02_Tiges_et_feuilles')
EARS=collection('03_Epis_et_barbes')
STUDIO=collection('90_Studio_non_exporte')

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgba(c):return tuple(linear(max(0,min(1,v))) for v in c)+(1,)
def material(name,roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=roughness
    vertex=m.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
    m.node_tree.links.new(vertex.outputs['Color'],bs.inputs['Base Color'])
    return m
EARTH=material('Terre_labouree_PBR',.98)
WHEAT=material('Ble_dore_PBR',.84)

class Batch:
    def __init__(self):self.vertices=[];self.faces=[];self.colors=[]
    def append(self,vertices,faces,tint,shade=.05):
        start=len(self.vertices);self.vertices.extend(vertices)
        self.faces.extend(tuple(start+i for i in face) for face in faces)
        self.colors.extend(tuple(v*RNG.uniform(1-shade,1+shade) for v in tint) for _ in faces)
    def object(self,name,mat,col):
        data=bpy.data.meshes.new(name);data.from_pydata(self.vertices,[],self.faces);data.materials.append(mat);data.update()
        attr=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        for face,tint in zip(data.polygons,self.colors):
            for i in face.loop_indices:attr.data[i].color=rgba(tint)
        obj=bpy.data.objects.new(name,data);col.objects.link(obj);return obj

earth,stems,ears=Batch(),Batch(),Batch()
# Une butte discrète à angles arrondis, qui tient entièrement dans un slot.
edge=[]
for cx,cy,start in [(.205,.205,0),(-.205,.205,90),(-.205,-.205,180),(.205,-.205,270)]:
    for j in range(4):
        a=math.radians(start+j*30);edge.append((cx+.035*math.cos(a),cy+.035*math.sin(a)))
vs=[(x,y,z) for z in (0,.018) for x,y in edge]
n=len(edge)
faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
earth.append(vs,faces,(.30,.20,.11),.07)

# Cinq sillons longs ; leurs faces éclairées différencient la terre retournée.
for row in range(5):
    x=(row-2)*.083
    vs=[(x+dx,y,z) for y in (-.215,.215) for dx,z in [(-.023,.018),(0,.030),(.023,.018)]]
    earth.append(vs,[(0,3,4,1),(1,4,5,2),(0,1,2),(5,4,3)],(.39,.27,.15),.08)

bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=1,radius=1)
bm.verts.ensure_lookup_table();bm.verts.index_update()
ico_v=[tuple(v.co) for v in bm.verts];ico_f=[tuple(v.index for v in f.verts) for f in bm.faces];bm.free()
for _ in range(17):
    x,y=RNG.uniform(-.218,.218),RNG.uniform(-.218,.218);r=RNG.uniform(.004,.009)
    earth.append([(x+a*r,y+b*r,.021+c*r*.55) for a,b,c in ico_v],ico_f,(.41,.30,.18),.10)

def tube(batch,points,radii,tint,sides=3):
    vs=[]
    for p,r in zip(points,radii):
        vs.extend((p[0]+r*math.cos(math.tau*j/sides),p[1]+r*math.sin(math.tau*j/sides),p[2]) for j in range(sides))
    fs=[]
    for ring in range(len(points)-1):
        for j in range(sides):
            a=ring*sides+j;b=ring*sides+(j+1)%sides
            fs.append((a,b,b+sides,a+sides))
    fs.extend([tuple(reversed(range(sides))),tuple(range(len(vs)-sides,len(vs)))])
    batch.append(vs,fs,tint)

def thorn(batch,start,end,width,tint):
    p=Vector(start);axis=(Vector(end)-p).normalized()
    a=axis.cross(Vector((0,1,0))).normalized()*width;b=axis.cross(a).normalized()*width*.6
    batch.append([tuple(p+a),tuple(p-a),tuple(p+b),tuple(end)],[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],tint)

def grain(center,axis,width,length,tint):
    q=Vector(axis).to_track_quat('Z','Y')
    local=[(0,0,-length),(-width,0,0),(0,-width*.65,0),(width,0,0),(0,width*.65,0),(0,0,length)]
    vertices=[tuple(Vector(center)+q@Vector(v)) for v in local]
    ears.append(vertices,[(0,2,1),(0,3,2),(0,4,3),(0,1,4),(5,1,2),(5,2,3),(5,3,4),(5,4,1)],tint,.035)

# 35 plants distincts : tiges infléchies, feuilles, grains jumelés et fines barbes.
for row in range(5):
    for column in range(7):
        x=(row-2)*.083+RNG.uniform(-.006,.006)
        y=(column-3)*.058+RNG.uniform(-.005,.005)
        h=RNG.uniform(.175,.225);angle=RNG.uniform(-.55,.55)+row*.18
        direction=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-math.sin(angle),math.cos(angle),0))
        bend=direction*RNG.uniform(.005,.015)
        top=Vector((x+bend.x,y+bend.y,h))
        stem_color=RNG.choice([(.68,.57,.24),(.75,.62,.28),(.62,.56,.24)])
        tube(stems,[(x,y,.027),(x+bend.x*.3,y+bend.y*.3,h*.55),tuple(top)], [.0024,.002,.0015],stem_color)
        for k,sign in enumerate((1,-1)):
            z=h*(.37+k*.25);root=Vector((x,y,z));out=direction*sign
            tip=root+out*RNG.uniform(.035,.05)+Vector((0,0,.028))
            mid=root+out*.025+Vector((0,0,.021));width=.006
            stems.append([tuple(root),tuple(mid+side*width),tuple(mid-side*width),tuple(tip),tuple(mid+Vector((0,0,.0015)))],
                         [(0,1,4),(0,4,2),(1,3,4),(4,3,2),(0,2,1),(1,2,3)],(.58,.53,.23),.04)
        tube(ears,[tuple(top),tuple(top+Vector((0,0,.064)))],[.002,.0009],(.77,.64,.28))
        for level in range(4):
            for sign in (-1,1):
                center=top+direction*(sign*.0065)+Vector((0,0,.010+level*.013))
                axis=direction*(sign*.42)+Vector((0,0,1))
                grain(center,axis,.0048*(1-level*.06),.0095,(.89-level*.015,.70-level*.014,.31-level*.009))
                if level in (1,3):
                    start=center+Vector((0,0,.009));end=start+direction*(sign*.008)+Vector((0,0,.027))
                    thorn(ears,start,end,.00065,(.91,.77,.43))

objects=[earth.object('Terre_et_sillons',EARTH,SOIL),stems.object('Tiges_et_feuilles',WHEAT,STALKS),ears.object('Epis_et_barbes',WHEAT,EARS)]
for obj in objects:obj['cropType']='ble'
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
glb=ROOT/'exports/ble.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,
    export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)=={'FINISHED'}

def point_at(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.20,.20,.20)
for name,loc,power,size in [('Soleil',(-2,-3,5),450,4),('Ciel',(3,1,4),250,3)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size
    obj=bpy.data.objects.new(name,light);STUDIO.objects.link(obj);obj.location=loc;point_at(obj,(0,0,.12))
data=bpy.data.meshes.new('Fond');data.from_pydata([(-100,-100,-.005),(100,-100,-.005),(100,100,-.005),(-100,100,-.005)],[],[(0,1,2,3)])
floor=bpy.data.objects.new('Fond',data);STUDIO.objects.link(floor)
mat=bpy.data.materials.new('Studio_vert');mat.diffuse_color=(.055,.07,.055,1);data.materials.append(mat)
cameras={}
for name,loc in {'three_quarter':(.8,-1.2,.9),'top':(0,0,2),'detail':(.7,-1.1,.46)}.items():
    data=bpy.data.cameras.new('Camera_'+name);data.type='ORTHO';data.ortho_scale=.78
    cam=bpy.data.objects.new('Camera_'+name,data);STUDIO.objects.link(cam);cam.location=loc;point_at(cam,(0,0,.12));cameras[name]=cam
scene.camera=cameras['three_quarter']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/ble.blend'))
for name,cam in cameras.items():
    scene.camera=cam;scene.render.filepath=str(ROOT/'previews'/f'ble_{name}.png')
    assert bpy.ops.render.render(write_still=True)=={'FINISHED'}
floor.hide_render=True;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=512;scene.render.resolution_y=512;scene.camera=cameras['three_quarter']
scene.render.filepath=str(ROOT/'previews/ble_sprite.png');assert bpy.ops.render.render(write_still=True)=={'FINISHED'}

raw=glb.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
assert magic==0x46546C67 and version==2 and length==len(raw)
size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert triangles<5000 and len(doc['materials'])==2 and not doc.get('animations')
assert not doc.get('images')
bpy.context.view_layer.update();points=[obj.matrix_world@Vector(c) for obj in objects for c in obj.bound_box]
bounds=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
assert bounds[0]<.52 and bounds[1]<.52
report={'triangles':triangles,'plants':35,'materials':2,'textures':0,'bytes':length,
        'dimensions_three':[bounds[0],bounds[2],bounds[1]],'runtime_batches':2,
        'note':'Représentation mûre statique, sans modification des récoltes ; performances Quest physique à mesurer.'}
(ROOT/'logs/ble-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('BLE_VALIDATION',json.dumps(report))
