"""Inspecte les deux GLB fournis sans modifier les originaux."""
from pathlib import Path
import bpy, json
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
for file, label in [('u fullettu 3d.glb', 'fullettu'), ('lantern fullettu 3d.glb', 'lanterne_fullettu')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.import_scene.gltf(filepath=str(Path('/Users/robin/Downloads') / file))
    s = bpy.context.scene
    meshes = [o for o in s.objects if o.type == 'MESH' and not o.hide_render]
    if label == 'fullettu':
        meshes = [o for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (low + high) / 2; h = high.z - low.z
    arms = [o for o in s.objects if o.type == 'ARMATURE']
    data = {'label':label, 'low':list(low), 'high':list(high),
            'meshes':[[o.name, len(o.data.vertices)] for o in meshes],
            'textures':[[i.name, list(i.size)] for i in bpy.data.images],
            'bones':{b.name:list(a.matrix_world @ b.head_local) for a in arms for b in a.data.bones}}
    (ROOT / 'logs' / (label + '-source.json')).write_text(json.dumps(data, indent=2))
    print('SOURCE', label, 'bounds', list(low), list(high), flush=True)
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 16
    s.cycles.use_denoising = True
    s.render.resolution_x = 750; s.render.resolution_y = 900; s.render.resolution_percentage = 100
    s.world = bpy.data.worlds.new('Studio'); s.world.color = (.2, .2, .2)
    for name, offset, power in [('Key',(-2,-3,4),450), ('Fill',(2,1,3),250)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=4
        o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=center+Vector(offset)*h
        o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('Camera');d.type='ORTHO';d.ortho_scale=h*1.4
    o=bpy.data.objects.new('Camera',d);s.collection.objects.link(o);o.location=center+Vector((2,-4,1.1))*h
    o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler();s.camera=o
    s.render.filepath=str(ROOT/'previews'/(label+'_source.png'));bpy.ops.render.render(write_still=True)
