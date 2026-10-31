"""Guerrier corse : étude volumétrique V2 guidée par la référence, sans animation.

Blender 5.1.1, aucune dépendance externe. Exécution :
  Blender --background --factory-startup --python-exit-code 1 --python ce_script.py

Repère de travail : mètres, Z vertical, personnage tourné vers -Y.
Les proportions et détails sont regroupés ici pour les itérations suivantes.
La référence est l'illustration fournie dans la conversation : cuir riveté,
chemise ample, cheveux ondulés, barbe courte et étoffe rouge nouée à la taille.
Cette étude procédurale conserve des éléments séparés et n'est pas encore riggée.
"""

from pathlib import Path
import json
import math
import random
import struct

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "models/guerrier.blend"
GLB_PATH = ROOT / "exports/guerrier.glb"
PREVIEWS = ROOT / "previews"
REPORT_PATH = ROOT / "logs/guerrier-validation.json"

# Choix visuels de cette étude ; aucune statistique ou règle du jeu n'est modifiée.
SETTINGS = {
    "height_m": 1.83,
    "shoulder_z": 1.435,
    "shoulder_x": 0.205,
    "elbow_x": 0.475,
    "wrist_x": 0.735,
    "preview_size": 1100,
    "samples": 40,
    "triangle_budget": 35000,
    "texture_size": 512,
    "texture_repeat_m": .20,
}

COLLECTIONS = {}
MATERIALS = {}
RNG = random.Random(1610)


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    COLLECTIONS[name] = result
    return result


def move_to(obj, group):
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    COLLECTIONS[group].objects.link(obj)
    return obj


def mesh(name, vertices, faces, mat, group, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    COLLECTIONS[group].objects.link(obj)
    if mat:
        data.materials.append(MATERIALS[mat])
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def material(name, color, roughness=0.7, metallic=0.0):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    if result.node_tree is None:
        result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    MATERIALS[name] = result
    return result


def ellipsoid(name, center, scale, mat, group, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATERIALS[mat])
    for face in obj.data.polygons:
        face.use_smooth = True
    return move_to(obj, group)


def loft(name, profiles, mat, group, sides=20, axis="Z", center=(0, 0, 0), wave=0.0):
    """Surface fermée de sections elliptiques : (position, rayon1, rayon2, décalage)."""
    vertices, faces = [], []
    for ring, (position, radius_a, radius_b, offset) in enumerate(profiles):
        for j in range(sides):
            angle = math.tau * j / sides
            wrinkle = 1 + wave * math.cos(5 * angle + ring * 0.7)
            a = math.sin(angle) * radius_a * wrinkle
            b = -math.cos(angle) * radius_b * wrinkle + offset
            if axis == "Z":
                point = (center[0] + a, center[1] + b, center[2] + position)
            else:
                point = (center[0] + position, center[1] + b, center[2] + a)
            vertices.append(point)
    for i in range(len(profiles)-1):
        for j in range(sides):
            a = i*sides+j
            b = i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides) if axis == "Z" else (a+sides, b+sides, b, a))
    first = tuple(reversed(range(sides)))
    last = tuple((len(profiles)-1)*sides+j for j in range(sides))
    faces.extend((first, last) if axis == "Z" else (tuple(reversed(first)), tuple(reversed(last))))
    return mesh(name, vertices, faces, mat, group)


