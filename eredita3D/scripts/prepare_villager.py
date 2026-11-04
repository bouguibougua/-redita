import bpy, math, json, os, sys, argparse
from mathutils import Vector

parser=argparse.ArgumentParser(description='Prepare an unrigged T-pose villager GLB and preview assets.')
parser.add_argument('--source',required=True,help='Source GLB, left unchanged.')
parser.add_argument('--output-dir',required=True,help='Directory for GLB, textures, previews and summary.')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SOURCE=os.path.abspath(args.source)
OUT=os.path.abspath(args.output_dir)
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SOURCE)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
source_triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
print('SOURCE_TRIANGLES', source_triangles, flush=True)
for ob in meshes:
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    modifier = ob.modifiers.new('RTS mesh simplification', 'DECIMATE')
    modifier.decimate_type = 'COLLAPSE'
    modifier.ratio = 16000 / source_triangles
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.select_set(False)
print('DECIMATED', sum(len(o.data.polygons) for o in meshes), flush=True)
# Blender uses Z up; the glTF exporter converts back to Y up. Imported +Z
# glTF faces towards Blender -Y. Keep this orientation unless preview shows otherwise.
verts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
min_v = Vector([min(v[i] for v in verts) for i in range(3)])
max_v = Vector([max(v[i] for v in verts) for i in range(3)])
scale = 1.80 / (max_v.z-min_v.z)
center = Vector(((min_v.x+max_v.x)/2, (min_v.y+max_v.y)/2, min_v.z))
for ob in meshes:
    for v in ob.data.vertices:
        v.co = (ob.matrix_world @ v.co-center)*scale
    ob.matrix_world.identity()
    ob.name = 'Habitant'
    ob.data.name = 'Habitant_mesh'
# Source is unrigged and in a T-pose. Lower both arms with a smooth shoulder
# transition, preserving the mesh, original UV coordinates and outfit.
def smoothstep(a,b,value):
    t=max(0.0,min(1.0,(value-a)/(b-a)))
    return t*t*(3.0-2.0*t)
for ob in meshes:
    for v in ob.data.vertices:
        x,y,z=v.co
        arm_weight=smoothstep(.215,.355,abs(x))*smoothstep(1.17,1.29,z)
        if arm_weight <= 0:continue
        side=1 if x>=0 else -1
        theta=math.radians(71.0)*side*arm_weight
        px,pz=.245*side,1.405
        dx,dz=x-px,z-pz
        v.co.x=px+math.cos(theta)*dx+math.sin(theta)*dz
        v.co.z=pz-math.sin(theta)*dx+math.cos(theta)*dz
    ob.data.update()
for mat in bpy.data.materials:
    mat.name = 'Habitant_material'
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'DITHERED'
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Alpha'].default_value = 1.0
                if node.inputs['Alpha'].is_linked:
                    for link in list(node.inputs['Alpha'].links):mat.node_tree.links.remove(link)
# Use fresh datablocks so the exporter embeds the resized pixels, rather than
# the unchanged bytes of the imported packed 4K images.
for i, old in enumerate(list(bpy.data.images)):
    if old.type != 'IMAGE':continue
    _=old.pixels[0]  # Force lazy imported image data to load.
    old.scale(1024,1024)
    is_normal='normal' in old.name.lower()
    is_color='basecolor' in old.name.lower()
    name='normal' if is_normal else ('basecolor' if is_color else 'roughness_metallic')
    image=bpy.data.images.new('Habitant_'+name,width=1024,height=1024,alpha=False)
    image.colorspace_settings.name=old.colorspace_settings.name
    image.pixels.foreach_set(old.pixels[:])
    image.file_format='PNG' if is_normal else 'JPEG'
    image.filepath_raw=os.path.join(OUT,name+('.png' if is_normal else '.jpg'))
    image.save()
    image.pack()
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image==old:node.image=image
    bpy.data.images.remove(old)
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
file = os.path.join(OUT,'habitant.glb')
bpy.ops.export_scene.gltf(filepath=file, export_format='GLB', use_selection=True,
    export_apply=True, export_animations=False, export_skins=False,
    export_yup=True, export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_image_format='AUTO')
verts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo = [min(v[i] for v in verts) for i in range(3)]
hi = [max(v[i] for v in verts) for i in range(3)]
summary = {
    'source':SOURCE, 'source_bytes':os.path.getsize(SOURCE),
    'source_triangles':source_triangles, 'output':file, 'output_bytes':os.path.getsize(file),
    'vertices':sum(len(o.data.vertices) for o in meshes),
    'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
    'mesh_count':len(meshes),'material_count':len({slot.material.name for o in meshes for slot in o.material_slots}),
    'texture_size':[1024,1024], 'bounds_blender_min':lo,'bounds_blender_max':hi,
    'standing_height_m':hi[2]-lo[2], 'feet_blender_z':lo[2],
    'gltf_forward':'+Z', 'rigged':False,'animations':0,
    'notes':['Source design and UVs retained with collapse simplification.', 'Arms lowered 71 degrees with blended shoulder deformation from the source T-pose.', 'Opaque base color; no source skeleton or animation.']
}
with open(os.path.join(OUT,'summary.json'),'w') as f:json.dump(summary,f,indent=2)
print('SUMMARY',json.dumps(summary),flush=True)
# Neutral studio preview. These objects are added after exporting the game GLB.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.12,.12,.12)
scene.view_settings.view_transform='AgX'
mat=bpy.data.materials.new('Preview ground');mat.diffuse_color=(.075,.085,.095,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006))
ground=bpy.context.object
ground.data.materials.append(mat)
def point_at(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;point_at(obj,(0,0,.9))
light('Key',(-3,-4,5),700,4)
light('Fill',(3,-2,3),450,3)
light('Rim',(1,3,4),800,3)
data=bpy.data.cameras.new('Preview Camera');cam=bpy.data.objects.new('Preview Camera',data)
scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=2.3
for label,loc in [('front',(0,-5,1.15)),('three_quarter',(3.5,-5,2.2)),('back',(0,5,1.15))]:
    cam.location=loc;point_at(cam,(0,0,.9));scene.render.filepath=os.path.join(OUT,'preview_'+label+'.png')
    bpy.ops.render.render(write_still=True)
ground.hide_render=True
scene.render.film_transparent=True
scene.render.resolution_x=512
scene.render.resolution_y=512
scene.cycles.samples=48
data.ortho_scale=1.98
cam.location=(3.0,-5.0,1.9)
point_at(cam,(0,0,.9))
scene.render.filepath=os.path.join(OUT,'habitant-sprite.png')
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'preview.blend'))
