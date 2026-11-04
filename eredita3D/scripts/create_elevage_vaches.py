"""Élevage de vaches pour Eredità, trois enclos de plateau et animaux en volumes.
Blender/bpy ; les effectifs, naissances, traite et abattages restent gérés par le jeu.
"""
from pathlib import Path
import bpy, bmesh, math, random, json, struct
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
for folder in ('models','exports','previews','logs'):(ROOT/folder).mkdir(parents=True,exist_ok=True)

def linear(v):
    v=max(0,min(1,v));return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

class Batch:
    def __init__(self):self.vertices=[];self.faces=[];self.colors=[]
    def add(self,vertices,faces,color,shade=.035):
        n=len(self.vertices);self.vertices.extend(vertices)
        self.faces.extend(tuple(n+i for i in f) for f in faces)
        self.colors.extend(tuple(c*RNG.uniform(1-shade,1+shade) for c in color) for _ in faces)
    def object(self,name,mat,collection,role,index=None):
        data=bpy.data.meshes.new(name);data.from_pydata(self.vertices,[],self.faces);data.materials.append(mat);data.update()
        attr=data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        for face,color in zip(data.polygons,self.colors):
            for i in face.loop_indices:attr.data[i].color=tuple(linear(c) for c in color)+(1,)
        obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj['livestockRole']=role
        if index is not None:obj['animalIndex']=index
        return obj

def ico(detail):
    bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=detail,radius=1)
    bm.verts.ensure_lookup_table();bm.verts.index_update()
    result=([tuple(v.co) for v in bm.verts],[tuple(v.index for v in f.verts) for f in bm.faces]);bm.free();return result
ICOS={i:ico(i) for i in (1,2)}

def ellipsoid(batch,center,radii,color,detail=1,angle=0):
    vs,fs=ICOS[detail];c,s=math.cos(angle),math.sin(angle)
    batch.add([(center[0]+x*radii[0]*c-y*radii[1]*s,center[1]+x*radii[0]*s+y*radii[1]*c,center[2]+z*radii[2]) for x,y,z in vs],fs,color)

