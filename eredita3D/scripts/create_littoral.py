"""Littoral corse V1 : deux compositions Rouge/Bleu, compatibles avec le plateau WebXR.
Génère deux BLEND, deux GLB autonomes et six aperçus. Aucun bateau ou village inclus.
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

def build(variant):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    asset = f'littoral_{variant}'
    RNG = random.Random(1934 if variant == "rouge" else 1968)
    W, D = 2.82, 4.85
    SIDE = 1 if variant == 'rouge' else -1
    def shore(x):
        return (.59 + .05*np.sin(x*3.2) + .025*np.cos(x*7)) if variant=='rouge' else (.60 + .055*np.cos(x*2.6+.7) + .025*np.sin(x*8))
    def scene_y(d): return -SIDE*d
    for directory in ('models', 'exports', 'previews', f'textures/{asset}', 'logs'):
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
    ROCKS = collection('02_Rochers_du_rivage')
    PLANTS = collection('03_Maquis_et_oyats')
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
    np_rng = np.random.default_rng(1934 if variant == "rouge" else 1968)

    def noise(freq, count=7):
        out = np.zeros((N, N), dtype=np.float32)
        for _ in range(count):
            a = np_rng.uniform(0, 6.28)
            out += np.sin((x * math.cos(a) + y * math.sin(a)) * freq + np_rng.uniform(0, 6.28))
        return out / math.sqrt(count * 2)

    large, medium, fine = noise(4), noise(20), noise(150)
    patch=np.clip(.48+.32*large+.15*medium,0,1)[...,None]
    rgb=np.array([.33,.39,.18])*(1-patch)+np.array([.57,.53,.32])*patch
    sea=-SIDE*y
    beach=np.clip((sea-.08+medium*.025)/.42,0,1)[...,None]
    sand=np.array([.72,.65,.46])+(fine*.012+medium*.008)[...,None]
    rgb=rgb*(1-beach)+sand*beach
    spine=.04*np.sin(sea*2.3)
    distance=np.minimum(np.abs(x-spine),np.abs(sea)+np.maximum(0,np.abs(x)-.7))
    path=np.clip((.13-distance+medium*.018)/.09,0,1)[...,None]*(1-beach)
    rgb=rgb*(1-path)+np.array([.64,.57,.39])*path
    grain=np_rng.normal(0,.018,(N,N)).astype(np.float32)
    rgb=np.clip(rgb+(grain+fine*.010)[...,None],0,1)

    def texture(name, pixels, noncolor=False):
        img = bpy.data.images.new(name, width=N, height=N, alpha=False)
        if noncolor:
            img.colorspace_settings.name = 'Non-Color'
        rgba = np.ones((N, N, 4), np.float32)
        rgba[:, :, :3] = pixels
        img.pixels.foreach_set(rgba.ravel())
        img.filepath_raw = str(ROOT / f'textures/{asset}' / f'{name}.png')
        img.file_format = 'PNG'
        img.save()
        img.pack()
        return img

    albedo = texture(f'{asset}_albedo_1024', rgb)
    height = fine * .22 + grain * 3
    gy, gx = np.gradient(height)
    norm = np.stack((-gx * .35, -gy * .35, np.ones_like(gx)), axis=-1)
    norm /= np.linalg.norm(norm, axis=-1)[..., None]
    normal = texture(f'{asset}_normal_1024', norm * .5 + .5, True)
    SOIL = material('Sable_Maquis_PBR_1024')
    nodes, links = SOIL.node_tree.nodes, SOIL.node_tree.links
    base = nodes.new('ShaderNodeTexImage'); base.image = albedo
    links.new(base.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    detail = nodes.new('ShaderNodeTexImage'); detail.image = normal
    nm = nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .45
    links.new(detail.outputs['Color'], nm.inputs['Color'])
    links.new(nm.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
    NATURAL = material('Granite_Maquis_PBR_couleurs', True)

    def ground_height(x, y):
        d=-SIDE*y;s=float(shore(x))
        # Slots/axe de rivière plats ; cordon de sable rejoint le niveau des bateaux existants.
        if d <= .4: return .029+.004*math.sin(x*5+y*3)*math.sin(y*4)
        if d <= s:
            t=(d-.4)/(s-.4)
            return .029+.084*(t*t*(3-2*t))
        return max(-.12,.113-(d-s)*1.9)

    nx, ny = 20, 36
    verts = [(-W/2 + W*i/nx, -D/2 + D*j/ny, ground_height(-W/2 + W*i/nx, -D/2 + D*j/ny))
             for j in range(ny+1) for i in range(nx+1)]
    faces = [(j*(nx+1)+i, j*(nx+1)+i+1, (j+1)*(nx+1)+i+1, (j+1)*(nx+1)+i)
             for j in range(ny) for i in range(nx)]
    top = mesh('Sol_Littoral', verts, faces, SOIL, GROUND, role='ground')
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

    WATER = material('Mer_Mediterranee_PBR', True)
    bsdf=WATER.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.28
    bsdf.inputs['Metallic'].default_value=.10
    bsdf.inputs['IOR'].default_value=1.333
    WAVES=collection('04_Mer_et_ecume')

    def water_height(x,d): return .105+.0018*math.sin(x*7+d*12)+.001*math.sin(x*13-d*9)

    # Une mer en volume, opaque pour éviter le coût et les artefacts de transparence en VR.
    wx,wy=28,18
    vs=[]
    for j in range(wy+1):
        for i in range(wx+1):
            xx=-W/2+W*i/wx;start=float(shore(xx));d=start+(D/2-start)*j/wy
            vs.append((xx,scene_y(d),water_height(xx,d)))
    # Y Blender est inversé pour Rouge : garder les faces visibles depuis le dessus.
    fs=[]
    for j in range(wy):
        for i in range(wx):
            a=j*(wx+1)+i;face=(a,a+1,a+wx+2,a+wx+1)
            fs.append(tuple(reversed(face)) if SIDE==1 else face)
    edge=[i for i in range(wx)]+[j*(wx+1)+wx for j in range(wy)]+[wy*(wx+1)+i for i in range(wx,0,-1)]+[j*(wx+1) for j in range(wy,0,-1)]
    if SIDE==1:edge=list(reversed(edge))
    wall=len(vs)
    vs.extend(vs[i] for i in edge)
    bottom=len(vs)
    vs.extend((vs[i][0],vs[i][1],-.18) for i in edge)
    for j in range(len(edge)):
        k=(j+1)%len(edge);fs.append((wall+j,bottom+j,bottom+k,wall+k))
    fs.append(tuple(reversed(range(bottom,len(vs)))))
    water=mesh('Mer_En_Volume',vs,fs,WATER,WAVES,(.17,.55,.62),True,role='water')
    for polygon in water.data.polygons:
        polygon.use_smooth = polygon.index < wx*wy
    attr=water.data.color_attributes['Color']
    for poly in water.data.polygons:
        for idx in poly.loop_indices:
            v=vs[water.data.loops[idx].vertex_index];d=-SIDE*v[1]
            depth=min(1,max(0,(d-float(shore(v[0])))/1.5))
            shallow=np.array([.38,.70,.66]);deep=np.array([.10,.37,.51])
            tint=shallow*(1-depth)+deep*depth
            tint*=1+.025*math.sin(v[0]*8+d*16)
            attr.data[idx].color=color(tuple(tint))

    # Filets d'écume discontinus et petites vagues en géométrie, pas de cartes alpha.
    vs,fs=[],[]
    for band in range(3):
        for k in range(10):
            xa=-1.38+k*.275+RNG.uniform(-.02,.02);length=RNG.uniform(.12,.22)
            start=len(vs)
            for j in range(7):
                xx=xa+length*j/6
                d=float(shore(xx))+.028+band*.19+.02*math.sin(xx*6+band)
                width=.005 if band else .009
                for offset in (-width,width):
                    vs.append((xx,scene_y(d+offset),water_height(xx,d)+.003))
            for j in range(6):
                f=(start+2*j,start+2*j+1,start+2*j+3,start+2*j+2)
                fs.append(f if SIDE==1 else tuple(reversed(f)))
    foam=mesh('Ecume',vs,fs,WATER,WAVES,(.76,.86,.76),role='water')

    def clear_land(x,d,r):
        if abs(x)<.25+r or d>.42-r or d<-2.30: return False
        if d<-1.45 and abs(x)<1.12: return False
        if abs(x)>W/2-r:return False
        return all(math.hypot(x-sx,d)>.44+r for sx in (-.48,.48))

    def locate_land(r):
        for _ in range(3000):
            px,d=RNG.uniform(-1.33,1.33),RNG.uniform(-2.28,.4)
            if clear_land(px,d,r):return px,d
        raise RuntimeError('Aucun emplacement libre sur la terre')

    # Les deux compositions ont leurs propres caps, criques et rochers, sans rotation de copie.
    headlands=[(-1.17,.65,.20,.24,.27),(-1.24,.91,.13,.15,.18),(1.23,.45,.14,.17,.18)] if variant=='rouge' else [(1.16,.73,.21,.27,.30),(1.28,1.02,.11,.14,.15),(-1.24,.46,.13,.18,.15)]
    for i,(px,d,rx,ry,rz) in enumerate(headlands):
        vs,fs=[],[]
        add_ico(vs,fs,(0,0,rz*.46),(rx,ry,rz),2,.17)
        rock=mesh(f'Cap_Granitique_{i:02}',vs,fs,NATURAL,ROCKS,(.67,.60,.47),role='rock')
        rock.location=(px,scene_y(d),.09)
    for i in range(25):
        size=RNG.uniform(.025,.07);px,d=locate_land(size)
        vs,fs=[],[];add_ico(vs,fs,(0,0,size*.25),(size,size*.8,size*.6),2,.20)
        rock=mesh(f'Galet_{i:02}',vs,fs,NATURAL,ROCKS,(.65,.61,.51),True,role='rock')
        rock.location=(px,scene_y(d),ground_height(px,scene_y(d)))

    for i in range(12):
        px,d=locate_land(.11);vs,fs=[],[]
        for _ in range(7):
            a,r=RNG.uniform(0,math.tau),RNG.uniform(0,.06)
            add_ico(vs,fs,(math.cos(a)*r,math.sin(a)*r,.05),(.045,.04,.04))
        bush=mesh(f'Maquis_Cotier_{i:02}',vs,fs,NATURAL,PLANTS,(.32,.39,.20),True)
        bush.location=(px,scene_y(d),ground_height(px,scene_y(d)))
    for i in range(100):
        px,d=locate_land(.022);vs,fs=[],[]
        for _ in range(4):
            a,h=RNG.uniform(0,math.tau),RNG.uniform(.035,.09)
            start=len(vs);bx,by=RNG.uniform(-.018,.018),RNG.uniform(-.018,.018)
            vs.extend([(bx-.004,by,0),(bx+.004,by,0),(bx,by+.002,0),(bx+math.cos(a)*h*.3,by+math.sin(a)*h*.3,h)])
            fs.extend(tuple(start+j for j in f) for f in [(0,1,3),(1,2,3),(2,0,3),(0,2,1)])
        grass=mesh(f'Oyat_{i:03}',vs,fs,NATURAL,PLANTS,(.57,.56,.35))
        grass.location=(px,scene_y(d),ground_height(px,scene_y(d)))

    # Deux repères uniquement ; les slots réels restent créés par le jeu.
    for i, (px, py) in enumerate([(-.48,0),(.48,0)]):
        obj = bpy.data.objects.new(f'Slot_libre_{i+1}', None)
        GUIDES.objects.link(obj); obj.location = (px, py, .1)
        obj.empty_display_type = 'CIRCLE'; obj.empty_display_size = .39
        obj['note'] = 'Repère uniquement ; le slot réel est créé par le jeu.'

    bpy.ops.object.select_all(action='DESELECT')
    for obj in EXPORT: obj.select_set(True)
    bpy.context.view_layer.objects.active = top
    glb = ROOT / 'exports' / f'{asset}.glb'
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
    scene.world = bpy.data.worlds.new('Ciel_Studio')
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
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/f'{asset}.blend'))
    for name, cam in cameras.items():
        scene.camera=cam;scene.render.filepath=str(ROOT/'previews'/f'{asset}_{name}.png')
        assert bpy.ops.render.render(write_still=True)=={'FINISHED'}

    raw=glb.read_bytes()
    magic, version, length=struct.unpack_from('<III',raw)
    assert magic==0x46546C67 and version==2 and length==len(raw)
    size,kind=struct.unpack_from('<II',raw,12)
    assert kind==0x4E4F534A
    doc=json.loads(raw[20:20+size])
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    assert triangles < 12000 and len(doc['materials'])==3
    assert not doc.get('animations') and not doc.get('skins')
    assert all('uri' not in im for im in doc['images'])
    bpy.context.view_layer.update()
    points=[obj.matrix_world @ Vector(p) for obj in EXPORT for p in obj.bound_box]
    bounds=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
    report={'triangles':triangles,'meshes_authoring':len(doc['meshes']),'materials':len(doc['materials']),
            'bytes':length,'textures':[1024,1024],'dimensions_three':[bounds[0],bounds[2],bounds[1]],'owner':variant,'water_side_three_z':SIDE,
            'runtime_batches_per_tile':5,'slot_clearance_radius':.44,
            'note':'Fusion statique des décors au chargement ; aucun test sur casque physique effectué.'}
    (ROOT/'logs'/f'{asset}-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(asset.upper()+'_VALIDATION',json.dumps(report))

for variant in ('rouge','bleu'):
    build(variant)
