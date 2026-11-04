"""Trois châtaigneraies de plateau, Blender/bpy, volumes opaques sans textures.
Les trois compositions sont associées aux niveaux 1, 2 et 3 des cultures dans le jeu.
"""
from pathlib import Path
import bpy
import bmesh
import math
import random
import json
import struct
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
for name in ('models', 'exports', 'previews', 'logs'):
    (ROOT / name).mkdir(parents=True, exist_ok=True)

def linear(v):
    v = max(0, min(1, v))
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

class Batch:
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []
    def add(self, vertices, faces, color, shade=.045):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(start + i for i in f) for f in faces)
        self.colors.extend(tuple(c * RNG.uniform(1-shade, 1+shade) for c in color) for _ in faces)
    def object(self, name, material, collection):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces); mesh.materials.append(material); mesh.update()
        attr = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for face, color in zip(mesh.polygons, self.colors):
            for i in face.loop_indices:
                attr.data[i].color = tuple(linear(c) for c in color) + (1,)
        obj = bpy.data.objects.new(name, mesh); collection.objects.link(obj)
        return obj

def ico_template(subdivisions):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1)
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    result = ([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces])
    bm.free(); return result
ICO = {n: ico_template(n) for n in (1, 2)}

def ellipsoid(batch, center, radii, color, detail=1, rotation=0):
    vertices, faces = ICO[detail]; c, s = math.cos(rotation), math.sin(rotation)
    points = [(center[0] + x*radii[0]*c - y*radii[1]*s,
               center[1] + x*radii[0]*s + y*radii[1]*c, center[2] + z*radii[2]) for x,y,z in vertices]
    batch.add(points, faces, color, .07)

def branch(batch, start, end, r0, r1, color, sides=7):
    start, end = Vector(start), Vector(end)
    rotation = (end-start).to_track_quat('Z','Y')
    points = [tuple(p + rotation @ Vector((r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),0)))
              for p,r in ((start,r0),(end,r1)) for i in range(sides)]
    faces = [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(sides,2*sides))]
    batch.add(points, faces, color, .11)

def leaf(batch, center, length, angle, color, tilt=.15):
    # Feuille lancéolée dentée et pliée, fermée par une face inférieure.
    outline = [(0,-.52),(.11,-.30),(.06,-.29),(.19,-.10),(.13,-.08),(.21,.11),
               (.15,.13),(.15,.28),(.08,.29),(0,.52),(-.08,.29),(-.15,.28),(-.15,.13),
               (-.21,.11),(-.13,-.08),(-.19,-.10),(-.06,-.29),(-.11,-.30)]
    c,s = math.cos(angle),math.sin(angle)
    points = [(center[0]+length*(x*c-y*s),center[1]+length*(x*s+y*c),center[2]+length*y*tilt) for x,y in outline]
    points += [(center[0],center[1],center[2]+length*.045),(center[0],center[1],center[2]-length*.012)]
    n = len(outline)
    faces = [(i,(i+1)%n,n) for i in range(n)] + [((i+1)%n,i,n+1) for i in range(n)]
    batch.add(points,faces,color,.04)

def burr(batch, center, radius):
    ellipsoid(batch,center,(radius,)*3,(.57,.56,.22))
    for i in range(9):
        phi = i*2.39996; z = -1+2*(i+.5)/9; r = math.sqrt(1-z*z)
        direction = Vector((r*math.cos(phi),r*math.sin(phi),z));p = Vector(center)+direction*radius*.75
        branch(batch,p,Vector(center)+direction*radius*1.55,radius*.15,0,(.68,.62,.29),3)