def box(batch,center,size,color):
    x,y,z=center;a,b,c=[v/2 for v in size]
    batch.add([(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],
        [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color)

def tube(batch,points,radii,color,sides=6):
    points=[Vector(p) for p in points];vs=[]
    for i,(p,r) in enumerate(zip(points,radii)):
        axis=points[min(i+1,len(points)-1)]-points[max(0,i-1)]
        q=axis.to_track_quat('Z','Y')
        vs.extend(tuple(p+q@Vector((r*math.cos(j*math.tau/sides),r*math.sin(j*math.tau/sides),0))) for j in range(sides))
    fs=[]
    for k in range(len(points)-1):
        for j in range(sides):a=k*sides+j;b=k*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
    fs.extend([tuple(reversed(range(sides))),tuple(range(len(vs)-sides,len(vs)))])
    batch.add(vs,fs,color)

def cow(batch):
    coat=(.54,.37,.22);cream=(.85,.79,.64);dark=(.19,.16,.125);horn=(.73,.66,.49)
    # Volume continu : croupe, ventre, cage thoracique et épaule.
    sections=[(-.077,.117,.018,.033),(-.060,.118,.032,.043),(-.029,.113,.039,.048),(.014,.116,.037,.047),(.045,.128,.029,.043),(.059,.136,.020,.029)]
    vertices=[(x,ry*math.cos(j*math.tau/12),z+rz*math.sin(j*math.tau/12)) for x,z,ry,rz in sections for j in range(12)]
    faces=[(k*12+j,k*12+(j+1)%12,(k+1)*12+(j+1)%12,(k+1)*12+j) for k in range(len(sections)-1) for j in range(12)]
    faces.extend([tuple(reversed(range(12))),tuple(range(len(vertices)-12,len(vertices)))])
    batch.add(vertices,faces,coat)
    tube(batch,[(.039,0,.120),(.064,0,.152),(.080,0,.178)],[.028,.024,.018],coat,8)
    ellipsoid(batch,(.096,0,.181),(.025,.019,.034),cream,2)
    ellipsoid(batch,(.120,0,.156),(.025,.020,.017),cream,2)
    ellipsoid(batch,(.139,0,.155),(.012,.019,.011),(.32,.25,.20),2)
    # Museau large et deux narines distinctes.
    for side in (-1,1):
        ellipsoid(batch,(.147,side*.009,.159),(.003,.004,.0025),dark)
        ellipsoid(batch,(.107,side*.018,.192),(.0045,.0027,.0035),dark)
        ellipsoid(batch,(.108,side*.020,.193),(.0015,.0008,.0011),cream)
        # Oreilles larges, cornes courtes relevées et pointes sombres.
        points=[(.077,side*.013,.197),(.071,side*.049,.193),(.095,side*.032,.189),(.082,side*.024,.202)]
        batch.add(points,[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],coat)
        batch.add([(.080,side*.021,.197),(.075,side*.039,.194),(.090,side*.030,.193)],[(0,1,2)],(.59,.38,.28),0)
        tube(batch,[(.085,side*.012,.205),(.076,side*.035,.217),(.076,side*.049,.228),(.084,side*.054,.240)], [.005,.004,.0025,0],horn,5)
    # Membres longs, jarrets et sabots fendus.
    for x in (-.055,.035):
        for side in (-1,1):
            y=side*.026;dx=-.006 if x<0 else .003
            tube(batch,[(x,y,.108),(x+dx,y,.063),(x+.003,y,.028)],[.010,.0065,.0055],coat,6)
            for split in (-1,1):ellipsoid(batch,(x+.006,y+split*.0035,.024),(.008,.0038,.0055),dark)
    # Mamelle et quatre trayons, comme détail visuel de la vache laitière.
    udder=(.72,.48,.40)
    ellipsoid(batch,(-.025,0,.062),(.024,.017,.012),udder,2)
    for x in (-.034,-.017):
        for y in (-.008,.008):tube(batch,[(x,y,.055),(x+.001,y,.046)],[.003,.002],udder,5)
    # Longue queue souple avec touffe terminale.
    tube(batch,[(-.076,0,.135),(-.094,.004,.120),(-.105,.006,.078),(-.101,.006,.051)],[.004,.003,.0025,.002],coat,5)
    ellipsoid(batch,(-.101,.006,.045),(.006,.004,.012),dark)
    # Marques claires sur les flancs et collier avec cloche.
    for side in (-1,1):ellipsoid(batch,(-.025,side*.035,.119),(.033,.004,.021),(.76,.68,.51),2)
    points=[(.068,math.cos(i*math.tau/12)*.023,.151+math.sin(i*math.tau/12)*.023) for i in range(13)]
    tube(batch,points,[.002]*13,(.32,.20,.10),4)
    ellipsoid(batch,(.070,0,.122),(.007,.006,.007),(.64,.48,.23))

def fence(batch,half):
    wood=(.40,.29,.17)
    for x in (-half,0,half):
        for y in (-half,half):
            tube(batch,[(x,y,.022),(x+.002,y,.13)],[.009,.007],wood,5)
    for x in (-half,half):
        tube(batch,[(x,0,.022),(x,0,.13)],[.009,.007],wood,5)
    for z in (.065,.104):
        for y in (-half,half):tube(batch,[(-half,y,z),(half,y,z+.003)],[.004,.004],wood,4)
        for x in (-half,half):tube(batch,[(x,-half,z),(x,half,z)],[.004,.004],wood,4)
    # Battant de porte sur l'avant, avec son entretoise diagonale.
    for x in (-.055,.055):tube(batch,[(x,-half-.003,.035),(x,-half-.003,.12)],[.005,.005],(.48,.35,.20),4)
    tube(batch,[(-.055,-half-.005,.045),(.055,-half-.005,.11)],[.0035,.0035],wood,4)

def trough(batch,x,y):
    stone=(.42,.44,.36)
    box(batch,(x,y,.032),(.085,.050,.019),stone)
    for dy in (-.025,.025):box(batch,(x,y+dy,.047),(.09,.009,.03),stone)
    for dx in (-.042,.042):box(batch,(x+dx,y,.047),(.009,.045,.03),stone)
    box(batch,(x,y,.044),(.073,.039,.005),(.23,.48,.47))

def shelter(batch,large):
    width=.22 if large else .18;cx=-.10;cy=.165
    for dx in (-width/2,width/2):
        for dy in (-.055,.055):tube(batch,[(cx+dx,cy+dy,.022),(cx+dx,cy+dy,.19+dy*.30)],[.009,.007],(.37,.26,.14),5)
    # Couverture de planches avec recouvrement, pente et débord.
    for i in range(7):
        x=cx-width/2+i*width/6
        vertices=[(x+dx,cy+dy,.20+dy*.30+dz) for dx,dy,dz in [(-.021,-.071,0),(.021,-.071,0),(.021,.071,0),(-.021,.071,0),(-.021,-.071,.008),(.021,-.071,.008),(.021,.071,.008),(-.021,.071,.008)]]
        batch.add(vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],RNG.choice([(.33,.27,.16),(.39,.31,.19),(.43,.34,.20)]))
    for i in range(6):box(batch,(cx-width/2+i*width/5,cy+.051,.10),(.025,.009,.15),(.42,.30,.17))

def material(name,roughness):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Roughness'].default_value=roughness
    color=mat.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Color';mat.node_tree.links.new(color.outputs['Color'],node.inputs['Base Color']);return mat

def point_at(obj,p):obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()

VARIANTS={'petit':(1,.22),'moyen':(3,.235),'grand':(6,.25)}
LAYOUT=[(0,0,0),(-.14,-.10,.35),(.14,-.10,2.8),(-.14,.045,-.4),(0,-.14,3.0),(.14,.035,2.6)]
reports=[];comparison=[]
for variant_index,(variant,(count,half)) in enumerate(VARIANTS.items()):
    RNG=random.Random(8362+variant_index)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene;scene.unit_settings.system='METRIC'
    env_col=bpy.data.collections.new('01_Enclos');scene.collection.children.link(env_col)
    animal_col=bpy.data.collections.new('02_Vaches_independantes');scene.collection.children.link(animal_col)
    studio=bpy.data.collections.new('90_Studio_non_exporte');scene.collection.children.link(studio)
    env=Batch();base=half+.016
    box(env,(0,0,.009),(base*2,base*2,.018),(.36,.37,.20))
    fence(env,half)
    for _ in range(28):
        x,y=RNG.uniform(-half+.015,half-.015),RNG.uniform(-half+.015,half-.015)
        ellipsoid(env,(x,y,.019),(.006,.004,.0025),RNG.choice([(.47,.44,.29),(.45,.42,.23),(.35,.40,.17)]))
    trough(env,.14,.16)
    if variant!='petit':shelter(env,variant=='grand')
    # Râtelier à foin en bois, ouvert et garni en volume.
    x,y=(.15,.065) if variant=='grand' else (-.14,.15)
    box(env,(x,y,.046),(.090,.052,.031),(.43,.30,.16))
    ellipsoid(env,(x,y,.072),(.043,.026,.020),(.70,.59,.29),2)
    for i in range(8):
        px=x-.039+i*.011
        tube(env,[(px,y-.031,.035),(px,y-.035,.098)],[.002,.002],(.40,.28,.14),4)
        tube(env,[(px,y,.078),(px+.005,y-.004,.109)],[.0015,0],(.78,.66,.34),3)
    # Seau de traite décoratif dans les enclos dotés d'un abri.
    if variant!='petit':
        cx,cy=-.13,.17
        tube(env,[(cx,cy,.020),(cx,cy,.057)],[.015,.018],(.44,.31,.18),10)
        tube(env,[(cx,cy,.057),(cx,cy,.059)],[.016,.016],(.82,.79,.63),10)
        for z in (.027,.052):
            points=[(cx+math.cos(j*math.tau/12)*.018,cy+math.sin(j*math.tau/12)*.018,z) for j in range(13)]
            tube(env,points,[.0015]*13,(.36,.35,.30),4)
    wood=material('Enclos_terre_bois_PBR',.94);coat=material('Vache_pelage_cornes_PBR',.86)
    objects=[env.object('Enclos_'+variant,wood,env_col,'enclosure')];batches=[(env,None)]
    for index in range(count):
        animal=Batch();cow(animal)
        x,y,a=LAYOUT[index];c,s=math.cos(a),math.sin(a)
        animal.vertices=[(x+vx*c-vy*s,y+vx*s+vy*c,vz) for vx,vy,vz in animal.vertices]
        objects.append(animal.object(f'Vache_{index:02}',coat,animal_col,'animal',index));batches.append((animal,index))
    comparison.append((variant,[(list(b.vertices),list(b.faces),list(b.colors),i) for b,i in batches]))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    name='elevage_vache_'+variant;glb=ROOT/'exports'/f'{name}.glb'
    assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,
        export_animations=False,export_cameras=False,export_lights=False,export_yup=True)=={'FINISHED'}
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.22,.22,.22)
    for n,loc,power in [('Soleil',(-2,-3,5),450),('Ciel',(3,1,4),250)]:
        data=bpy.data.lights.new(n,'AREA');data.energy=power;data.size=4
        light=bpy.data.objects.new(n,data);studio.objects.link(light);light.location=loc;point_at(light,(0,0,.1))
    mesh=bpy.data.meshes.new('Fond');mesh.from_pydata([(-100,-100,-.008),(100,-100,-.008),(100,100,-.008),(-100,100,-.008)],[],[(0,1,2,3)])
    floor=bpy.data.objects.new('Fond',mesh);studio.objects.link(floor)
    data=bpy.data.cameras.new('Camera');data.type='ORTHO';data.ortho_scale=.83
    cam=bpy.data.objects.new('Camera',data);studio.objects.link(cam);cam.location=(.85,-1.3,1.0);point_at(cam,(0,0,.08));scene.camera=cam
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/f'{name}.blend'))
    scene.render.filepath=str(ROOT/'previews'/f'{name}_three_quarter.png');bpy.ops.render.render(write_still=True)
    if variant=='petit':
        cam.location=(.4,-.6,.3);point_at(cam,(.025,0,.125));data.ortho_scale=.37
        scene.render.filepath=str(ROOT/'previews/vache_detail.png');bpy.ops.render.render(write_still=True)
        cam.location=(.85,-1.3,1.0);point_at(cam,(0,0,.08));data.ortho_scale=.83
    floor.hide_render=True;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA'
    scene.render.resolution_x=512;scene.render.resolution_y=512
    scene.render.filepath=str(ROOT/'previews'/f'{name}_sprite.png');bpy.ops.render.render(write_still=True)
    raw=glb.read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert magic==0x46546C67 and version==2 and length==len(raw)
    size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    assert triangles<12000 and len(doc['materials'])==2 and not doc.get('images') and not doc.get('animations')
    assert sum(n.get('extras',{}).get('livestockRole')=='animal' for n in doc['nodes'])==count
    bpy.context.view_layer.update();points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    bounds=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    assert bounds[0]<.56 and bounds[1]<.56 and bounds[2]<.30
    reports.append({'variant':variant,'preview_animals':count,'triangles':triangles,'bytes':len(raw),'materials':2,
                    'dimensions_three':[bounds[0],bounds[2],bounds[1]],'cow_prototype_triangles':sum(len(f)-2 for f in batches[1][0].faces)})