def tube(name, points, radii, mat, group, sides=7, flatten=1.0):
    """Mèche, couture ou cordon en volume ; aucun billboard ni plan de cheveux."""
    points = [Vector(p) for p in points]
    if isinstance(radii, (int, float)):
        radii = [radii] * len(points)
    vertices, faces = [], []
    previous_normal = None
    for i, point in enumerate(points):
        tangent = points[min(i+1, len(points)-1)] - points[max(0, i-1)]
        tangent.normalize()
        if previous_normal is None:
            reference = Vector((0, -1, 0))
            if abs(tangent.dot(reference)) > 0.9:
                reference = Vector((1, 0, 0))
            normal = tangent.cross(reference).normalized()
        else:
            normal = (previous_normal - tangent * previous_normal.dot(tangent)).normalized()
        bitangent = tangent.cross(normal).normalized()
        previous_normal = normal
        for j in range(sides):
            angle = math.tau*j/sides
            v = point + radii[i]*(math.cos(angle)*normal + flatten*math.sin(angle)*bitangent)
            vertices.append(tuple(v))
    for i in range(len(points)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces.extend((tuple(reversed(range(sides))), tuple((len(points)-1)*sides+j for j in range(sides))))
    return mesh(name, vertices, faces, mat, group)


def ribbon(name, points, width, thickness, mat, group):
    """Sangle réellement épaisse ; la largeur suit le plan XZ."""
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    for i, p in enumerate(points):
        tangent = points[min(i+1, len(points)-1)] - points[max(0, i-1)]
        side = Vector((-tangent.z, 0, tangent.x)).normalized() * width/2
        for sign, depth in [(-1,-1), (1,-1), (1,1), (-1,1)]:
            vertices.append(tuple(p + sign*side + Vector((0, depth*thickness/2, 0))))
    for i in range(len(points)-1):
        for j in range(4):
            a, b = i*4+j, i*4+(j+1)%4
            faces.append((a, b, b+4, a+4))
    faces.extend(((3,2,1,0), tuple((len(points)-1)*4+j for j in range(4))))
    return mesh(name, vertices, faces, mat, group, smooth=False)


def cloth_strip(name, points, widths, thickness, mat, group, fold=.004):
    """Étoffe plissée fermée et épaisse, sans image plane ni animation."""
    points=[Vector(p) for p in points]
    columns=8
    vertices,faces=[],[]
    for layer in (-1,1):
        for i,p in enumerate(points):
            tangent=points[min(i+1,len(points)-1)]-points[max(0,i-1)]
            across=Vector((-tangent.z,0,tangent.x)).normalized()
            for j in range(columns+1):
                u=j/columns
                wrinkle=fold*math.sin(u*math.tau*2+i*.38)
                edge_fray=(.004*math.sin(j*3.7) if i==len(points)-1 else 0)
                v=p+across*((u-.5)*widths[i])+Vector((0,wrinkle+layer*thickness/2,edge_fray))
                vertices.append(tuple(v))
    row=columns+1; sheet=len(points)*row
    for i in range(len(points)-1):
        for j in range(columns):
            a=i*row+j
            faces.append((a,a+row,a+row+1,a+1))
            faces.append((a+sheet,a+sheet+1,a+sheet+row+1,a+sheet+row))
    boundary=list(range(row))+[i*row+columns for i in range(1,len(points))]
    boundary+=list(range(sheet-2,sheet-row-1,-1))+[i*row for i in range(len(points)-2,0,-1)]
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        faces.append((a,b,b+sheet,a+sheet))
    return mesh(name,vertices,faces,mat,group)


def box(name, center, dimensions, mat, group, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATERIALS[mat])
    if bevel:
        modifier = obj.modifiers.new("Aretes_douces", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return move_to(obj, group)


def build_materials():
    material("Peau", (0.48, 0.255, 0.135), 0.72)
    material("Levres", (0.32, 0.12, 0.085), 0.8)
    material("Lin_ecru", (0.73, 0.66, 0.52), 0.95)
    material("Lin_revers", (0.64, 0.59, 0.47), 0.96)
    material("Bandeau_blanc", (0.91, 0.89, 0.81), 0.95)
    material("Cuir_gilet", (0.105, 0.036, 0.014), 0.68)
    material("Cuir_sangles", (0.070, 0.024, 0.009), 0.62)
    material("Cuir_bottes", (0.065, 0.027, 0.013), 0.68)
    material("Pantalon_brun", (0.12, 0.072, 0.035), 0.95)
    material("Etoffe_rouge", (0.29, 0.015, 0.010), 0.93)
    material("Cheveux_bruns", (0.045, 0.017, 0.007), 0.82)
    material("Meches_brunes", (0.075, 0.031, 0.012), 0.85)
    material("Yeux_ivoire", (0.52, 0.48, 0.40), 0.35)
    material("Iris_noisette", (0.10, 0.055, 0.02), 0.38)
    material("Pupille", (0.006, 0.004, 0.003), 0.3)
    material("Acier", (0.53, 0.59, 0.64), 0.3, 0.88)
    material("Acier_tranchant", (0.72, 0.77, 0.8), 0.24, 0.92)
    material("Laiton", (0.4, 0.24, 0.075), 0.45, 0.72)
    material("Fil_cuir", (0.29, 0.17, 0.072), 0.85)


def build_pbr_textures():
    """Petites textures PBR tuilables, produites par Python et embarquées au GLB."""
    size=SETTINGS["texture_size"]
    rng=np.random.default_rng(1610)
    y,x=np.mgrid[0:size,0:size].astype(np.float32)/size
    directory=ROOT/"textures/guerrier"
    directory.mkdir(parents=True,exist_ok=True)

    def noise(frequency):
        grid=rng.random((frequency,frequency)).astype(np.float32)
        xx=x*frequency;yy=y*frequency
        ix=xx.astype(int);iy=yy.astype(int)
        tx=xx-ix;ty=yy-iy
        tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
        return ((1-tx)*(1-ty)*grid[iy%frequency,ix%frequency]
            +tx*(1-ty)*grid[iy%frequency,(ix+1)%frequency]
            +(1-tx)*ty*grid[(iy+1)%frequency,ix%frequency]
            +tx*ty*grid[(iy+1)%frequency,(ix+1)%frequency])

    def image(name,rgb,color=False):
        if rgb.ndim==2:
            rgb=np.repeat(rgb[:,:,None],3,axis=2)
        rgb=np.clip(rgb,0,1)
        if color:
            rgb=np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
        rgba=np.concatenate((rgb,np.ones((size,size,1))),axis=2).astype(np.float32)
        result=bpy.data.images.new(name,width=size,height=size,alpha=True,float_buffer=False)
        result.colorspace_settings.name="sRGB" if color else "Non-Color"
        result.pixels.foreach_set(rgba.ravel())
        result.update()
        result.filepath_raw=str(directory/(name+".png"))
        result.file_format="PNG"
        result.save()
        result.pack()
        return result

    fine=noise(96)
    coarse=noise(7)*.55+noise(19)*.30+noise(39)*.15
    weave=(np.sin(x*math.tau*64)*np.sin(y*math.tau*64)+1)*.5
    fields={
        "cuir":(.76+.42*coarse+.07*fine, .45*noise(110)+.17*coarse),
        "tissu":(.86+.16*coarse+.06*weave, .48*weave+.07*fine),
    }
    maps={}
    for kind,(variation,height) in fields.items():
        dy,dx=np.gradient(height)
        normal=np.stack((-dx*1.8,-dy*1.8,np.ones_like(dx)),axis=2)
        normal/=np.linalg.norm(normal,axis=2,keepdims=True)
        maps[kind]={"normal":image(kind+"_normal",normal*.5+.5),
            "roughness":image(kind+"_rugosite",(.66 if kind=="cuir" else .9)+.06*(coarse-.5))}
    targets={"Cuir_gilet":"cuir","Cuir_sangles":"cuir","Cuir_bottes":"cuir",
        "Lin_ecru":"tissu","Lin_revers":"tissu","Bandeau_blanc":"tissu",
        "Pantalon_brun":"tissu","Etoffe_rouge":"tissu"}
    for name,kind in targets.items():
        mat=MATERIALS[name]
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        shader=nodes.get("Principled BSDF")
        color=np.array(shader.inputs["Base Color"].default_value[:3],dtype=np.float32)
        albedo=image(name+"_couleur",fields[kind][0][:,:,None]*color,color=True)
        texture=nodes.new("ShaderNodeTexImage");texture.image=albedo
        links.new(texture.outputs["Color"],shader.inputs["Base Color"])
        rough=nodes.new("ShaderNodeTexImage");rough.image=maps[kind]["roughness"]
        links.new(rough.outputs["Color"],shader.inputs["Roughness"])
        normals=nodes.new("ShaderNodeTexImage");normals.image=maps[kind]["normal"]
        normal=nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value=.28 if kind=="cuir" else .22
        links.new(normals.outputs["Color"],normal.inputs["Color"])
        links.new(normal.outputs["Normal"],shader.inputs["Normal"])
    print("TEXTURES_PBR_PRETES",flush=True)


def assign_uvs(obj):
    # Projection par face en échelle métrique ; les textures sont petites et répétables.
    uv=obj.data.uv_layers.get("UVMap") or obj.data.uv_layers.new(name="UVMap")
    repeat=SETTINGS["texture_repeat_m"]
    for polygon in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(polygon.normal[i]))
        axes=(1,2) if axis==0 else (0,2) if axis==1 else (0,1)
        for index in polygon.loop_indices:
            co=obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=(co[axes[0]]/repeat,co[axes[1]]/repeat)


def build_body():
    loft("Corps_base", [(0.935,.145,.10,0), (1.02,.16,.105,0),
        (1.12,.155,.10,0), (1.28,.20,.115,0), (1.38,.22,.11,0),
        (1.445,.19,.085,0), (1.48,.075,.065,0)], "Peau", "01_Corps")
    loft("Cou", [(1.455,.058,.055,0), (1.50,.056,.055,0),
        (1.57,.050,.050,0)], "Peau", "01_Corps", sides=16)
    for side, label in [(-1,"D"), (1,"G")]:
        # Membres de la base sous les vêtements, en T-pose à hauteur d'épaule.
        loft("Bras_"+label, [(side*.18,.067,.065,0), (side*.26,.068,.06,0),
            (side*.38,.056,.052,0), (side*.475,.047,.044,0),
            (side*.55,.048,.046,0), (side*.65,.037,.036,0),
            (side*.735,.027,.031,0)], "Peau", "01_Corps", axis="X", center=(0,0,SETTINGS["shoulder_z"]), sides=16)
        loft("Jambe_"+label, [(0.10,.032,.040,0), (0.40,.045,.050,0),
            (0.53,.050,.053,0), (.69,.060,.065,0), (.85,.066,.072,0),
            (.94,.070,.078,0)], "Peau", "01_Corps", center=(side*.095,0,0), sides=16)
        # Paume et cinq doigts distincts, légèrement séparés pour le futur rigging.
        ellipsoid("Paume_"+label, (side*.779,-.002,SETTINGS["shoulder_z"]), (.052,.041,.018), "Peau", "01_Corps")
        lengths = [.075,.087,.081,.066]
        for finger, (y, length) in enumerate(zip([-.029,-.010,.010,.029], lengths)):
            start = side*.810
            points = [(start,y,1.435), (start+side*length*.42,y,1.434),
                      (start+side*length*.78,y,1.432), (start+side*length,y,1.431)]
            tube(f"Doigt_{label}_{finger}", points, [.009,.009,.0078,.0055], "Peau", "01_Corps", sides=7, flatten=.83)
        tube("Pouce_"+label, [(side*.766,-.028,1.432), (side*.787,-.057,1.426),
            (side*.817,-.072,1.427), (side*.838,-.073,1.428)], [.014,.012,.010,.007], "Peau", "01_Corps", sides=8)


def build_head():
    head=loft("Tete", [(1.565,.040,.046,-.011), (1.585,.065,.063,-.003),
        (1.610,.077,.077,.002), (1.645,.082,.081,.005),
        (1.675,.080,.080,.007), (1.705,.079,.078,.009),
        (1.74,.077,.076,.012), (1.77,.068,.065,.014),
        (1.795,.050,.047,.015), (1.816,.018,.017,.015),
        (1.82,.003,.003,.015)], "Peau", "01_Corps", sides=36)
    # Orbites légèrement creusées, pommettes et arcade plus marquées.
    for vertex in head.data.vertices:
        x,y,z=vertex.co
        front=max(0,min(1,(.014-y)/.075))**2
        socket=.0045*math.exp(-((abs(x)-.033)/.020)**2-((z-1.687)/.014)**2)
        cheek=.008*math.exp(-((abs(x)-.053)/.022)**2-((z-1.658)/.018)**2)
        brow=.006*math.exp(-((abs(x)-.035)/.027)**2-((z-1.708)/.012)**2)
        vertex.co.y+=front*(socket-cheek-brow)
    loft("Nez", [(1.642,.012,.008,-.081), (1.650,.017,.015,-.089),
        (1.662,.013,.021,-.089), (1.680,.010,.015,-.083),
        (1.704,.008,.007,-.075), (1.713,.005,.004,-.072)], "Peau", "02_Visage", sides=12)
    for side, label in [(-1,"D"), (1,"G")]:
        ellipsoid("Oreille_"+label, (side*.082,.007,1.655), (.013,.018,.029), "Peau", "02_Visage", segments=12, rings=8)
        x = side*.033
        ellipsoid("Oeil_"+label, (x,-.0675,1.688), (.0145,.008,.0057), "Yeux_ivoire", "02_Visage", segments=16, rings=8)
        ellipsoid("Iris_"+label, (x,-.0761,1.688), (.0050,.0011,.0050), "Iris_noisette", "02_Visage", segments=12, rings=8)
        ellipsoid("Pupille_"+label, (x,-.0771,1.688), (.0025,.0006,.0029), "Pupille", "02_Visage", segments=10, rings=6)
        for upper in (True, False):
            points=[]
            for i in range(7):
                t=i/6
                points.append((x+(t-.5)*.030, -.0725-.0038*math.sin(math.pi*t),
                    1.688 + (1 if upper else -1)*.0048*math.sin(math.pi*t)))
            tube("Paupiere_"+label+str(upper), points, .0025, "Peau", "02_Visage", sides=5)
        tube("Sourcil_"+label, [(side*.015,-.077,1.703),(side*.027,-.080,1.707),
            (side*.044,-.077,1.712),(side*.055,-.070,1.710)],
            [.003,.0042,.0035,.0013], "Cheveux_bruns", "02_Visage", sides=6)
        tube("Relief_oreille_"+label,[(side*.088,-.007,1.672),(side*.092,-.011,1.660),
            (side*.092,-.009,1.644)],.002,"Peau","02_Visage",sides=6)
    tube("Levre_superieure", [(-.022,-.073,1.624),(-.010,-.079,1.626),(0,-.080,1.624),(.010,-.079,1.626),(.022,-.073,1.624)], .0025, "Levres", "02_Visage", sides=6)
    tube("Levre_inferieure", [(-.020,-.073,1.621),(0,-.079,1.618),(.020,-.073,1.621)], [.0017,.003,.0017], "Levres", "02_Visage", sides=6)


VEST_PROFILES = [(1.085,.176,.116,0), (1.15,.177,.119,0),
    (1.24,.193,.128,0), (1.32,.218,.137,0), (1.39,.226,.126,0),
    (1.445,.204,.100,0), (1.475,.142,.078,0)]


def vest_angle(z):
    return .14+.44*max(0,min(1,(z-1.30)/.175))


def torso_surface(x, z, front=True, extra=.006):
    low, high = VEST_PROFILES[0], VEST_PROFILES[-1]
    for a, b in zip(VEST_PROFILES, VEST_PROFILES[1:]):
        if a[0] <= z <= b[0]:
            low, high = a, b
            break
    t = min(1, max(0, (z-low[0])/(high[0]-low[0])))
    rx, ry = [(1-t)*low[k]+t*high[k] for k in (1,2)]
    y = ry*math.sqrt(max(.02, 1-(x/rx)**2)) + extra
    return -y if front else y


def build_clothing():
    loft("Chemise_corps", [(1.015,.17,.113,0), (1.09,.168,.113,0),
        (1.20,.181,.119,0), (1.32,.208,.129,0), (1.405,.218,.119,0),
        (1.45,.193,.090,0), (1.49,.067,.063,0)], "Lin_ecru", "03_Chemise", sides=24, wave=.025)
    for side, label in [(-1,"D"),(1,"G")]:
        sleeve=loft("Manche_retroussee_"+label, [(side*.13,.055,.061,0),(side*.19,.079,.082,0),
            (side*.23,.083,.085,0),(side*.27,.080,.080,0),(side*.31,.087,.084,0),
            (side*.34,.078,.077,0),(side*.37,.082,.081,0),(side*.40,.073,.073,0),
            (side*.43,.079,.075,0),(side*.455,.066,.065,0),(side*.48,.072,.069,0),
            (side*.505,.057,.056,0)], "Lin_ecru", "03_Chemise",
            axis="X", center=(0,0,SETTINGS["shoulder_z"]), sides=24, wave=.055)
        soften=sleeve.modifiers.new("Plis_assouplis","SMOOTH")
        soften.factor=.4
        soften.iterations=2
        loft("Revers_roule_"+label, [(side*.467,.058,.058,0),
            (side*.477,.065,.064,0), (side*.496,.064,.063,0),
            (side*.513,.056,.056,0)], "Lin_revers", "03_Chemise",
            axis="X", center=(0,0,SETTINGS["shoulder_z"]), sides=20, wave=.025)
        # Col rabattu constitué de volumes fermés fins.
        ribbon("Col_rabattu_"+label, [(side*.045,-.053,1.487),
            (side*.059,-.078,1.459), (side*.031,-.103,1.415)],
            .033,.005,"Lin_ecru","03_Chemise")
        loft("Pantalon_jambe_"+label, [(.415,.054,.065,0),(.49,.066,.070,0),
            (.57,.068,.074,0),(.67,.079,.085,0),(.78,.085,.093,0),
            (.875,.088,.100,0),(.97,.088,.104,0)],
            "Pantalon_brun", "05_Pantalon_bottes", center=(side*.095,0,0), sides=18, wave=.025)
        loft("Botte_tige_"+label, [(.10,.046,.058,.01),(.16,.047,.06,.01),
            (.23,.052,.064,.006),(.35,.061,.069,0),(.435,.064,.071,0),
            (.46,.065,.072,0)], "Cuir_bottes", "05_Pantalon_bottes",
            center=(side*.095,0,0), sides=18)
        loft("Botte_pied_"+label, [(.025,.058,.135,-.042),(.05,.060,.139,-.041),
            (.084,.058,.135,-.039),(.115,.053,.118,-.03),
            (.15,.047,.077,.004),(.19,.045,.06,.013)],
            "Cuir_bottes", "05_Pantalon_bottes", center=(side*.095,0,0), sides=20)
        loft("Semelle_"+label, [(.006,.060,.140,-.042),(.027,.061,.141,-.042),
            (.038,.059,.138,-.042)], "Cuir_sangles", "05_Pantalon_bottes",
            center=(side*.095,0,0), sides=20)
        loft("Rebord_botte_"+label, [(.407,.068,.076,0),(.420,.074,.081,0),
            (.465,.073,.078,0),(.479,.064,.072,0)], "Cuir_gilet", "05_Pantalon_bottes",
            center=(side*.095,0,0), sides=18)
        tube("Couture_botte_"+label, [(side*.095,-.068,.16),
            (side*.095,-.074,.26),(side*.095,-.078,.415)], .0015,
            "Fil_cuir", "05_Pantalon_bottes", sides=5)
    loft("Pantalon_ceinture", [(.875,.065,.088,0),(.90,.115,.102,0),(.94,.16,.109,0),(.98,.171,.109,0),
        (1.06,.166,.108,0)], "Pantalon_brun", "05_Pantalon_bottes", sides=24)
    # Gilet ouvert à l'avant : une coque épaisse, et non une image plaquée.
    vertices, faces, sides = [], [], 30
    for z, rx, ry, cy in VEST_PROFILES:
        for j in range(sides+1):
            opening=vest_angle(z)
            angle = opening + (math.tau-2*opening)*j/sides
            vertices.append((math.sin(angle)*rx, -math.cos(angle)*ry+cy, z))
    for i in range(len(VEST_PROFILES)-1):
        for j in range(sides):
            a=i*(sides+1)+j
            faces.append((a,a+1,a+sides+2,a+sides+1))
    vest = mesh("Gilet_ouvert",vertices,faces,"Cuir_gilet","04_Gilet_cuir")
    solid = vest.modifiers.new("Epaisseur_cuir", "SOLIDIFY")
    solid.thickness = .004
    solid.offset = 0
    # Bordures et rivets sur les deux pans de cuir.
    for side, label in [(-1,"D"),(1,"G")]:
        points = [(side*rx*math.sin(vest_angle(z)), -ry*math.cos(vest_angle(z))-.003, z)
                  for z,rx,ry,_ in VEST_PROFILES]
        tube("Bord_gilet_"+label,points,.002,"Fil_cuir","04_Gilet_cuir",sides=5)
        for i in range(11):
            z=1.115+i*.031
            rx=next((a[1]+(b[1]-a[1])*(z-a[0])/(b[0]-a[0])
                     for a,b in zip(VEST_PROFILES,VEST_PROFILES[1:]) if a[0]<=z<=b[0]),.18)
            x=side*(rx*math.sin(vest_angle(z))+.007)
            ellipsoid("Rivet_gilet_"+label+str(i),(x,torso_surface(x,z,extra=.004),z),
                (.0032,.0018,.0032),"Laiton","04_Gilet_cuir",segments=8,rings=4)
        for i in range(12):
            z=1.105+i*.028
            x=side*(.155+.04*math.sin(i/11*math.pi))
            ellipsoid("Rivet_flanc_"+label+str(i),(x,torso_surface(x,z,extra=.005),z),
                (.0025,.0015,.0025),"Laiton","04_Gilet_cuir",segments=8,rings=4)
        # Pans de cuir sous la ceinture visibles sur la référence.
        for flap in range(2):
            x=side*(.12+flap*.055)
            endz=.83-flap*.045
            points=[(x,-.104,1.025),(x+side*.015,-.113,.96),
                    (x+side*.026,-.105,endz)]
            cloth_strip("Pan_gilet_"+label+str(flap),points,[.05,.056,.047],.005,
                "Cuir_gilet","04_Gilet_cuir",fold=.002)
    tube("Ourlet_gilet", [(math.sin(a)*.177,-math.cos(a)*.118,1.088)
        for a in [.14+(math.tau-.28)*i/32 for i in range(33)]], .002,
        "Fil_cuir","04_Gilet_cuir",sides=5)
    for z in (1.37,1.415,1.454):
        ellipsoid("Bouton_lin",(0,torso_surface(0,z,extra=-.006),z),
            (.0031,.0017,.0031),"Lin_revers","03_Chemise",segments=8,rings=4)


def build_hair():
    # Calotte fermée sur le sommet et l'arrière ; front et oreilles restent lisibles.
    vertices, faces, sides, rings = [], [], 32, 12
    for i in range(rings+1):
        for j in range(sides):
            theta=math.tau*j/sides
            max_phi=1.20+1.10*((1-math.cos(theta))/2)**.60
            phi=.025+(max_phi-.025)*i/rings
            vertices.append((.090*math.sin(phi)*math.sin(theta),
                -.090*math.sin(phi)*math.cos(theta)+.015, 1.699+.132*math.cos(phi)))
    for i in range(rings):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    cap=mesh("Calotte_cheveux",vertices,faces,"Cheveux_bruns","06_Cheveux_barbe")
    solid=cap.modifiers.new("Volume_calotte","SOLIDIFY");solid.thickness=.004
    # Mèches ondulées à section ovale, faites de véritables tubes de maillage.
    for lock in range(40):
        theta=1.05+(math.tau-2.10)*lock/39
        phase=RNG.random()*math.tau
        points,radii=[],[]
        length=.34+RNG.random()*.065
        for i in range(18):
            t=i/17
            angle=theta+.10*math.sin(t*math.tau*1.6+phase)
            radius=.047+.058*math.sin(t*math.pi*.66)
            x=math.sin(angle)*radius + .014*math.sin(t*math.tau*1.7+phase)*t
            y=-math.cos(angle)*radius+.02+.030*t*t*max(0,math.cos(theta))
            y+=.006*math.cos(t*math.tau*1.4+phase)*t
            z=1.795-length*t
            points.append((x,y,z))
            radii.append((.008+.006*math.sin(t*math.pi))*(1-.85*t**3))
        tube(f"Meche_ondulee_{lock:02d}",points,radii,
            "Meches_brunes" if lock%4==0 else "Cheveux_bruns","06_Cheveux_barbe",sides=6,flatten=.48)
    # Raie et mèches balayées en arrière, moins régulières que la première étude.
    for lock in range(14):
        rootx=-.063+.126*lock/13+.0015*math.sin(lock*1.73)
        phase=lock*.79
        points=[]
        for j in range(12):
            t=j/11; y=-.053+.137*t+.003*math.sin(phase)
            x=rootx+.015*math.sin(math.pi*t)+.004*math.sin(t*math.tau*1.2+phase)
            z=1.699+.133*math.sqrt(max(.03,1-(x/.092)**2-((y-.015)/.096)**2))
            z+=.002*math.sin(t*math.tau*1.5+phase)
            points.append((x,y,z))
        tube("Meche_sommet",points,[.0025+.004*math.sin(math.pi*j/11) for j in range(12)],
            "Meches_brunes" if lock%4==0 else "Cheveux_bruns",
            "06_Cheveux_barbe",sides=6,flatten=.55)
    tube("Meche_frontale",[(-.022,-.065,1.802),(-.040,-.079,1.786),
        (-.055,-.076,1.758),(-.061,-.061,1.733),(-.054,-.062,1.718)],
        [.004,.006,.005,.003,.0009],"Cheveux_bruns","06_Cheveux_barbe",sides=6,flatten=.5)
    # Barbe courte suivant la mâchoire, au lieu du volume long de la V1.
    profiles=[(1.561,.028,.046,-.012),(1.574,.052,.057,-.006),
        (1.590,.067,.067,-.002),(1.607,.077,.075,.001),(1.625,.079,.078,.003)]
    vertices,faces=[],[]
    sides=24
    for ring,(z,rx,ry,cy) in enumerate(profiles):
        for j in range(sides+1):
            theta=-1.66+3.32*j/sides
            lift=.026*abs(math.sin(theta)) if ring==len(profiles)-1 else 0
            vertices.append((math.sin(theta)*rx,-math.cos(theta)*ry+cy-.002,z+lift))
    for i in range(len(profiles)-1):
        for j in range(sides):
            a=i*(sides+1)+j
            faces.append((a,a+1,a+sides+2,a+sides+1))
    beard=mesh("Barbe",vertices,faces,"Cheveux_bruns","06_Cheveux_barbe")
    solid=beard.modifiers.new("Volume_barbe","SOLIDIFY");solid.thickness=.003
    for side in (-1,1):
        tube("Moustache",[(side*.002,-.087,1.639),(side*.014,-.088,1.636),
            (side*.026,-.082,1.628),(side*.032,-.072,1.622)],
            [.003,.006,.004,.0015],"Cheveux_bruns","06_Cheveux_barbe",sides=7,flatten=.7)
    for i in range(17):
        theta=-1.45+2.9*i/16
        tube("Relief_barbe",[(math.sin(theta)*.078,-math.cos(theta)*.078,1.623+.024*abs(math.sin(theta))),
            (math.sin(theta)*.068,-math.cos(theta)*.071,1.594),
            (math.sin(theta)*.044,-math.cos(theta)*.059,1.571)],
            [.0014,.0017,.0006],"Meches_brunes","06_Cheveux_barbe",sides=5,flatten=.5)


def build_accessories():
    loft("Bandeau_blanc",[(1.719,.085,.083,.011),(1.725,.087,.085,.011),
        (1.735,.085,.083,.011),(1.741,.087,.085,.012),(1.749,.083,.081,.012)],
        "Bandeau_blanc","07_Accessoires",sides=32,wave=.01)
    ellipsoid("Noeud_bandeau",(0,.098,1.735),(.018,.012,.011),"Bandeau_blanc","07_Accessoires",segments=12,rings=6)
    for side in (-1,1):
        cloth_strip("Pan_bandeau",[(side*.008,.110,1.736),(side*.035,.134,1.708),
            (side*.055,.151,1.658),(side*.061,.157,1.600+side*.016)],
            [.023,.034,.029,.019],.002,"Bandeau_blanc","07_Accessoires",fold=.003)
        for front in (True,False):
            points=[]
            for i in range(9):
                t=i/8; z=1.46-.355*t; x=side*(.134-.273*t)
                points.append((x,torso_surface(x,z,front,extra=.009+(side==1)*.004),z))
            ribbon("Sangle_croisee",points,.037,.005,"Cuir_sangles","07_Accessoires")
            if front:
                for i in range(8):
                    t=(i+.5)/8; z=1.46-.355*t; x=side*(.134-.273*t)
                    for shift in (-.011,.011):
                        xx=x+shift
                        ellipsoid("Rivet_sangle",(xx,torso_surface(xx,z,True,.014+(side==1)*.004),z),
                            (.002,.0012,.002),"Laiton","07_Accessoires",segments=8,rings=4)
        loft("Brassard",[(side*.552,.051,.049,0),(side*.572,.051,.048,0),
            (side*.642,.043,.041,0),(side*.707,.033,.035,0)],
            "Cuir_gilet","07_Accessoires",axis="X",center=(0,0,SETTINGS["shoulder_z"]),sides=16)
        for x,r in ((.560,.052),(.605,.047),(.653,.042),(.702,.035)):
            loft("Bord_brassard",[(side*(x-.005),r,r*.95,0),(side*(x+.005),r,r*.95,0)],
                "Cuir_sangles","07_Accessoires",axis="X",center=(0,0,SETTINGS["shoulder_z"]),sides=16)
        for i in range(4):
            x=side*(.574+i*.022)
            ellipsoid("Rivet_brassard",(x,-.049+i*.0025,SETTINGS["shoulder_z"]),(.0026,.0018,.0026),
                "Laiton","07_Accessoires",segments=8,rings=4)
    for side,t in ((1,.24),(-1,.62)):
        z=1.46-.355*t;x=side*(.134-.273*t)
        y=torso_surface(x,z,True,.020)
        angle=side*math.atan(.273/.355)
        rotation=Matrix.Rotation(angle,3,"Y")
        for dx,dz,dimensions in [(-.020,0,(.004,.005,.054)),(.020,0,(.004,.005,.054)),
            (0,-.025,(.044,.005,.004)),(0,.025,(.044,.005,.004)),(0,0,(.034,.003,.003))]:
            center=Vector((x,y,z))+rotation@Vector((dx,0,dz))
            obj=box("Boucle_sangle",tuple(center),dimensions,"Laiton","07_Accessoires")
            obj.rotation_euler[1]=angle
    loft("Etoffe_taille",[(1.017,.179,.120,0),(1.05,.181,.122,0),
        (1.095,.176,.119,0)],"Etoffe_rouge","07_Accessoires",sides=32,wave=.012)
    cloth_strip("Etoffe_pan_long",[(-.012,-.142,1.045),(-.041,-.152,.98),
        (-.060,-.154,.88),(-.085,-.15,.78),(-.117,-.145,.67),(-.14,-.139,.57)],
        [.053,.076,.082,.073,.061,.038],.003,"Etoffe_rouge","07_Accessoires",fold=.007)
    cloth_strip("Etoffe_pan_lateral",[(-.025,-.144,1.04),(-.102,-.143,.96),
        (-.17,-.143,.88),(-.224,-.135,.78),(-.25,-.12,.73)],
        [.038,.06,.065,.055,.028],.003,"Etoffe_rouge","07_Accessoires",fold=.006)
    for z in (1.025,1.047):
        tube("Pli_etoffe_taille",[(.185*math.sin(a),-.130*math.cos(a),z+.004*math.sin(a*3))
            for a in [math.tau*i/40 for i in range(41)]],.005,"Etoffe_rouge","07_Accessoires",sides=6)
    ellipsoid("Noeud_etoffe",(-.025,-.146,1.041),(.025,.016,.022),"Etoffe_rouge","07_Accessoires",segments=12,rings=8)
    loft("Ceinture_cuir",[(1.065,.182,.124,0),(1.101,.179,.122,0)],
        "Cuir_sangles","07_Accessoires",sides=32)
    # Boucle ajourée en laiton et ardillon, plutôt qu'un rectangle peint.
    for x in (-.027,.027):
        box("Boucle_montant",(x,-.130,1.083),(.005,.006,.043),"Laiton","07_Accessoires",.001)
    for z in (1.062,1.104):
        box("Boucle_traverse",(0,-.130,z),(.058,.006,.005),"Laiton","07_Accessoires",.001)
    box("Ardillon",(0,-.135,1.083),(.044,.003,.003),"Laiton","07_Accessoires",.0008)


def build_sword():
    sx,sy=.43,-.24
    blade=loft("Lame_droite",[(.055,.0008,.0008,0),(.13,.018,.003,0),
        (.70,.024,.0035,0),(.845,.027,.0035,0)],"Acier","08_Epee",sides=4,center=(sx,sy,0))
    blade.data.materials.append(MATERIALS["Acier_tranchant"])
    for polygon in blade.data.polygons:
        polygon.use_smooth=False
        polygon.material_index=polygon.index%2
    box("Garde_droite",(sx,sy,.857),(.17,.013,.017),"Acier","08_Epee",bevel=.002)
    loft("Poignee",[(.868,.014,.012,0),(1.01,.013,.011,0)],"Cuir_sangles","08_Epee",sides=12,center=(sx,sy,0))
    points=[]
    for i in range(49):
        t=i/48; a=t*math.tau*6
        points.append((sx+.014*math.sin(a),sy+.013*math.cos(a),.878+.122*t))
    tube("Enroulement_poignee",points,.0018,"Fil_cuir","08_Epee",sides=5)
    ellipsoid("Pommeau",(sx,sy,1.035),(.024,.019,.025),"Acier","08_Epee",segments=12,rings=8)


def orient_toward(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def build_studio():
    scene=bpy.context.scene
    material("Fond_studio",(.12,.14,.16),.95)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,0))
    floor=bpy.context.object;floor.name="Sol_studio_non_exporte"
    floor.data.materials.append(MATERIALS["Fond_studio"])
    move_to(floor,"90_Studio")
    world=bpy.data.worlds.new("Studio_neutre")
    if world.node_tree is None:
        world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.18,.20,.24,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=.40
    scene.world=world
    for name,position,power,size in [
        ("Principale",(2.2,-3,3.2),260,2.5),
        ("Remplissage",(-2,-1.8,2.4),125,2.5),
        ("Contour",(.6,2.5,2.7),280,2.0),
        ("Dos_doux",(-1,3,1.5),100,2.0),
    ]:
        light=bpy.data.lights.new(name,"AREA")
        light.energy=power;light.shape="DISK";light.size=size
        obj=bpy.data.objects.new(name,light)
        COLLECTIONS["90_Studio"].objects.link(obj)
        obj.location=position;orient_toward(obj,(0,0,1.0))
    cameras={}
    for view,position in [("front",(0,-6,.96)),("side",(6,0,.96)),("back",(0,6,.96))]:
        data=bpy.data.cameras.new("Camera_"+view)
        obj=bpy.data.objects.new("Camera_"+view,data)
        COLLECTIONS["90_Studio"].objects.link(obj)
        obj.location=position;orient_toward(obj,(0,0,.96))
        data.type="ORTHO";data.ortho_scale=2.16;data.lens=60
        cameras[view]=obj
    scene.camera=cameras["front"]
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=SETTINGS["samples"]
    scene.cycles.use_denoising=True
    scene.render.resolution_x=SETTINGS["preview_size"]
    scene.render.resolution_y=SETTINGS["preview_size"]
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    scene.view_settings.exposure=-.7
    return cameras


