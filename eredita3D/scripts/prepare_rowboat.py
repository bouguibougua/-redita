"""Prepare the supplied rowboat locally with Blender; leave its source unchanged."""
from pathlib import Path
import bpy,math,json,hashlib,struct,argparse,sys
from mathutils import Vector,Matrix
p=argparse.ArgumentParser();p.add_argument('--source',default='/Users/robin/Downloads/barque 3d.glb');p.add_argument('--output-dir',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);SOURCE=Path(a.source).resolve();ROOT=Path(a.output_dir).resolve();ROOT.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.ops.import_scene.gltf(filepath=str(SOURCE))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH');body.name='Barque_Fournie';bpy.context.view_layer.objects.active=body;body.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
source_triangles=len(body.data.polygons);m=body.modifiers.new('Optimisation_Jeu','DECIMATE');m.ratio=min(1,5000/source_triangles);m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
points=[body.matrix_world@v.co for v in body.data.vertices];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));rotation=Matrix.Rotation(-math.pi/2,3,'Z');factor=.58/(hi.x-lo.x)
for v in body.data.vertices:v.co=rotation@((body.matrix_world@v.co-center)*factor)
body.matrix_world.identity();body.data.update()
for f in body.data.polygons:f.use_smooth=True
for old in list(bpy.data.images):
 if old.type!='IMAGE':continue
 _=old.pixels[0];old.scale(1024,1024);image=bpy.data.images.new('Barque_BaseColor_1024',width=1024,height=1024,alpha=False);image.colorspace_settings.name=old.colorspace_settings.name;image.pixels.foreach_set(old.pixels[:]);image.file_format='JPEG';image.filepath_raw=str(ROOT/'barque-basecolor.jpg');image.save();image.pack()
 for mat in body.data.materials:
  for n in mat.node_tree.nodes:
   if n.type=='TEX_IMAGE' and n.image==old:n.image=image
for mat in body.data.materials:
 mat.name='Barque_Bois_Texture'
 for n in mat.node_tree.nodes:
  if n.type=='BSDF_PRINCIPLED':
   n.inputs['Transmission Weight'].default_value=0;n.inputs['Alpha'].default_value=1
   for link in list(n.inputs['Alpha'].links):mat.node_tree.links.remove(link)
body['source_sha256']=source_hash;body['forward']='+Z';file=ROOT/'barque.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_extras=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=90)
raw=file.read_bytes();j=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);tri=sum(j['accessors'][p['indices']]['count']//3 for mesh in j['meshes'] for p in mesh['primitives']);assert tri<=5000 and len(j['meshes'])==1
report={'source':str(SOURCE),'source_sha256':source_hash,'source_triangles':source_triangles,'triangles':tri,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'dimensions_blender':list(body.dimensions),'texture_size':1024,'length':.58,'forward':'+Z','simulation_changes':False};(ROOT/'validation.json').write_text(json.dumps(report,indent=2));print('VALIDATION',json.dumps(report),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'barque.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=s.render.resolution_y=720;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('Studio');s.world.color=(.18,.18,.18)
for name,pos,power in [('Key',(-2,-3,4),450),('Fill',(2,1,3),250)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=3;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.05))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Preview');d.type='ORTHO';d.ortho_scale=.76;o=bpy.data.objects.new('Preview',d);s.collection.objects.link(o);s.camera=o;o.location=(.7,-1,1.0);o.rotation_euler=(Vector((0,0,.045))-o.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ROOT/'barque-preview.png');bpy.ops.render.render(write_still=True)
s.render.film_transparent=True;s.render.resolution_x=s.render.resolution_y=512;s.render.filepath=str(ROOT/'barque-sprite.png');bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
