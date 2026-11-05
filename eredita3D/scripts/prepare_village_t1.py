"""Prepare the five supplied village GLBs and model three modular-looking ramparts locally."""
import argparse, hashlib, json, math, struct, sys
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', default='/Users/robin/Downloads')
parser.add_argument('--output-dir', required=True)
parser.add_argument('--only', nargs='+', help='Asset names to rebuild, e.g. feu_camp_t1')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(args.output_dir).resolve(); out.mkdir(parents=True, exist_ok=True)
reports = json.loads((out/'validation.json').read_text()) if args.only and (out/'validation.json').exists() else []
if args.only: reports = [r for r in reports if r['name'] not in args.only]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0

def export(name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type == 'MESH': o.select_set(True)
    file = out / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(file), export_format='GLB', use_selection=True,
        export_animations=False, export_skins=False, export_extras=True, export_cameras=False,
        export_lights=False, export_image_format='JPEG', export_jpeg_quality=88)
    raw = file.read_bytes(); j = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
    tri = sum(j['accessors'][p['indices']]['count'] // 3 for m in j['meshes'] for p in m['primitives'])
    return {'name':name, 'triangles':tri, 'bytes':len(raw), 'sha256':hashlib.sha256(raw).hexdigest()}

def render(name, front=True, width=1.55):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16; scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 640; scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.new('Studio'); scene.world.color = (.24,.24,.24)
    for label, pos, power in [('Key',(-2,-3,4),350),('Fill',(2,1,3),220)]:
        d = bpy.data.lights.new(label,'AREA'); d.energy = power; d.size = 3
        o = bpy.data.objects.new(label,d); scene.collection.objects.link(o); o.location = pos
        o.rotation_euler = (Vector((0,0,.2))-o.location).to_track_quat('-Z','Y').to_euler()
    d = bpy.data.cameras.new('Preview'); d.type='ORTHO'; d.ortho_scale=width
    o = bpy.data.objects.new('Preview', d); scene.collection.objects.link(o); scene.camera=o
    # glTF front is +Z, Blender front is -Y.
    o.location=(1.5,-2.2,1.6); target=Vector((0,0,.22 if width<2 else .1))
    o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png')); bpy.ops.render.render(write_still=True)

for source_name, name, budget in [('artisanat','artisanat_t1',10000),('bergerie','bergerie_t1',10000),
    ('boucherie','boucherie_t1',18000),('campfire','feu_camp_t1',18000),('hotel','hotel_t1',18000)]:
    if args.only and name not in args.only: continue
    reset(); source=Path(args.source_dir)/(source_name+' T1 3d.glb')
    source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    print('PREPARE',name,flush=True); bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)); scale=1/max(hi.x-lo.x,hi.y-lo.y)
    source_triangles=sum(len(o.data.polygons) for o in objects)
    for o in objects:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
        matrix=o.matrix_world.copy(); o.parent=None
        for v in o.data.vertices: v.co=(matrix@v.co-origin)*scale
        o.matrix_world.identity(); o.data.update(); o.name=name
        if source_triangles>budget:
            m=o.modifiers.new('Version_jeu','DECIMATE'); m.ratio=budget/source_triangles
            m.use_collapse_triangulate=True; bpy.ops.object.modifier_apply(modifier=m.name)
        o['source_sha256']=source_hash; o['village_asset']=name
        for p in o.data.polygons:p.use_smooth=True
    if name == 'feu_camp_t1':
        flames=[]
        for label,color in [('Flamme_orange',(1,.23,.008,1)),('Flamme_doree',(1,.60,.08,1))]:
            mat=bpy.data.materials.new(label);mat.use_nodes=True
            shader=mat.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value=color
            shader.inputs['Emission Color'].default_value=color
            shader.inputs['Emission Strength'].default_value=.5
            flames.append(mat)
        for o in objects:
            first=len(o.data.materials)
            for mat in flames:o.data.materials.append(mat)
            for poly in o.data.polygons:
                center=sum((o.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
                if center.z>.205 and abs(center.x)<.24 and abs(center.y)<.24:
                    poly.material_index=first+(1 if center.z>.37 else 0)
    for image in list(bpy.data.images):
        if image.type!='IMAGE' or not image.size[0]:continue
        w,h=image.size[:]; ratio=min(1,1024/max(w,h))
        if ratio<1:image.scale(max(1,round(w*ratio)),max(1,round(h*ratio)))
        image.pack()
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        for n in mat.node_tree.nodes:
            if n.type!='BSDF_PRINCIPLED':continue
            for socket in ['Alpha','Transmission Weight']:
                for link in list(n.inputs[socket].links):mat.node_tree.links.remove(link)
            n.inputs['Alpha'].default_value=1; n.inputs['Transmission Weight'].default_value=0
    report=export(name); report.update(source=str(source),source_sha256=source_hash,
        source_triangles=source_triangles,texture_max=1024)
    assert report['triangles']<=budget+10
    reports.append(report); print('RESULT',json.dumps(report),flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')))
    render(name)

def material(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.85; return m

def box(name,position,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position); o=bpy.context.object; o.name=name
    o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat); return o

for tier in [1,2,3]:
    if args.only and 'remparts_t'+str(tier) not in args.only:continue
    reset(); wood=material('Bois_miel',(.34,.17,.065)); woodlight=material('Bois_coupe',(.52,.29,.11))
    stone=material('Pierre_grise' if tier==2 else 'Enduit_clair',(.35,.34,.30) if tier==2 else (.68,.62,.48))
    iron=material('Ferrures',(.11,.12,.115)); red=material('Banniere',(.47,.06,.04))
    # Blender XY becomes Three.js XZ; front is -Y, toward the battlefield.
    width=2.76; depth=2.02; height=[0,.32,.38,.44][tier]
    sections=[('avant-gauche',(-width/2,-depth/2),(-.26,-depth/2)),
        ('avant-droite',(.26,-depth/2),(width/2,-depth/2)),
        ('arriere',(-width/2,depth/2),(width/2,depth/2)),
        ('gauche',(-width/2,-depth/2),(-width/2,depth/2)),
        ('droite',(width/2,-depth/2),(width/2,depth/2))]
    for label,start,end in sections:
        sx,sy=start; ex,ey=end; dx=ex-sx;dy=ey-sy;length=math.hypot(dx,dy);angle=math.atan2(dy,dx)
        parts=[]; count=math.ceil(length/(.09 if tier==1 else .22))
        for i in range(count):
            t=(i+.5)/count; x=sx+dx*t;y=sy+dy*t
            if tier==1:
                h=height+(.015 if i%3==0 else 0)
                bpy.ops.mesh.primitive_cylinder_add(vertices=5,radius=.052,depth=h-.065,location=(x,y,(h-.065)/2))
                post=bpy.context.object;post.data.materials.append(woodlight if i%3 else wood);parts.append(post)
                bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=.052,radius2=0,depth=.095,location=(x,y,h-.04))
                tip=bpy.context.object;tip.data.materials.append(woodlight);parts.append(tip)
            else:
                rows=3
                for row in range(rows):
                    block=box('Bloc',(x,y,(row+.5)*(height-.08)/rows),
                        (length/count-.007,.12,(height-.08)/rows-.006),stone);block.rotation_euler.z=angle;parts.append(block)
                cap=box('Merlon',(x,y,height-.015 if i%2==0 else height-.055),
                    (length/count-.008,.14,.08 if i%2==0 else .045),stone);cap.rotation_euler.z=angle;parts.append(cap)
        if tier==1:
            for z in [.09,.22]:
                rail=box('Traverse',((sx+ex)/2,(sy+ey)/2+.018,z),(length,.035,.035),wood)
                rail.rotation_euler.z=angle;parts.append(rail)
        bpy.ops.object.select_all(action='DESELECT')
        for o in parts:o.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();section=bpy.context.object
        section.name='rempart-'+label; section['rampart_section']=label
        # Stable pivots let the destroyed front fall outward without affecting the board.
        bpy.context.scene.cursor.location=((sx+ex)/2,(sy+ey)/2,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    gate=box('rempart-porte',(0,-depth/2,.16),(.48,.06,.32),wood)
    gate['rampart_section']='porte'
    for x in [-.26,.26]:box('Pilier_porte',(x,-depth/2,height/2),(.10,.14,height+.07),woodlight if tier==1 else stone)
    for z in [.08,.24]:
        brace=box('Ferrure_porte',(0,-depth/2-.04,z),(.44,.012,.021),iron);brace['rampart_section']='porte'
    if tier>1:
        for x in [-.29,.29]:
            tower=box('Tour_porte',(x,-depth/2,.29),(.19,.22,.58 if tier==2 else .67),stone)
            box('Couronnement',(x,-depth/2,.60 if tier==2 else .68),(.22,.25,.07),stone)
    report=export('remparts_t'+str(tier));reports.append(report)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/('remparts_t'+str(tier)+'.blend')))
    render('remparts_t'+str(tier),width=3.8)

(out/'validation.json').write_text(json.dumps(reports,indent=2))
print('VILLAGE_ASSETS_COMPLETE',flush=True)