for obj in objects:obj.hide_render=True
floor.hide_render=False;scene.render.film_transparent=False;scene.render.image_settings.color_mode='RGB'
for i,(variant,batches) in enumerate(comparison):
    for j,(vertices,faces,colors,animal_index) in enumerate(batches):
        batch=Batch();batch.vertices=[(x+(i-1)*.73,y,z) for x,y,z in vertices];batch.faces=faces;batch.colors=colors
        batch.object(variant+str(j),wood if animal_index is None else coat,env_col,'preview')
    data=bpy.data.curves.new('Titre_'+variant,'FONT');data.body={'petit':'PETIT','moyen':'MOYEN','grand':'GRAND'}[variant]
    data.align_x='CENTER';data.size=.045
    label=bpy.data.objects.new('Titre_'+variant,data);studio.objects.link(label);label.location=((i-1)*.73,-.38,.02)
    ink=bpy.data.materials.new('Encre');ink.use_nodes=True;ink.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.025,.035,.02,1);data.materials.append(ink)
cam.location=(0,-3,2.1);point_at(cam,(0,0,.09));cam.data.ortho_scale=2.45
scene.render.resolution_x=1600;scene.render.resolution_y=800
scene.render.filepath=str(ROOT/'previews/elevage_vaches_comparatif.png');bpy.ops.render.render(write_still=True)
(ROOT/'logs/vaches-validation.json').write_text(json.dumps(reports,indent=2)+'\n')
print('VACHES_VALIDATION',json.dumps(reports))
