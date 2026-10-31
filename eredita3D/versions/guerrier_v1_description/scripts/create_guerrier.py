"""Guerrier corse : première étude volumétrique, en T-pose, sans animation.

Blender 5.1.1, aucune dépendance externe. Exécution :
  Blender --background --factory-startup --python-exit-code 1 --python ce_script.py

Repère de travail : mètres, Z vertical, personnage tourné vers -Y.
Les proportions et détails sont regroupés ici pour les itérations suivantes.
Cette V1 procédurale conserve des éléments séparés et n'est pas encore riggée.
"""

from pathlib import Path
import json
import math
import random
import struct

import bpy
import bmesh
from mathutils import Vector


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
    material("Lin_ecru", (0.79, 0.735, 0.60), 0.95)
    material("Lin_revers", (0.64, 0.59, 0.47), 0.96)
    material("Bandeau_blanc", (0.91, 0.89, 0.81), 0.95)
    material("Cuir_gilet", (0.15, 0.064, 0.026), 0.68)
    material("Cuir_sangles", (0.085, 0.035, 0.015), 0.62)
    material("Cuir_bottes", (0.075, 0.033, 0.018), 0.68)
    material("Pantalon_brun", (0.19, 0.115, 0.056), 0.95)
    material("Etoffe_rouge", (0.35, 0.025, 0.018), 0.93)
    material("Cheveux_bruns", (0.045, 0.017, 0.007), 0.82)
    material("Meches_brunes", (0.075, 0.031, 0.012), 0.85)
    material("Yeux_ivoire", (0.7, 0.66, 0.56), 0.35)
    material("Iris_noisette", (0.10, 0.055, 0.02), 0.38)
    material("Pupille", (0.006, 0.004, 0.003), 0.3)
    material("Acier", (0.53, 0.59, 0.64), 0.3, 0.88)
    material("Acier_tranchant", (0.72, 0.77, 0.8), 0.24, 0.92)
    material("Laiton", (0.4, 0.24, 0.075), 0.45, 0.72)
    material("Fil_cuir", (0.29, 0.17, 0.072), 0.85)


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
    loft("Tete", [(1.565,.039,.044,-.012), (1.585,.061,.059,-.003),
        (1.610,.075,.073,.002), (1.645,.082,.081,.005),
        (1.675,.080,.080,.007), (1.705,.079,.078,.009),
        (1.74,.077,.076,.012), (1.77,.068,.065,.014),
        (1.795,.050,.047,.015), (1.816,.018,.017,.015),
        (1.82,.003,.003,.015)], "Peau", "01_Corps", sides=28)
    loft("Nez", [(1.642,.012,.008,-.081), (1.650,.018,.017,-.090),
        (1.662,.014,.024,-.089), (1.680,.010,.015,-.083),
        (1.704,.008,.007,-.075), (1.713,.005,.004,-.072)], "Peau", "02_Visage", sides=12)
    for side, label in [(-1,"D"), (1,"G")]:
        ellipsoid("Oreille_"+label, (side*.082,.007,1.655), (.013,.018,.029), "Peau", "02_Visage", segments=12, rings=8)
        x = side*.033
        ellipsoid("Oeil_"+label, (x,-.0675,1.688), (.017,.011,.008), "Yeux_ivoire", "02_Visage", segments=16, rings=8)
        ellipsoid("Iris_"+label, (x,-.0782,1.688), (.0052,.0015,.0052), "Iris_noisette", "02_Visage", segments=12, rings=8)
        ellipsoid("Pupille_"+label, (x,-.0796,1.688), (.0026,.0007,.0031), "Pupille", "02_Visage", segments=10, rings=6)
        for upper in (True, False):
            points=[]
            for i in range(7):
                t=i/6
                points.append((x+(t-.5)*.034, -.0735-.004*math.sin(math.pi*t),
                    1.688 + (1 if upper else -1)*.0065*math.sin(math.pi*t)))
            tube("Paupiere_"+label+str(upper), points, .0025, "Peau", "02_Visage", sides=5)
        tube("Sourcil_"+label, [(x-.018,-.072,1.703), (x-.009,-.078,1.707),
            (x+.005,-.078,1.707), (x+.018,-.070,1.701)], [.002,.004,.0035,.001], "Cheveux_bruns", "02_Visage", sides=6)
    tube("Levre_superieure", [(-.022,-.073,1.624),(-.010,-.079,1.626),(0,-.080,1.624),(.010,-.079,1.626),(.022,-.073,1.624)], .0025, "Levres", "02_Visage", sides=6)
    tube("Levre_inferieure", [(-.020,-.073,1.621),(0,-.079,1.618),(.020,-.073,1.621)], [.0017,.003,.0017], "Levres", "02_Visage", sides=6)


