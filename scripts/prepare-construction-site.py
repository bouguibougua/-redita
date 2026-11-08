"""Prépare le GLB Tripo original pour le plateau : axe, emprise et textures 512 px.
Usage : Blender --background --python ce_script.py -- source.glb destination.glb
Aucun service externe ni crédit Tripo n'est utilisé par cette préparation locale.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
source, destination = map(Path, sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=list(bpy.context.scene.objects)
root=bpy.data.objects.new('chantier-construction',None);bpy.context.collection.objects.link(root)
for obj in objects:
    if obj.parent is None:obj.parent=root
root.rotation_euler.z=-math.pi/2
bpy.context.view_layer.update()
def bounds():
    points=[obj.matrix_world @ Vector(corner) for obj in objects if obj.type=='MESH' for corner in obj.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])
lo,hi=bounds();size=hi-lo
root.scale=(min(.65/size.x,.55/size.y,.44/size.z),)*3
bpy.context.view_layer.update();lo,hi=bounds()
root.location-=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
bpy.context.view_layer.update()
for image in bpy.data.images:
    if image.type=='IMAGE' and image.size[0] and max(image.size)>512:
        factor=512/max(image.size);image.scale(max(1,round(image.size[0]*factor)),max(1,round(image.size[1]*factor)))
    if image.type=='IMAGE':image.pack()
destination.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects+[root]:obj.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',use_selection=True,export_yup=True)
lo,hi=bounds()
print('CONSTRUCTION_VALIDATION '+json.dumps({'blender_size':list(hi-lo),'triangles':sum(len(obj.data.loop_triangles) for obj in objects if obj.type=='MESH'),'bytes':destination.stat().st_size,'textures':[{ 'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.type=='IMAGE']}))
