"""Trois niveaux visuels du blé Eredità, Blender/bpy.
La densité et la hauteur changent avec le niveau de chaque slot ; aucun cycle de croissance.
Régénération : npm run assets:ble. Aucune texture ni dépendance externe.
"""
from pathlib import Path
import bpy, random, math, json, struct
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
for name in ('models','exports','previews','logs'):(ROOT/name).mkdir(parents=True,exist_ok=True)
RNG=random.Random(1745)
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgba(c):return tuple(linear(max(0,min(1,v))) for v in c)+(1,)
def material(name,roughness):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=roughness
    vertex=m.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
    m.node_tree.links.new(vertex.outputs['Color'],bs.inputs['Base Color'])
    return m
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


def point_at(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
VARIANTS={
 'petit':dict(rows=3,columns=5,spacing_x=.15,spacing_y=.075,height=(.135,.17),grain=(.84,.70,.35)),
 'moyen':dict(rows=5,columns=7,spacing_x=.082,spacing_y=.058,height=(.175,.215),grain=(.91,.73,.30)),
 'grand':dict(rows=7,columns=9,spacing_x=.062,spacing_y=.046,height=(.215,.255),grain=(.97,.76,.28))
}
reports=[];comparison=[]
for index,(variant,cfg) in enumerate(VARIANTS.items()):
 RNG=random.Random(1745+index)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.context.preferences.filepaths.save_version=0
 scene=bpy.context.scene;scene.unit_settings.system='METRIC'
 def collection(name):
  c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
 SOIL=collection('01_Terre_labouree');STALKS=collection('02_Tiges_et_feuilles');EARS=collection('03_Epis_et_barbes');STUDIO=collection('90_Studio_non_exporte')
 EARTH=material('Terre_labouree_PBR',.98);WHEAT=material('Ble_dore_PBR',.84)
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

 # Le nombre de sillons suit le niveau de la culture.
 for row in range(cfg['rows']):
     x=(row-(cfg['rows']-1)/2)*cfg['spacing_x']
     vs=[(x+dx,y,z) for y in (-.215,.215) for dx,z in [(-.023,.018),(0,.030),(.023,.018)]]
     earth.append(vs,[(0,3,4,1),(1,4,5,2),(0,1,2),(5,4,3)],(.39,.27,.15),.08)

 # Tiges infléchies, feuilles, grains jumelés et fines barbes, densité propre au niveau.
 for row in range(cfg['rows']):
     for column in range(cfg['columns']):
         x=(row-(cfg['rows']-1)/2)*cfg['spacing_x']+RNG.uniform(-.006,.006)
         y=(column-(cfg['columns']-1)/2)*cfg['spacing_y']+RNG.uniform(-.005,.005)
         h=RNG.uniform(*cfg['height']);angle=RNG.uniform(-.55,.55)+row*.18
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
                 grain(center,axis,.0048*(1-level*.06),.0095,tuple(v-level*.012 for v in cfg['grain']))
                 if level in (1,3):
                     start=center+Vector((0,0,.009));end=start+direction*(sign*.008)+Vector((0,0,.027))
                     thorn(ears,start,end,.00065,(.91,.77,.43))


 objects=[earth.object('Terre_et_sillons',EARTH,SOIL),stems.object('Tiges_et_feuilles',WHEAT,STALKS),ears.object('Epis_et_barbes',WHEAT,EARS)]
 for obj in objects:obj['cropType']='ble';obj['variant']=variant;obj['level']=index+1
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 name='ble_'+variant;glb=ROOT/'exports'/f'{name}.glb'
 assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,
  export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)=={'FINISHED'}
 comparison.append((variant,[(list(b.vertices),list(b.faces),list(b.colors)) for b in (earth,stems,ears)]))
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
 scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
 scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.20,.20,.20)
 for light_name,loc,power,size in [('Soleil',(-2,-3,5),450,4),('Ciel',(3,1,4),250,3)]:
  light=bpy.data.lights.new(light_name,'AREA');light.energy=power;light.shape='DISK';light.size=size
  obj=bpy.data.objects.new(light_name,light);STUDIO.objects.link(obj);obj.location=loc;point_at(obj,(0,0,.12))
 data=bpy.data.meshes.new('Fond');data.from_pydata([(-100,-100,-.005),(100,-100,-.005),(100,100,-.005),(-100,100,-.005)],[],[(0,1,2,3)])
 floor=bpy.data.objects.new('Fond',data);STUDIO.objects.link(floor)
 mat=bpy.data.materials.new('Studio_vert');mat.diffuse_color=(.055,.07,.055,1);data.materials.append(mat)
 data=bpy.data.cameras.new('Camera');data.type='ORTHO';data.ortho_scale=.78
 camera=bpy.data.objects.new('Camera',data);STUDIO.objects.link(camera);camera.location=(.8,-1.2,.9);point_at(camera,(0,0,.14));scene.camera=camera
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/f'{name}.blend'))
 scene.render.filepath=str(ROOT/'previews'/f'{name}_three_quarter.png');assert bpy.ops.render.render(write_still=True)=={'FINISHED'}
 floor.hide_render=True;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA'
 scene.render.resolution_x=512;scene.render.resolution_y=512
 scene.render.filepath=str(ROOT/'previews'/f'{name}_sprite.png');assert bpy.ops.render.render(write_still=True)=={'FINISHED'}
 raw=glb.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
 assert magic==0x46546C67 and version==2 and length==len(raw)
 size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
 triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
 assert triangles<9000 and len(doc['materials'])==2 and not doc.get('animations') and not doc.get('images')
 bpy.context.view_layer.update();points=[obj.matrix_world@Vector(c) for obj in objects for c in obj.bound_box]
 bounds=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
 assert bounds[0]<=.50 and bounds[1]<=.50 and bounds[2]<.40
 reports.append(dict(variant=variant,level=index+1,rows=cfg['rows'],plants=cfg['rows']*cfg['columns'],triangles=triangles,
  materials=2,textures=0,bytes=length,dimensions_three=[bounds[0],bounds[2],bounds[1]],runtime_batches=2))

# Comparatif à échelle identique.
for obj in objects:obj.hide_render=True
floor.hide_render=False;scene.render.film_transparent=False;scene.render.image_settings.color_mode='RGB'
for i,(variant,batches) in enumerate(comparison):
 for j,(vertices,faces,colors) in enumerate(batches):
  b=Batch();b.vertices=[(x+(i-1)*.70,y,z) for x,y,z in vertices];b.faces=faces;b.colors=colors
  b.object(variant+str(j),EARTH if j==0 else WHEAT,SOIL)
 data=bpy.data.curves.new('Titre_'+variant,'FONT');data.body='TIER '+str(i+1);data.align_x='CENTER';data.size=.06
 label=bpy.data.objects.new('Titre_'+variant,data);STUDIO.objects.link(label);label.location=((i-1)*.70,-.38,.02)
 ink=bpy.data.materials.new('Titre_clair');ink.use_nodes=True;ink.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.82,.65,.35,1);data.materials.append(ink)
camera.location=(.4,-3.4,2.6);point_at(camera,(0,0,.12));camera.data.ortho_scale=2.30
scene.render.resolution_x=1600;scene.render.resolution_y=800
scene.render.filepath=str(ROOT/'previews/ble_tiers_comparatif.png');assert bpy.ops.render.render(write_still=True)=={'FINISHED'}
(ROOT/'logs/ble-tiers-validation.json').write_text(json.dumps(reports,indent=2)+'\n')
print('BLE_TIERS_VALIDATION',json.dumps(reports))
