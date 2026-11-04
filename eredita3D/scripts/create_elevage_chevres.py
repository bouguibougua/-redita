"""Élevage de chèvres corse, trois enclos de plateau et animaux en volumes.
Blender/bpy ; les effectifs, naissances, lait et abattages restent gérés par le jeu.
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

def goat(batch):
    cream=(.86,.82,.68);brown=(.38,.25,.15);dark=(.16,.13,.10);horn=(.56,.48,.34)
    # Corps continu, avec croupe, cage thoracique, ventre et épaule distincts.
    sections=[(-.064,.077,.012,.020),(-.048,.087,.023,.031),(-.016,.086,.028,.033),(.020,.087,.026,.030),(.047,.092,.019,.025),(.055,.10,.012,.016)]
    vs=[(x,ry*math.cos(j*math.tau/10),z+rz*math.sin(j*math.tau/10)) for x,z,ry,rz in sections for j in range(10)]
    fs=[(k*10+j,k*10+(j+1)%10,(k+1)*10+(j+1)%10,(k+1)*10+j) for k in range(len(sections)-1) for j in range(10)]
    fs.extend([tuple(reversed(range(10))),tuple(range(len(vs)-10,len(vs)))])
    batch.add(vs,fs,cream)
    tube(batch,[(.035,0,.084),(.052,0,.113),(.067,0,.137)],[.023,.019,.013],cream,8)
    ellipsoid(batch,(.080,0,.145),(.025,.014,.024),cream,2)
    ellipsoid(batch,(.104,0,.134),(.022,.011,.014),brown,2)
    ellipsoid(batch,(.119,0,.131),(.007,.009,.008),dark)
    # Les quatre membres ont un genou/jarret et des sabots fendus.
    for x in (-.043,.033):
        for side in (-1,1):
            y=side*.019;dx=-.007 if x<0 else .003
            tube(batch,[(x,y,.077),(x+dx,y,.046),(x+.003,y,.029)],[.008,.005,.0045],cream)
            for split in (-1,1):ellipsoid(batch,(x+.005,y+split*.0027,.025),(.007,.0028,.005),dark)
    tube(batch,[(-.061,0,.098),(-.075,0,.112),(-.078,0,.125)],[.006,.004,.001],cream,5)
    tube(batch,[(.099,0,.123),(.098,0,.108),(.094,0,.094)],[.006,.004,0],brown,5)
    for side in (-1,1):
        # Oreille triangulée épaisse et intérieur chaud.
        p=[(.064,side*.010,.153),(.069,side*.043,.148),(.082,side*.017,.146),(.072,side*.020,.157)]
        batch.add(p,[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],cream)
        batch.add([(.068,side*.017,.154),(.070,side*.035,.150),(.077,side*.019,.150)],[(0,1,2)],(.55,.35,.25),0)
        tube(batch,[(.069,side*.008,.162),(.062,side*.011,.181),(.048,side*.012,.194),(.035,side*.013,.194)], [.0045,.0035,.002,0],horn,5)
        ellipsoid(batch,(.089,side*.013,.150),(.005,.0024,.0037),(.72,.57,.24))
        ellipsoid(batch,(.090,side*.015,.150),(.0034,.0012,.0012),(.035,.028,.02))
    # Collier de cuir et petite clochette.
    pts=[(.053,math.cos(i*math.tau/12)*.018,.113+math.sin(i*math.tau/12)*.018) for i in range(13)]
    tube(batch,pts,[.002]*13,(.34,.20,.10),4)
    ellipsoid(batch,(.057,0,.089),(.006,.005,.006),(.64,.47,.19))

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
    RNG=random.Random(6241+variant_index)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene;scene.unit_settings.system='METRIC'
    env_col=bpy.data.collections.new('01_Enclos');scene.collection.children.link(env_col)
    animal_col=bpy.data.collections.new('02_Chevres_independantes');scene.collection.children.link(animal_col)
    studio=bpy.data.collections.new('90_Studio_non_exporte');scene.collection.children.link(studio)
    env=Batch();base=half+.016
    box(env,(0,0,.009),(base*2,base*2,.018),(.36,.34,.20))
    fence(env,half)
    for _ in range(28):
        x,y=RNG.uniform(-half+.015,half-.015),RNG.uniform(-half+.015,half-.015)
        ellipsoid(env,(x,y,.019),(.006,.004,.0025),RNG.choice([(.47,.44,.29),(.45,.42,.23),(.35,.40,.17)]))
    trough(env,.14,.16)
    if variant!='petit':shelter(env,variant=='grand')
    # Mangeoire, foin et perches en volume.
    x,y=(.13,.15) if variant=='grand' else (-.13,.15)
    if variant=='grand':y=.06
    box(env,(x,y,.055),(.075,.045,.034),(.43,.31,.17))
    ellipsoid(env,(x,y,.077),(.038,.023,.016),(.67,.58,.28),2)
    for i in range(7):
        px=x-.032+i*.0105;tube(env,[(px,y-.027,.045),(px,y-.031,.09)],[.0018,.0018],(.37,.26,.12),4)
        tube(env,[(px,y,.078),(px+.005,y-.004,.102)],[.0015,0],(.75,.65,.34),3)
    wood=material('Enclos_terre_bois_PBR',.94);coat=material('Chevre_pelage_cornes_PBR',.86)
    objects=[env.object('Enclos_'+variant,wood,env_col,'enclosure')];batches=[(env,None)]
    for index in range(count):
        animal=Batch();goat(animal)
        x,y,a=LAYOUT[index];c,s=math.cos(a),math.sin(a)
        animal.vertices=[(x+vx*c-vy*s,y+vx*s+vy*c,vz) for vx,vy,vz in animal.vertices]
        objects.append(animal.object(f'Chevre_{index:02}',coat,animal_col,'animal',index));batches.append((animal,index))
    comparison.append((variant,[(list(b.vertices),list(b.faces),list(b.colors),i) for b,i in batches]))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    name='elevage_chevre_'+variant;glb=ROOT/'exports'/f'{name}.glb'
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
        cam.location=(.4,-.6,.3);point_at(cam,(.025,0,.115));data.ortho_scale=.30
        scene.render.filepath=str(ROOT/'previews/chevre_detail.png');bpy.ops.render.render(write_still=True)
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
                    'dimensions_three':[bounds[0],bounds[2],bounds[1]],'goat_prototype_triangles':sum(len(f)-2 for f in batches[1][0].faces)})

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
scene.render.filepath=str(ROOT/'previews/elevage_chevres_comparatif.png');bpy.ops.render.render(write_still=True)
(ROOT/'logs/chevres-validation.json').write_text(json.dumps(reports,indent=2)+'\n')
print('CHEVRES_VALIDATION',json.dumps(reports))