def join_objects(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        for modifier in list(obj.modifiers):
            assert bpy.ops.object.modifier_apply(modifier=modifier.name)=={"FINISHED"}
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:
        assert bpy.ops.object.join()=={"FINISHED"}
    result=bpy.context.object
    result.name=name
    return result


def correct_normals(obj):
    data=bmesh.new()
    data.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(data,faces=list(data.faces))
    data.to_mesh(obj.data)
    data.free()
    obj.data.update()


def inspect_glb():
    raw=GLB_PATH.read_bytes()
    magic,version,length=struct.unpack_from("<4sII",raw,0)
    assert magic==b"glTF" and version==2 and length==len(raw)
    json_length,kind=struct.unpack_from("<I4s",raw,12)
    assert kind==b"JSON"
    doc=json.loads(raw[20:20+json_length])
    assert not doc.get("animations") and not doc.get("skins")
    assert len(doc["meshes"])==2, "Un maillage humanoïde et une épée indépendante sont attendus."
    assert any(node.get("name")=="Epee_Acier" and "mesh" in node for node in doc["nodes"])
    triangles=vertices=primitives=0
    for exported in doc["meshes"]:
        for primitive in exported["primitives"]:
            assert primitive.get("mode",4)==4
            assert "POSITION" in primitive["attributes"] and "NORMAL" in primitive["attributes"]
            count=doc["accessors"][primitive["indices"]]["count"]
            assert count%3==0
            triangles+=count//3
            vertices+=doc["accessors"][primitive["attributes"]["POSITION"]]["count"]
            primitives+=1
    assert 2000<triangles<=SETTINGS["triangle_budget"], f"Budget dépassé : {triangles} triangles"
    bin_header=20+json_length
    bin_length,kind=struct.unpack_from("<I4s",raw,bin_header)
    assert kind==b"BIN\0" and bin_header+8+bin_length==len(raw)
    for view in doc.get("bufferViews",[]):
        assert view.get("byteOffset",0)+view["byteLength"]<=bin_length
    assert len(doc.get("images",[]))>=6, "Les textures PBR doivent être incluses."
    assert all("bufferView" in item and "uri" not in item for item in doc["images"])
    return {"triangles":triangles,"vertices_gltf":vertices,"mesh_count":len(doc["meshes"]),
        "material_count":len(doc.get("materials",[])),"primitive_count":primitives,
        "glb_bytes":len(raw),"has_animations":False,"has_armature":False,
        "embedded_images":len(doc["images"]),"texture_resolution":SETTINGS["texture_size"],
        "reference":"illustration du guerrier fournie dans la conversation",
        "note":"V2 procédurale guidée par la référence, à examiner ; performances Quest 3 non mesurées."}


def verify_glb_import():
    source_scene=bpy.context.scene
    previous_meshes=set(bpy.data.meshes)
    previous_materials=set(bpy.data.materials)
    previous_images=set(bpy.data.images)
    check=bpy.data.scenes.new("Controle_import_GLB")
    bpy.context.window.scene=check
    assert bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))=={"FINISHED"}
    imported=list(check.objects)
    meshes=[obj for obj in imported if obj.type=="MESH"]
    assert len(meshes)==2
    assert any(obj.name.startswith("Epee_Acier") for obj in meshes)
    corners=[obj.matrix_world@Vector(corner) for obj in meshes for corner in obj.bound_box]
    height=max(p.z for p in corners)-min(p.z for p in corners)
    assert 1.75<height<1.9, f"Échelle incorrecte après import : {height} m"
    assert not any(obj.type=="ARMATURE" for obj in imported)
    bpy.context.window.scene=source_scene
    for obj in imported:
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(check)
    for data in list(bpy.data.meshes):
        if data not in previous_meshes and data.users==0:
            bpy.data.meshes.remove(data)
    for data in list(bpy.data.materials):
        if data not in previous_materials and data.users==0:
            bpy.data.materials.remove(data)
    for data in list(bpy.data.images):
        if data not in previous_images and data.users==0:
            bpy.data.images.remove(data)
    return height


