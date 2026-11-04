import bpy,json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath="/Users/robin/Downloads/orc barbarian 3d model.glb")
s=bpy.context.scene
meshes=[o for o in s.objects if o.type=="MESH" and any(m.type=="ARMATURE" for m in o.modifiers)];arms=[o for o in s.objects if o.type=="ARMATURE"]
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
print("ORCU_INSPECT",json.dumps({"meshes":[[o.name,len(o.data.vertices),list(o.dimensions)] for o in meshes],"bounds":[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]],"textures":[[i.name,list(i.size)] for i in bpy.data.images],"bones":[[b.name,list(b.head_local),list(b.tail_local)] for a in arms for b in a.data.bones]}))
bpy.ops.wm.save_as_mainfile(filepath="/Users/robin/-redita/-redita/eredita3D/models/orcu_source.blend")
s.render.engine="CYCLES";s.cycles.device="CPU";s.cycles.samples=24;s.cycles.use_denoising=True
s.render.resolution_x=800;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new("Studio");s.world.color=(.2,.2,.2)
low=Vector(tuple(min(p[i] for p in points) for i in range(3)));high=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(low+high)/2;h=high.z-low.z
for n,offset,power in [("Key",(-2,-3,4),450),("Fill",(2,1,3),250)]:
 d=bpy.data.lights.new(n,"AREA");d.energy=power;d.size=4;o=bpy.data.objects.new(n,d);s.collection.objects.link(o);o.location=center+Vector(offset)*h;o.rotation_euler=(center-o.location).to_track_quat("-Z","Y").to_euler()
d=bpy.data.cameras.new("Camera");d.type="ORTHO";d.ortho_scale=h*1.35;o=bpy.data.objects.new("Camera",d);s.collection.objects.link(o);o.location=center+Vector((2,-4,1.1))*h;o.rotation_euler=(center-o.location).to_track_quat("-Z","Y").to_euler();s.camera=o
s.render.filepath="/Users/robin/-redita/-redita/eredita3D/previews/orcu_source.png";bpy.ops.render.render(write_still=True)