VEST_PROFILES = [(1.085,.176,.116,0), (1.15,.177,.119,0),
    (1.24,.193,.128,0), (1.32,.218,.137,0), (1.39,.226,.126,0),
    (1.445,.204,.100,0), (1.475,.142,.078,0)]


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
        loft("Manche_retroussee_"+label, [(side*.13,.053,.059,0),(side*.19,.073,.077,0),
            (side*.25,.076,.078,0), (side*.33,.074,.073,0),
            (side*.40,.066,.066,0), (side*.46,.061,.060,0),
            (side*.505,.055,.054,0)], "Lin_ecru", "03_Chemise",
            axis="X", center=(0,0,SETTINGS["shoulder_z"]), sides=20, wave=.045)
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
        loft("Rebord_botte_"+label, [(.427,.066,.073,0),(.440,.071,.077,0),
            (.464,.069,.075,0),(.472,.064,.071,0)], "Cuir_gilet", "05_Pantalon_bottes",
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
            angle = .14 + (math.tau-.28)*j/sides
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
        points = [(side*rx*math.sin(.14), -ry*math.cos(.14)-.003, z)
                  for z,rx,ry,_ in VEST_PROFILES]
        tube("Bord_gilet_"+label,points,.002,"Fil_cuir","04_Gilet_cuir",sides=5)
        for i in range(9):
            z=1.115+i*.035
            x=side*.036
            ellipsoid("Rivet_gilet_"+label+str(i),(x,torso_surface(x,z,extra=.004),z),
                (.0032,.0018,.0032),"Laiton","04_Gilet_cuir",segments=8,rings=4)
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
            vertices.append((.086*math.sin(phi)*math.sin(theta),
                -.086*math.sin(phi)*math.cos(theta)+.015, 1.699+.126*math.cos(phi)))
    for i in range(rings):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    cap=mesh("Calotte_cheveux",vertices,faces,"Cheveux_bruns","06_Cheveux_barbe")
    solid=cap.modifiers.new("Volume_calotte","SOLIDIFY");solid.thickness=.004
    # Mèches ondulées à section ovale, faites de véritables tubes de maillage.
    for lock in range(38):
        theta=.65+(math.tau-1.30)*lock/37
        phase=RNG.random()*math.tau
        points,radii=[],[]
        length=.34+RNG.random()*.065
        for i in range(16):
            t=i/15
            angle=theta+.065*math.sin(t*math.tau*1.8+phase)
            radius=.047+.058*math.sin(t*math.pi*.66)
            x=math.sin(angle)*radius + .011*math.sin(t*math.tau*1.6+phase)*t
            y=-math.cos(angle)*radius+.02+.024*t*max(0,math.cos(theta))
            z=1.795-length*t
            points.append((x,y,z))
            radii.append((.008+.005*math.sin(t*math.pi))*(1-.91*t**3))
        tube(f"Meche_ondulee_{lock:02d}",points,radii,
            "Meches_brunes" if lock%4==0 else "Cheveux_bruns","06_Cheveux_barbe",sides=7,flatten=.62)
    # Quelques mèches peignées sur le dessus, vers l'arrière.
    for side in (-1,1):
        for i in range(5):
            x=side*(.015+i*.011)
            points=[]
            for j in range(10):
                t=j/9; y=-.055+.134*t
                z=1.699+.128*math.sqrt(max(.03,1-(x/.089)**2-((y-.015)/.092)**2))
                points.append((x+.002*math.sin(t*math.tau),y,z))
            tube("Meche_sommet",points,[.0018+.003*math.sin(math.pi*j/9) for j in range(10)],
                "Meches_brunes" if i%3==0 else "Cheveux_bruns",
                "06_Cheveux_barbe",sides=6,flatten=.65)
    # Barbe sculptée autour du menton, avec une ouverture laissant lire les lèvres.
    profiles=[(1.548,.025,.034,-.016),(1.562,.048,.047,-.01),
        (1.583,.065,.061,-.004),(1.605,.076,.071,0),(1.632,.078,.074,.002)]
    vertices,faces=[],[]
    sides=24
    for ring,(z,rx,ry,cy) in enumerate(profiles):
        for j in range(sides+1):
            theta=-1.66+3.32*j/sides
            lift=.021*abs(math.sin(theta)) if ring==len(profiles)-1 else 0
            vertices.append((math.sin(theta)*rx,-math.cos(theta)*ry+cy-.004,z+lift))
    for i in range(len(profiles)-1):
        for j in range(sides):
            a=i*(sides+1)+j
            faces.append((a,a+1,a+sides+2,a+sides+1))
    beard=mesh("Barbe",vertices,faces,"Cheveux_bruns","06_Cheveux_barbe")
    solid=beard.modifiers.new("Volume_barbe","SOLIDIFY");solid.thickness=.005
    for side in (-1,1):
        tube("Moustache",[(side*.002,-.087,1.639),(side*.014,-.088,1.636),
            (side*.026,-.082,1.628),(side*.032,-.072,1.622)],
            [.003,.006,.004,.0015],"Cheveux_bruns","06_Cheveux_barbe",sides=7,flatten=.7)
    for i in range(13):
        theta=-1.4+2.8*i/12
        tube("Relief_barbe",[(math.sin(theta)*.075,-math.cos(theta)*.078,1.627+.014*abs(math.sin(theta))),
            (math.sin(theta)*.064,-math.cos(theta)*.069,1.594),
            (math.sin(theta)*.041,-math.cos(theta)*.055,1.565)],
            [.0025,.003,.0008],"Meches_brunes","06_Cheveux_barbe",sides=5,flatten=.55)


def build_accessories():
    loft("Bandeau_blanc",[(1.723,.085,.083,.011),(1.733,.086,.084,.011),
        (1.745,.084,.082,.012)],"Bandeau_blanc","07_Accessoires",sides=32,wave=.006)
    ellipsoid("Noeud_bandeau",(0,.098,1.735),(.018,.012,.011),"Bandeau_blanc","07_Accessoires",segments=12,rings=6)
    for side in (-1,1):
        ribbon("Pan_bandeau",[(side*.008,.100,1.736),(side*.016,.112,1.705),
            (side*.020,.121,1.668)],.014,.003,"Bandeau_blanc","07_Accessoires")
        for front in (True,False):
            points=[]
            for i in range(9):
                t=i/8; z=1.46-.355*t; x=side*(.134-.273*t)
                points.append((x,torso_surface(x,z,front,extra=.009+(side==1)*.004),z))
            ribbon("Sangle_croisee",points,.034,.005,"Cuir_sangles","07_Accessoires")
        loft("Brassard",[(side*.552,.051,.049,0),(side*.572,.051,.048,0),
            (side*.642,.043,.041,0),(side*.665,.039,.039,0)],
            "Cuir_gilet","07_Accessoires",axis="X",center=(0,0,SETTINGS["shoulder_z"]),sides=16)
        for x,r in ((.560,.052),(.654,.042)):
            loft("Bord_brassard",[(side*(x-.005),r,r*.95,0),(side*(x+.005),r,r*.95,0)],
                "Cuir_sangles","07_Accessoires",axis="X",center=(0,0,SETTINGS["shoulder_z"]),sides=16)
        for i in range(4):
            x=side*(.574+i*.022)
            ellipsoid("Rivet_brassard",(x,-.049+i*.0025,SETTINGS["shoulder_z"]),(.0026,.0018,.0026),
                "Laiton","07_Accessoires",segments=8,rings=4)
    loft("Etoffe_taille",[(1.017,.179,.120,0),(1.05,.181,.122,0),
        (1.095,.176,.119,0)],"Etoffe_rouge","07_Accessoires",sides=32,wave=.012)
    ribbon("Etoffe_pan_long",[(.123,-.092,1.06),(.167,-.108,.965),
        (.178,-.109,.87),(.158,-.103,.78)],.061,.004,"Etoffe_rouge","07_Accessoires")
    ribbon("Etoffe_pan_court",[(.137,-.096,1.055),(.194,-.094,.98),
        (.208,-.085,.894)],.040,.004,"Etoffe_rouge","07_Accessoires")
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
    blade=loft("Lame_droite",[(.055,.0008,.0008,0),(.13,.012,.003,0),
        (.70,.018,.0035,0),(.845,.019,.0035,0)],"Acier","08_Epee",sides=4,center=(sx,sy,0))
    blade.data.materials.append(MATERIALS["Acier_tranchant"])
    for polygon in blade.data.polygons:
        polygon.use_smooth=False
        polygon.material_index=polygon.index%2
    tube("Garde",[(sx-.082,sy,.833),(sx-.05,sy,.850),(sx,sy,.860),
        (sx+.05,sy,.850),(sx+.082,sy,.833)],.008,"Laiton","08_Epee",sides=8)
    loft("Poignee",[(.868,.014,.012,0),(1.01,.013,.011,0)],"Cuir_sangles","08_Epee",sides=12,center=(sx,sy,0))
    points=[]
    for i in range(49):
        t=i/48; a=t*math.tau*6
        points.append((sx+.014*math.sin(a),sy+.013*math.cos(a),.878+.122*t))
    tube("Enroulement_poignee",points,.0018,"Fil_cuir","08_Epee",sides=5)
    ellipsoid("Pommeau",(sx,sy,1.035),(.021,.016,.026),"Laiton","08_Epee",segments=12,rings=8)


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
    return {"triangles":triangles,"vertices_gltf":vertices,"mesh_count":len(doc["meshes"]),
        "material_count":len(doc.get("materials",[])),"primitive_count":primitives,
        "glb_bytes":len(raw),"has_animations":False,"has_armature":False,
        "reference":"description utilisateur ; image de référence en attente",
        "note":"V1 procédurale à examiner ; performances sur Quest 3 non mesurées."}


def verify_glb_import():
    source_scene=bpy.context.scene
    previous_meshes=set(bpy.data.meshes)
    previous_materials=set(bpy.data.materials)
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
    return height


def finish_and_export():
    scene=bpy.context.scene
    # Normales cohérentes, y compris les membres construits du côté négatif de X.
    for obj in list(scene.objects):
        if obj.type=="MESH":
            correct_normals(obj)
    sword=join_objects(list(COLLECTIONS["08_Epee"].objects),"Epee_Acier")
    scene.cursor.location=(.43,-.24,.86)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    scene.cursor.location=(0,0,0)
    sword["usage"]="Épée indépendante ; origine au niveau de la garde pour une future prise en main."
    root=bpy.data.objects.new("Guerrier_TPose",None)
    COLLECTIONS["01_Corps"].objects.link(root)
    root["version"]="V1 — étude de silhouette et vêtements, sans rig ni animation"
    root["reference"]="Description utilisateur ; image attendue dans la discussion"
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
    for stage in (build_materials,build_body,build_head,build_clothing,build_hair,build_accessories,build_sword):
        print("ETAPE "+stage.__name__,flush=True)
        stage()
    finish_and_export()


if __name__ == "__main__":
    main()
