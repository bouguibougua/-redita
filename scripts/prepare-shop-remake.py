"""Blender: prepare the approved GLBs locally; never call a paid service.

Blender --background --python scripts/prepare-shop-remake.py [-- --only filet]
Source models and receipts are preserved. Color textures <=1024, data maps <=512.
The fishing net's spurious flat grey backing is removed by UV/color sampling.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
plan=json.loads((ROOT/'assets/shop/remake-plan.json').read_text())
report=json.loads((ROOT/'assets/shop/remake-v2/generation-report.json').read_text())
metrics_file=ROOT/'assets/shop/remake-v2/web-models.json'
metrics=json.loads(metrics_file.read_text()) if metrics_file.exists() else {}
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
only=args[1] if len(args)>1 and args[0]=='--only' else None
for job in plan['jobs']:
    ident=job['id']
    if only and ident!=only:continue
    record=report['jobs'].get(ident,{})
    if record.get('status')!='success':continue
    destination=ROOT/job['destination']
    if destination.exists() and ident in metrics and not only:continue
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.meshes):
        if not data.users:bpy.data.meshes.remove(data)
    for material in list(bpy.data.materials):
        if not material.users:bpy.data.materials.remove(material)
    for image in list(bpy.data.images):
        if not image.users:bpy.data.images.remove(image)
    source=ROOT/record['result']['model_file']
    bpy.ops.import_scene.gltf(filepath=str(source))
    base_images=set()
    for material in bpy.data.materials:
        if not material.use_nodes:continue
        for node in material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                links=node.inputs['Base Color'].links
                if links and links[0].from_node.type=='TEX_IMAGE':base_images.add(links[0].from_node.image)
    removed=0
    if ident=='filet':
        import bmesh
        for obj in bpy.context.scene.objects:
            if obj.type!='MESH':continue
            mesh=obj.data
            if not mesh.uv_layers.active:continue
            image=next(iter(base_images));pixels=list(image.pixels);width,height=image.size
            uv=mesh.uv_layers.active.data
            def color_at(u,v):
                offset=(min(height-1,max(0,int(v*height)))*width+min(width-1,max(0,int(u*width))))*4
                return pixels[offset:offset+3]
            rejected=[]
            for poly in mesh.polygons:
                coords=[uv[i].uv[:] for i in poly.loop_indices]
                if len(coords)!=3:continue
                samples=[]
                for weights in [(1/3,1/3,1/3),(.6,.2,.2),(.2,.6,.2),(.2,.2,.6)]:
                    u=sum(a[0]*w for a,w in zip(coords,weights));v=sum(a[1]*w for a,w in zip(coords,weights));rgb=color_at(u,v)
                    samples.append(max(rgb)-min(rgb)<.065 and .12<sum(rgb)/3<.85)
                if any(samples):rejected.append(poly.index)
            bm=bmesh.new();bm.from_mesh(mesh);bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm,geom=[bm.faces[i] for i in rejected],context='FACES');bm.to_mesh(mesh);bm.free();mesh.update();removed+=len(rejected)
    if ident=='filet':
        # Les cordes intérieures étaient surtout peintes sur le fond généré.
        # Reconstruire un vrai réseau de losanges ouverts, avec des nœuds en volume.
        import math
        rope=bpy.data.materials.new('Hemp net knots and strands');rope.use_nodes=True
        rope.node_tree.nodes.clear();shader=rope.node_tree.nodes.new('ShaderNodeBsdfPrincipled');output=rope.node_tree.nodes.new('ShaderNodeOutputMaterial');rope.node_tree.links.new(shader.outputs['BSDF'],output.inputs['Surface']);shader.inputs['Base Color'].default_value=(.46,.31,.16,1);shader.inputs['Roughness'].default_value=.88
        tex=rope.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/shop/textures/wicker-color.png'),check_existing=True)
        rope.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        vertices=[];faces=[];uvs=[]
        def strand(start,end,radius=.0038):
            start,end=Vector(start),Vector(end);axis=(end-start).normalized();tangent=axis.cross(Vector((1,0,0))).normalized();bitangent=axis.cross(tangent).normalized();base=len(vertices)
            for center in (start,end):
                for n in range(6):vertices.append(tuple(center+radius*(math.cos(n*math.tau/6)*tangent+math.sin(n*math.tau/6)*bitangent)))
            for n in range(6):
                faces.append((base+n,base+(n+1)%6,base+6+(n+1)%6,base+6+n));uvs.append(((n/6,0),((n+1)/6,0),((n+1)/6,1),(n/6,1)))
        nodes=[]
        for row in range(11):
            current=[]
            for col in range(10):
                horizontal=-.25+col*.055+(row%2)*.0275
                if horizontal>.255:continue
                z=.35-row*.068-.035*(1-(horizontal/.27)**2)
                current.append(Vector((.042+.006*math.sin(row*.6),horizontal,z)))
            nodes.append(current)
        for row in range(10):
            for start in nodes[row]:
                for end in nodes[row+1]:
                    if abs(start.y-end.y)<.030:strand(start,end)
        for row in nodes:
            for point in row:
                strand(point+Vector((0,-.006,-.004)),point+Vector((0,.006,.004)),.0048)
        mesh=bpy.data.meshes.new('Open diamond mesh');mesh.from_pydata(vertices,[],faces);mesh.materials.append(rope)
        uv=mesh.uv_layers.new(name='UVMap')
        for poly,coords in zip(mesh.polygons,uvs):
            for index,coord in zip(poly.loop_indices,coords):uv.data[index].uv=coord
        obj=bpy.data.objects.new('Open fishing net mesh',mesh);bpy.context.collection.objects.link(obj)
    for image in bpy.data.images:
        if image.type!='IMAGE' or not image.size[0]:continue
        limit=1024 if image in base_images else 512
        if max(image.size)>limit:
            ratio=limit/max(image.size);image.scale(max(1,round(image.size[0]*ratio)),max(1,round(image.size[1]*ratio)))
        image.pack()
    destination.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_yup=True)
    triangles=0;points=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH':continue
        obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
        points.extend(obj.matrix_world@Vector(corner) for corner in obj.bound_box)
    metrics[ident]={'triangles':triangles,'bytes':destination.stat().st_size,'removedBackingFaces':removed,
        'boundsBlender':[ [min(v[i] for v in points) for i in range(3)],[max(v[i] for v in points) for i in range(3)] ],
        'textures':[list(image.size) for image in bpy.data.images if image.type=='IMAGE' and image.users],
        'taskId':record['result']['task_id'],'credits':record['result']['credits_consumed']}
    metrics_file.write_text(json.dumps(metrics,indent=2)+'\n')
    print('SHOP_MODEL '+json.dumps({'id':ident,**metrics[ident]}),flush=True)