def finish_and_export():
    scene=bpy.context.scene
    # Normales cohérentes, y compris les membres construits du côté négatif de X.
    for obj in list(scene.objects):
        if obj.type=="MESH":
            correct_normals(obj)
            assign_uvs(obj)
    sword=join_objects(list(COLLECTIONS["08_Epee"].objects),"Epee_Acier")
    scene.cursor.location=(.43,-.24,.86)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    scene.cursor.location=(0,0,0)
    sword["usage"]="Épée indépendante ; origine au niveau de la garde pour une future prise en main."
    root=bpy.data.objects.new("Guerrier_TPose",None)
    COLLECTIONS["01_Corps"].objects.link(root)
    root["version"]="V2 — étude guidée par la référence, sans rig ni animation"
    root["reference"]="Illustration fournie dans la conversation : guerrier corse, cuir brun et étoffe rouge"
    original=[]
    for name,group in COLLECTIONS.items():
        if name not in ("08_Epee","90_Studio"):
            for obj in list(group.objects):
                if obj.type=="MESH":
                    obj.parent=root
                    original.append(obj)
    bpy.context.view_layer.update()
    # Fusion uniquement pour l'export : la scène Blender garde les pièces éditables.
    export_collection=collection("99_Export_temporaire")
    depsgraph=bpy.context.evaluated_depsgraph_get()
    copies=[]
    for obj in original:
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),depsgraph=depsgraph)
        duplicate=bpy.data.objects.new("Export_"+obj.name,data)
        export_collection.objects.link(duplicate)
        duplicate.matrix_world=obj.matrix_world.copy()
        copies.append(duplicate)
    character=join_objects(copies,"Guerrier_Corps")
    bpy.ops.object.select_all(action="DESELECT")
    character.select_set(True);sword.select_set(True)
    bpy.context.view_layer.objects.active=character
    print("EXPORT_GLB",flush=True)
    assert bpy.ops.export_scene.gltf(filepath=str(GLB_PATH),export_format="GLB",
        use_selection=True,export_apply=True,export_animations=False,
        export_cameras=False,export_lights=False)=={"FINISHED"}
    report=inspect_glb()
    bpy.data.objects.remove(character,do_unlink=True)
    bpy.data.collections.remove(export_collection)
    del COLLECTIONS["99_Export_temporaire"]
    report["roundtrip_height_m"]=verify_glb_import()
    report["roundtrip_import_ok"]=True
    print("GLB_VALIDE "+json.dumps(report,ensure_ascii=False),flush=True)
    cameras=build_studio()
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active=root
    scene.render.filepath=str(PREVIEWS/"guerrier_front.png")
    # La vue caméra de face s'affiche dès l'ouverture du .blend.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA"
                area.spaces.active.shading.color_type="MATERIAL"
    assert bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))=={"FINISHED"}
    for view,camera in cameras.items():
        scene.camera=camera
        scene.render.filepath=str(PREVIEWS/f"guerrier_{view}.png")
        print("RENDU_"+view.upper(),flush=True)
        assert bpy.ops.render.render(write_still=True)=={"FINISHED"}
    REPORT_PATH.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    paths=[BLEND_PATH,GLB_PATH]+[PREVIEWS/f"guerrier_{view}.png" for view in cameras]
    for path in paths:
        assert path.is_file() and path.stat().st_size>0
        print(f"FICHIER_VALIDE {path} ({path.stat().st_size} octets)",flush=True)
    print("EREDITA_GUERRIER_OK",flush=True)


def main():
    for folder in (BLEND_PATH.parent, GLB_PATH.parent, PREVIEWS, REPORT_PATH.parent):
        folder.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    for name in ("01_Corps", "02_Visage", "03_Chemise", "04_Gilet_cuir", "05_Pantalon_bottes", "06_Cheveux_barbe", "07_Accessoires", "08_Epee", "90_Studio"):
        collection(name)
    for stage in (build_materials,build_pbr_textures,build_body,build_head,build_clothing,build_hair,build_accessories,build_sword):
        print("ETAPE "+stage.__name__,flush=True)
        stage()
    finish_and_export()


if __name__ == "__main__":
    main()