def tree(wood, foliage, x, y, height, spread, seed):
    local = random.Random(seed); root = Vector((x,y,.022))
    bend = Vector((local.uniform(-.025,.025),local.uniform(-.02,.02),height*.40))
    fork = root+bend
    trunk_radius = height*.046
    branch(wood,root,root+bend*.55,trunk_radius*1.35,trunk_radius,(.35,.27,.18),9)
    branch(wood,root+bend*.55,fork,trunk_radius,trunk_radius*.66,(.39,.31,.21),8)
    for i in range(5):
        angle = i*math.tau/5+seed*.2
        root_end = root+Vector((math.cos(angle)*trunk_radius*2.3,math.sin(angle)*trunk_radius*2.3,-.002))
        branch(wood,root_end,root+Vector((0,0,.055)),.009,.014,(.34,.25,.15),5)
    # Ramure asymétrique portant cinq masses de feuillage, ouvertes sous le houppier.
    for i in range(5):
        angle = i*2.39996 + seed*.15
        offset = spread*(.43 if i<4 else .06)
        center = root+Vector((math.cos(angle)*offset,math.sin(angle)*offset,height*(.68+.06*(i%3))))
        elbow = fork.lerp(center,.60)+Vector((0,0,-.025))
        branch(wood,fork,elbow,trunk_radius*.65,.009,(.38,.29,.18))
        branch(wood,elbow,center,.009,.003,(.43,.33,.21),5)
        radii = (spread*.63,spread*.52,height*.20)
        color = [( .32,.43,.12),(.38,.48,.14),(.43,.51,.17),(.48,.53,.20),(.35,.46,.14)][i]
        ellipsoid(foliage,center,radii,color,2,angle)
        for j in range(5):
            a = angle+j*math.tau/5
            p = center+Vector((math.cos(a)*radii[0]*.85,math.sin(a)*radii[1]*.85,local.uniform(-.045,.035)))
            leaf(foliage,p,height*.14,a,local.choice([(.49,.57,.19),(.57,.59,.22),(.34,.46,.12)]),local.uniform(-.5,.4))
        if i%2==0:
            p = center+Vector((radii[0]*.7,-radii[1]*.65,-radii[2]*.48))
            burr(foliage,p,height*.026)

def material(name,roughness):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=roughness
    vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
    mat.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color']);return mat

