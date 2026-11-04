"""Plaine corse V1, tuile de plateau Three.js / WebXR. Blender 5.1 bpy.

Reproduire : Blender --background --factory-startup --python-exit-code 1
            --python eredita3D/scripts/create_plaine.py
Unités du plateau : 2.82 × 4.85 ; Y glTF vertical, sol à +0.03.
Les villages, quatre slots, cultures et pouvoirs restent gérés par le jeu.
"""
from pathlib import Path
import bpy
import bmesh
import numpy as np
import math
import random
import json
import struct
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RNG = random.Random(1804)
W, D = 2.82, 4.85
for directory in ('models', 'exports', 'previews', 'textures/plaine', 'logs'):
    (ROOT / directory).mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def collection(name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result

GROUND = collection('01_Sol_et_coupe_de_terre')
ROCKS = collection('02_Granite')
PLANTS = collection('03_Maquis_et_herbes')
GUIDES = collection('04_Emplacements_non_exportes')
STUDIO = collection('90_Studio_non_exporte')
EXPORT = []

def srgb(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def color(rgb):
    return (*[srgb(v) for v in rgb], 1)

def mesh(name, vertices, faces, material, target, rgb=None, smooth=False, role='decoration'):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(material)
    data.update()
    obj = bpy.data.objects.new(name, data)
    target.objects.link(obj)
    obj['terrainRole'] = role
    if rgb is not None:
        attr = data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        for p in data.polygons:
            p.use_smooth = smooth
            shade = RNG.uniform(.89, 1.08)
            for idx in p.loop_indices:
                attr.data[idx].color = color(tuple(min(1, v * shade) for v in rgb))
    EXPORT.append(obj)
    return obj

def material(name, vertices=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .94
    if vertices:
        vc = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Color'
        mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

N = 1024
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
x, y = (xx / (N - 1) - .5) * W, (yy / (N - 1) - .5) * D
np_rng = np.random.default_rng(1804)

def noise(freq, count=7):
    out = np.zeros((N, N), dtype=np.float32)
    for _ in range(count):
        a = np_rng.uniform(0, 6.28)
        out += np.sin((x * math.cos(a) + y * math.sin(a)) * freq + np_rng.uniform(0, 6.28))
    return out / math.sqrt(count * 2)

large, medium, fine = noise(4), noise(20), noise(150)
patch = np.clip(.48 + .32 * large + .15 * medium, 0, 1)[..., None]
green, straw = np.array([.31, .40, .15]), np.array([.58, .54, .29])
rgb = green * (1 - patch) + straw * patch
# Le sentier demeure un dessin du sol, sans collision ni modification des règles.
spine = .06 * np.sin(y * 2.1)
distance = np.abs(x - spine)
for row in (.62, -.5):  # Blender Y = -Z du plateau Three.js.
    distance = np.minimum(distance, np.abs(y - row + .035 * np.sin(x * 7)) + np.maximum(0, np.abs(x) - .78))
path = np.clip((.16 - distance + .022 * medium) / .10, 0, 1)[..., None]
dirt = np.array([.62, .51, .34]) + (fine * .025 + medium * .018)[..., None]
rgb = rgb * (1 - path) + dirt * path
grain = np_rng.normal(0, .025, (N, N)).astype(np.float32)
rgb += (grain + fine * .016)[..., None]
# Traits de chaume dans l'albédo : pas de cartes alpha ni d'ombres précalculées.
for _ in range(22000):
    px, py = np_rng.integers(4, N - 8, 2)
    if path[py, px, 0] > .5:
        continue
    length = int(np_rng.integers(2, 7))
    dx = int(np_rng.integers(-2, 3))
    rows = py + np.arange(length)
    cols = px + (np.arange(length) * dx / length).astype(int)
    tint = np.array([.64, .60, .34]) if np_rng.random() > .4 else np.array([.27, .35, .13])
    rgb[rows, cols] = .5 * rgb[rows, cols] + .5 * tint
rgb = np.clip(rgb, 0, 1)

def texture(name, pixels, noncolor=False):
    img = bpy.data.images.new(name, width=N, height=N, alpha=False)
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((N, N, 4), np.float32)
    rgba[:, :, :3] = pixels
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = str(ROOT / 'textures/plaine' / f'{name}.png')
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img

albedo = texture('plaine_albedo_1024', rgb)
height = fine * .22 + grain * 3
gy, gx = np.gradient(height)
norm = np.stack((-gx * .35, -gy * .35, np.ones_like(gx)), axis=-1)
norm /= np.linalg.norm(norm, axis=-1)[..., None]
normal = texture('plaine_normal_1024', norm * .5 + .5, True)
SOIL = material('Prairie_PBR_1024')
nodes, links = SOIL.node_tree.nodes, SOIL.node_tree.links
base = nodes.new('ShaderNodeTexImage'); base.image = albedo
links.new(base.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
detail = nodes.new('ShaderNodeTexImage'); detail.image = normal
nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .45
links.new(detail.outputs['Color'], nm.inputs['Color'])
links.new(nm.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
NATURAL = material('Granite_terre_maquis_PBR_couleurs', True)

def ground_height(x, y):
    # Sous les unités, les marqueurs et la rivière : relief inférieur à 4 cm.
    return .029 + .006 * math.sin(x * 6 + y * 3) * math.sin(y * 4 - x * 2)

nx, ny = 20, 36
verts = [(-W/2 + W*i/nx, -D/2 + D*j/ny, ground_height(-W/2 + W*i/nx, -D/2 + D*j/ny))
         for j in range(ny+1) for i in range(nx+1)]
faces = [(j*(nx+1)+i, j*(nx+1)+i+1, (j+1)*(nx+1)+i+1, (j+1)*(nx+1)+i)
         for j in range(ny) for i in range(nx)]
top = mesh('Sol_Prairie', verts, faces, SOIL, GROUND, role='ground')
uv = top.data.uv_layers.new(name='UVMap')
for loop in top.data.loops:
    v = top.data.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = (v.x / W + .5, v.y / D + .5)
for poly in top.data.polygons:
    poly.use_smooth = True

edge = [(i, 0) for i in range(nx)] + [(nx, j) for j in range(ny)] + [(i, ny) for i in range(nx, 0, -1)] + [(0, j) for j in range(ny, 0, -1)]
outline = [(-W/2 + W*i/nx, -D/2 + D*j/ny) for i, j in edge]
count = len(outline)
verts = []
for ring in range(4):
    for i, (a, b) in enumerate(outline):
        z = [ground_height(a, b), -.025 + .009*math.sin(i*2), -.10 + .012*math.cos(i*3), -.19][ring]
        verts.append((a, b, z))
faces = [(r*count+i, (r+1)*count+i, (r+1)*count+(i+1)%count, r*count+(i+1)%count) for r in range(3) for i in range(count)]
faces.append(tuple(reversed(range(3*count, 4*count))))
cut = mesh('Coupe_Terre', verts, faces, NATURAL, GROUND, (.36, .28, .17), role='base')
attr = cut.data.color_attributes['Color']
for poly in cut.data.polygons:
    band = min(2, poly.index // count)
    c = [( .30, .32, .14), (.44, .34, .21), (.32, .25, .18)][band]
    shade = RNG.uniform(.88, 1.1)
    for idx in poly.loop_indices:
        attr.data[idx].color = color(tuple(v*shade for v in c))

def ico_template(subdivisions):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1)
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    v = [tuple(p.co) for p in bm.verts]
    f = [tuple(p.index for p in face.verts) for face in bm.faces]
    bm.free()
    return v, f

ICOS = {n: ico_template(n) for n in (1, 2)}

def add_ico(vs, fs, center, size, n=1, irregular=.12):
    source, faces = ICOS[n]
    start = len(vs)
    for p in source:
        jitter = RNG.uniform(1-irregular, 1+irregular)
        vs.append(tuple(center[k] + p[k]*size[k]*jitter for k in range(3)))
    fs.extend(tuple(start+i for i in f) for f in faces)

def clear(x, y, radius=.10):
    if abs(x) < .28 + radius or abs(y) < .27 + radius: return False
    if abs(y) > 1.42 and abs(x) < 1.10: return False
    for sx in (-.55, .55):
        for sy in (.62, -.5):
            if math.hypot(x-sx, y-sy) < .44 + radius: return False
    return abs(x) < W/2-radius and abs(y) < D/2-radius

def locate(radius):
    for _ in range(3000):
        px, py = RNG.uniform(-1.31, 1.31), RNG.uniform(-2.3, 2.3)
        if clear(px, py, radius): return px, py
    raise RuntimeError('Emplacement de décor introuvable')

for i in range(24):
    size = RNG.uniform(.035, .105)
    px, py = locate(size)
    vs, fs = [], []
    add_ico(vs, fs, (0, 0, size*.25), (size, size*.75, size*.65), 2, .23)
    rock = mesh(f'Granite_{i:02}', vs, fs, NATURAL, ROCKS, (.58, .56, .48), True)
    rock.location = (px, py, ground_height(px, py))

# Bouquets compacts : volumes opaques, silhouette irrégulière, sans alpha.
for i in range(14):
    px, py = locate(.14)
    vs, fs = [], []
    for _ in range(9):
        a, r = RNG.uniform(0, math.tau), RNG.uniform(0, .08)
        s = RNG.uniform(.035, .065)
        add_ico(vs, fs, (math.cos(a)*r, math.sin(a)*r, .045 + RNG.uniform(0, .07)), (s, s*.8, s*.85))
    bush = mesh(f'Maquis_{i:02}', vs, fs, NATURAL, PLANTS, RNG.choice([(.30,.36,.16),(.37,.40,.19),(.25,.33,.19)]), True)
    bush.location = (px, py, ground_height(px, py))
    if i % 3 == 0:
        vs, fs = [], []
        for _ in range(7):
            add_ico(vs, fs, (RNG.uniform(-.065,.065), RNG.uniform(-.065,.065), RNG.uniform(.09,.14)), (.009,.009,.008))
        bloom = mesh(f'Fleurs_immortelles_{i:02}', vs, fs, NATURAL, PLANTS, (.77,.64,.24))
        bloom.location = bush.location

for i in range(190):
    px, py = locate(.025)
    vs, fs = [], []
    for _ in range(RNG.randint(3, 5)):
        a, length = RNG.uniform(0, math.tau), RNG.uniform(.035, .10)
        bx, by = RNG.uniform(-.022,.022), RNG.uniform(-.022,.022)
        width = RNG.uniform(.003,.007)
        start = len(vs)
        vs.extend([(bx-width,by,0), (bx+width,by,0), (bx,by+.003,0), (bx+math.sin(a)*length*.36, by+math.cos(a)*length*.36, length)])
        fs.extend(tuple(start+j for j in f) for f in [(0,1,3),(1,2,3),(2,0,3),(0,2,1)])
    grass = mesh(f'Touffe_{i:03}', vs, fs, NATURAL, PLANTS, RNG.choice([(.48,.48,.24),(.58,.55,.29),(.38,.44,.18)]))
    grass.location = (px, py, ground_height(px, py))

# Repères de placement éditables, jamais exportés ni rendus.
for i, (px, py) in enumerate([(-.55,.62),(.55,.62),(-.55,-.5),(.55,-.5)]):
    obj = bpy.data.objects.new(f'Slot_libre_{i+1}', None)
    GUIDES.objects.link(obj); obj.location = (px, py, .1)
    obj.empty_display_type = 'CIRCLE'; obj.empty_display_size = .39
    obj['note'] = 'Repère uniquement ; le slot réel est créé par le jeu.'

bpy.ops.object.select_all(action='DESELECT')
for obj in EXPORT: obj.select_set(True)
bpy.context.view_layer.objects.active = top
glb = ROOT / 'exports/plaine.glb'
assert bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_apply=True, export_animations=False, export_cameras=False, export_lights=False,
    export_extras=True, export_yup=True, export_image_format='AUTO') == {'FINISHED'}

def point_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'; scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200; scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.color = (.20,.20,.20)
scene.view_settings.view_transform = 'AgX'
for name, loc, energy, size in [('Soleil_doux',(-3,-4,7),850,5),('Ciel',(4,2,5),450,4)]:
    data = bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data);STUDIO.objects.link(obj);obj.location=loc;point_at(obj,(0,0,0))
# Fond de studio retiré de l'export.
data = bpy.data.meshes.new('Fond_studio'); data.from_pydata([(-200,-200,-.205),(200,-200,-.205),(200,200,-.205),(-200,200,-.205)],[],[(0,1,2,3)])
floor = bpy.data.objects.new('Fond_studio',data);STUDIO.objects.link(floor)
mat = material('Studio_sauge');mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.045,.06,.055,1);data.materials.append(mat)
views = {'three_quarter':(5,-7,6),'top':(0,0,8),'detail':(3,-4,2.4)}
cameras={}
for name, loc in views.items():
    data=bpy.data.cameras.new('Camera_'+name);data.type='ORTHO';data.ortho_scale=6.2 if name!='detail' else 5.6
    cam=bpy.data.objects.new('Camera_'+name,data);STUDIO.objects.link(cam);cam.location=loc;point_at(cam,(0,0,0));cameras[name]=cam
scene.camera=cameras['three_quarter']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/plaine.blend'))
for name, cam in cameras.items():
    scene.camera=cam;scene.render.filepath=str(ROOT/'previews'/f'plaine_{name}.png')
    assert bpy.ops.render.render(write_still=True)=={'FINISHED'}

raw=glb.read_bytes()
magic, version, length=struct.unpack_from('<III',raw)
assert magic==0x46546C67 and version==2 and length==len(raw)
size,kind=struct.unpack_from('<II',raw,12)
assert kind==0x4E4F534A
doc=json.loads(raw[20:20+size])
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert triangles < 12000 and len(doc['materials'])==2
assert not doc.get('animations') and not doc.get('skins')
assert all('uri' not in im for im in doc['images'])
report={'triangles':triangles,'meshes_authoring':len(doc['meshes']),'materials':len(doc['materials']),
        'bytes':length,'textures':[1024,1024],'dimensions_three':[W,.19+.18,D],
        'runtime_batches_per_tile':3,'slot_clearance_radius':.44,
        'note':'Fusion statique des décors au chargement ; aucun test sur casque physique effectué.'}
(ROOT/'logs/plaine-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('PLAINE_VALIDATION',json.dumps(report))