def point_at(obj,point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()

reports=[]; comparison=[]
VARIANTS = {
    'petit': [(0,0,.43,.155,11)],
    'moyen': [(-.105,.045,.56,.135,27),(.11,-.05,.49,.13,36)],
    'grand': [(-.115,.08,.68,.13,51),(.125,.07,.60,.12,62),(0,-.13,.52,.125,75)]
}
for index,(variant,trees) in enumerate(VARIANTS.items()):
    RNG=random.Random(418+index)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene;scene.unit_settings.system='METRIC'
    collection=bpy.data.collections.new('01_Chataigneraie_'+variant);scene.collection.children.link(collection)
    studio=bpy.data.collections.new('90_Studio_non_exporte');scene.collection.children.link(studio)
    soil,wood,foliage=Batch(),Batch(),Batch()
    # Une seule emprise de slot : la densité et le volume évoluent, pas les règles de surface.
    edge=[]
    for cx,cy,start in [(.20,.20,0),(-.20,.20,90),(-.20,-.20,180),(.20,-.20,270)]:
        for j in range(4):
            a=math.radians(start+j*30);edge.append((cx+.05*math.cos(a),cy+.05*math.sin(a)))
    n=len(edge);vertices=[(x,y,z) for z in (0,.02) for x,y in edge]
    soil.add(vertices,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],(.34,.29,.16))
    for _ in range(19):
        x,y=RNG.uniform(-.225,.225),RNG.uniform(-.225,.225)
        ellipsoid(soil,(x,y,.022),(.012,.009,.005),RNG.choice([(.42,.37,.25),(.48,.44,.31)]))
    for _ in range(22):
        x,y=RNG.uniform(-.21,.21),RNG.uniform(-.21,.21)
        leaf(foliage,(x,y,.025),RNG.uniform(.022,.040),RNG.uniform(0,math.tau),RNG.choice([(.49,.36,.13),(.58,.44,.18),(.39,.43,.12)]),0)
    for args in trees:tree(wood,foliage,*args)
    # Bogues et châtaignes tombées : détails de silhouette lisibles en aperçu rapproché.
    for i in range(3+index):
        p=(RNG.uniform(-.18,.18),RNG.uniform(-.20,-.15),.03)
        burr(foliage,p,.012)
        ellipsoid(wood,(p[0]+.017,p[1]-.01,.028),(.009,.007,.008),(.40,.18,.055))
    bark=material('Terre_et_ecorce_PBR',.94);leaves=material('Feuillage_et_bogues_PBR',.85)
    objects=[soil.object('Sous_bois',bark,collection),wood.object('Troncs_et_ramures',bark,collection),foliage.object('Feuilles_et_chataignes',leaves,collection)]
    for obj in objects:obj['cropType']='chataignier';obj['variant']=variant
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    name='chataignier_'+variant;glb=ROOT/'exports'/f'{name}.glb'
    assert bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,
        export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)=={'FINISHED'}
    # Sauvegarder aussi les données du comparatif avant la remise à zéro suivante.
    comparison.append((variant,[(list(b.vertices),list(b.faces),list(b.colors)) for b in (soil,wood,foliage)]))
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.22,.22,.22)
    for light_name,loc,power in [('Soleil',(-2,-3,5),450),('Ciel',(3,1,4),300)]:
        data=bpy.data.lights.new(light_name,'AREA');data.energy=power;data.size=4
        obj=bpy.data.objects.new(light_name,data);studio.objects.link(obj);obj.location=loc;point_at(obj,(0,0,.3))
    mesh=bpy.data.meshes.new('Fond');mesh.from_pydata([(-100,-100,-.008),(100,-100,-.008),(100,100,-.008),(-100,100,-.008)],[],[(0,1,2,3)])
    floor=bpy.data.objects.new('Fond',mesh);studio.objects.link(floor)
    data=bpy.data.cameras.new('Camera');data.type='ORTHO';data.ortho_scale=1.02
    camera=bpy.data.objects.new('Camera',data);studio.objects.link(camera);camera.location=(.85,-1.3,1.05);point_at(camera,(0,0,.29));scene.camera=camera
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/f'{name}.blend'))
    scene.render.filepath=str(ROOT/'previews'/f'{name}_three_quarter.png');bpy.ops.render.render(write_still=True)
    floor.hide_render=True;scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA'
    scene.render.resolution_x=512;scene.render.resolution_y=512
    scene.render.filepath=str(ROOT/'previews'/f'{name}_sprite.png');bpy.ops.render.render(write_still=True)
    raw=glb.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546C67 and version==2 and length==len(raw)
    size,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+size])
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    assert triangles<8500 and len(doc['materials'])==2 and not doc.get('images') and not doc.get('animations')
    bpy.context.view_layer.update();points=[obj.matrix_world@Vector(c) for obj in objects for c in obj.bound_box]
    bounds=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    assert bounds[0]<.60 and bounds[1]<.60 and bounds[2]<.80
    reports.append({'variant':variant,'trees':len(trees),'triangles':triangles,'bytes':len(raw),'materials':2,
                    'dimensions_three':[bounds[0],bounds[2],bounds[1]],'runtime_batches':2})

# Comparatif des trois compositions à la même échelle, rendu par Blender.
for obj in objects:obj.hide_render=True
floor.hide_render=False;scene.render.film_transparent=False;scene.render.image_settings.color_mode='RGB'
for i,(variant,batches) in enumerate(comparison):
    for j,(vertices,faces,colors) in enumerate(batches):
        batch=Batch();batch.vertices=[(x+(i-1)*.78,y,z) for x,y,z in vertices];batch.faces=faces;batch.colors=colors
        batch.object(variant+str(j),bark if j<2 else leaves,collection)
    data=bpy.data.curves.new('Titre_'+variant,'FONT');data.body={'petit':'PETITE','moyen':'MOYENNE','grand':'GRANDE'}[variant]
    data.align_x='CENTER';data.size=.055;data.extrude=0
    label=bpy.data.objects.new('Titre_'+variant,data);studio.objects.link(label);label.location=((i-1)*.78,-.40,.02)
    ink=bpy.data.materials.new('Titre_sombre');ink.use_nodes=True
    ink.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.025,.035,.02,1)
    data.materials.append(ink)
camera.location=(0,-3,2.1);point_at(camera,(0,0,.26));camera.data.ortho_scale=2.65
scene.render.resolution_x=1600;scene.render.resolution_y=850
scene.render.filepath=str(ROOT/'previews/chataigniers_comparatif.png');bpy.ops.render.render(write_still=True)
(ROOT/'logs/chataigniers-validation.json').write_text(json.dumps(reports,indent=2)+'\n')
print('CHATAIGNIERS_VALIDATION',json.dumps(reports))
