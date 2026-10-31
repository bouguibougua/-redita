"""Paysan corse — V1 complète en T-pose guidée par l'illustration fournie.

Blender 5.1.1 : --background --factory-startup --python-exit-code 1 --python ce_script.py
Travaille exclusivement dans eredita3D. La bibliothèque géométrique du guerrier
est importée en lecture seule ; son générateur et ses exports ne sont pas exécutés.
Les accessoires restent séparés, aucune armature ni animation n'est créée.
"""
from pathlib import Path
import importlib.util
import json
import math
import random
import struct

import bpy
import numpy as np
from mathutils import Matrix, Vector


ROOT=Path(__file__).resolve().parents[1]
BLEND=ROOT/'models/paysan.blend'
GLB=ROOT/'exports/paysan.glb'
PREVIEWS=ROOT/'previews'
REPORT=ROOT/'logs/paysan-validation.json'
PARAMS={
    'height_m':1.75, 'triangle_budget':42000, 'texture_size':512,
    'preview_size':1200, 'samples':48, 'seed':1536,
}
ACCESSORIES=['Chapeau_Paille','Fourche_4_Dents','Panier_Osier','Foin_Panier',
    'Gourde_Ceinture','Sacoche_Cuir','Cordes_Ceinture','Serpette_Ceinture','Piquet_Bois']
RNG=random.Random(PARAMS['seed'])
PARTS={}

spec=importlib.util.spec_from_file_location('eredita_geometry',Path(__file__).with_name('create_guerrier.py'))
G=importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)
G.RNG=random.Random(PARAMS['seed'])
G.SETTINGS['texture_size']=PARAMS['texture_size']


def stage(message):
    print('PAYSAN_ETAPE '+message,flush=True)


def start_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system='METRIC'
    for folder in (BLEND.parent,GLB.parent,PREVIEWS,REPORT.parent,ROOT/'textures/paysan'):
        folder.mkdir(parents=True,exist_ok=True)
    for name in ('01_Corps','02_Visage','03_Chemise','04_Gilet_cuir','05_Pantalon_bottes',
                 '06_Cheveux_barbe','07_Accessoires','08_Chapeau','09_Panier','10_Fourche','90_Studio'):
        G.collection(name)
    G.build_materials()
    for name,color,roughness,metallic in [
        ('Paille',(0.43,.235,.075),.94,0),('Paille_claire',(.65,.395,.15),.95,0),
        ('Osier',(.25,.112,.035),.91,0),('Osier_clair',(.42,.22,.07),.9,0),
        ('Foin',(.49,.32,.075),.97,0),('Foin_clair',(.68,.48,.17),.98,0),
        ('Bandes_beige',(.57,.485,.35),.96,0),('Bois_manche',(.22,.10,.031),.85,0),
        ('Metal_patine',(.25,.28,.27),.56,.68),('Corde_chanvre',(.36,.235,.115),.97,0),
        ('Cuir_gourde',(.24,.095,.03),.8,0)]:
        G.material(name,color,roughness,metallic)


def collect_new(name, build):
    before=set(bpy.context.scene.objects)
    build()
    PARTS[name]=[obj for obj in bpy.context.scene.objects if obj not in before and obj.type=='MESH']


def ring(name,rx,ry,z,cy,mat,group,radius=.004,segments=36,sides=4,warp=0,phase=0):
    points=[]
    for i in range(segments+1):
        a=math.tau*i/segments
        r=warp*math.sin(a*12+phase)
        points.append(((rx+r)*math.sin(a),cy-(ry+r)*math.cos(a),z))
    return G.tube(name,points,radius,mat,group,sides=sides)


def build_person():
    G.build_body();G.build_head();G.build_clothing();G.build_hair()
    # Les éléments militaires ne font pas partie de la tenue du paysan.
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(('Pan_gilet','Rivet_flanc','Rebord_botte','Meche_sommet','Calotte_cheveux')):
            bpy.data.objects.remove(obj,do_unlink=True)
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('Meche_ondulee'):
            decimate=obj.modifiers.new('LOD_meche','DECIMATE');decimate.ratio=.65
        if obj.name.startswith('Pantalon_jambe'):
            # Plus d'ampleur aux cuisses et aux genoux, avec resserrement sous les bandes.
            side=-1 if obj.name.endswith('_D') else 1
            center=side*.095
            for v in obj.data.vertices:
                z=v.co.z
                fullness=1+.24*math.exp(-((z-.68)/.20)**2)
                v.co.x=center+(v.co.x-center)*fullness
                v.co.y*=fullness
                v.co.x+=side*.009
            sub=obj.modifiers.new('Volume_plis_pantalon','SUBSURF');sub.levels=1;sub.render_levels=1
        if obj.name=='Barbe':
            for v in obj.data.vertices:
                v.co.z-=.004*max(0,min(1,(1.61-v.co.z)/.05))
    G.cloth_strip('Pan_chemise',[(.02,-.120,1.04),(.033,-.124,.96),(.04,-.124,.86)],
        [.065,.073,.060],.003,'Lin_ecru','03_Chemise',fold=.003)
    for side in (-1,1):
        build_calf_wrap(side)


def build_calf_wrap(side):
    vertices,faces=[],[]
    steps=96
    for i in range(steps+1):
        a=math.tau*4*i/steps
        z=.394+.092*i/steps
        for radial,height in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            rx=.073+radial*.0015;ry=.081+radial*.0015
            vertices.append((side*.095+rx*math.sin(a),-ry*math.cos(a),
                z+height*.013+.0015*math.sin(a*3)))
    for i in range(steps):
        for j in range(4):
            a=i*4+j;b=i*4+(j+1)%4
            faces.append((a,b,b+4,a+4))
    faces.extend(((3,2,1,0),tuple(steps*4+j for j in range(4))))
    G.mesh('Bandes_mollet_'+str(side),vertices,faces,'Bandes_beige','05_Pantalon_bottes')


def brim_point(r,a):
    notch=.040*math.exp(-((a-1.02)/.12)**2)+.028*math.exp(-((a-3.65)/.10)**2)
    radius=r-notch*max(0,(r-.24)/.09)
    z=1.776+.015*(r/.33)**2+.024*math.sin(a)*(r/.33)**1.7
    z+=.009*math.sin(a*3+.4)*(r/.33)**1.5
    return (radius*math.sin(a),-.88*radius*math.cos(a)+.013,z)


def build_hat():
    vertices,faces=[],[]
    sides=64;rings=6
    for i in range(rings):
        r=.105+(.33-.105)*i/(rings-1)
        for j in range(sides):vertices.append(brim_point(r,math.tau*j/sides))
    for i in range(rings-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    brim=G.mesh('Chapeau_bord_souple',vertices,faces,'Paille','08_Chapeau')
    solid=brim.modifiers.new('Epaisseur_paille','SOLIDIFY');solid.thickness=.0045
    G.loft('Chapeau_calotte',[(1.773,.115,.104,.013),(1.82,.110,.100,.013),
        (1.875,.097,.088,.013),(1.910,.068,.060,.013),(1.927,.018,.016,.013)],
        'Paille','08_Chapeau',sides=28,wave=.012)
    # Tresses visibles et courbure du bord : de vrais cordons de maillage.
    for i in range(9):
        r=.113+.216*i/8
        points=[]
        for j in range(49):
            a=math.tau*j/48
            x,y,z=brim_point(r,a)
            points.append((x,y,z+.003+.001*math.sin(a*24+i*math.pi)))
        G.tube('Tresse_chapeau',points,.0027,'Paille_claire' if i%3==0 else 'Paille','08_Chapeau',sides=4)
    for i in range(20):
        a=math.tau*i/20
        G.tube('Liage_radial_chapeau',[(x,y,z+.004) for x,y,z in
            [brim_point(.112+.216*j/7,a+.006*math.sin(j)) for j in range(8)]],
            .0018,'Paille_claire','08_Chapeau',sides=3)
    for i in range(7):
        t=i/6;z=1.79+.125*t
        rx=.112*(1-t)+.065*t;ry=.102*(1-t)+.057*t
        ring('Tresse_calotte',rx,ry,z,.013,'Paille_claire' if i%3==0 else 'Paille',
            '08_Chapeau',.0027,32,4,warp=.0008,phase=i*math.pi)
    for i in range(22):
        a=RNG.random()*math.tau
        x,y,z=brim_point(.33,a)
        distance=RNG.uniform(.012,.029)
        G.tube('Paille_effilochee',[(x,y,z),(x+distance*.65*math.sin(a),y-distance*.65*math.cos(a),z+.004),
            (x+distance*math.sin(a),y-distance*math.cos(a),z+RNG.uniform(-.012,.014))],
            [.0016,.001,.0004],'Paille_claire','08_Chapeau',sides=3)
    ring('Lien_chapeau',.116,.105,1.790,.013,'Corde_chanvre','08_Chapeau',.004,32,5)


def build_harness():
    points=[]
    for i in range(10):
        t=i/9;x=.135-.275*t;z=1.46-.35*t
        points.append((x,G.torso_surface(x,z,True,.012),z))
    G.ribbon('Sangle_diagonale',points,.039,.005,'Cuir_sangles','07_Accessoires')
    for side in (-1,1):
        G.ribbon('Bretelle_panier',[(side*.14,.080,1.46),(side*.12,.16,1.42),
            (side*.13,.31,1.34),(side*.15,.30,1.16),(side*.14,.112,1.10)],
            .026,.004,'Cuir_sangles','07_Accessoires')
    for z in (1.054,1.090):
        G.loft('Ceinture_cuir',[(z-.013,.182,.124,0),(z+.013,.181,.123,0)],
            'Cuir_sangles','07_Accessoires',sides=28)
        buckle((-.02,-.132,z),.049,.031)
    for t in (.25,.74):
        z=1.46-.35*t;x=.135-.275*t
        buckle((x,G.torso_surface(x,z,True,.022),z),.042,.047,math.atan(.275/.35))
    G.loft('Etoffe_taille',[(1.01,.183,.124,0),(1.042,.185,.127,0),(1.075,.179,.124,0)],
        'Etoffe_rouge','07_Accessoires',sides=28,wave=.015)
    G.ellipsoid('Noeud_etoffe',(-.06,-.141,1.035),(.027,.016,.023),'Etoffe_rouge','07_Accessoires',segments=12,rings=8)
    G.cloth_strip('Etoffe_pan_long',[(-.055,-.145,1.035),(-.070,-.154,.97),(-.091,-.154,.88),
        (-.122,-.149,.78),(-.16,-.13,.70)],[.055,.075,.077,.065,.035],.003,
        'Etoffe_rouge','07_Accessoires',fold=.006)
    G.cloth_strip('Etoffe_pan_court',[(-.065,-.145,1.03),(-.12,-.145,.96),(-.20,-.128,.85)],
        [.041,.059,.028],.003,'Etoffe_rouge','07_Accessoires',fold=.005)


def buckle(center,width,height,angle=0):
    rotation=Matrix.Rotation(angle,3,'Y')
    for x,z,dimensions in [(-width/2,0,(.004,.005,height)),(width/2,0,(.004,.005,height)),
        (0,-height/2,(width,.005,.004)),(0,height/2,(width,.005,.004)),(0,0,(width*.7,.003,.003))]:
        obj=G.box('Boucle_ceinture',tuple(Vector(center)+rotation@Vector((x,0,z))),
            dimensions,'Laiton','07_Accessoires')
        obj.rotation_euler[1]=angle


def basket_radius(z):
    t=max(0,min(1,(z-.94)/.53))
    return .12+.07*t,.088+.055*t


def build_basket():
    sides=28;levels=[.94,1.03,1.20,1.37,1.47]
    vertices,faces=[],[]
    for inner in (False,True):
        for k,z in enumerate(levels):
            rx,ry=basket_radius(z)
            if inner:rx-=.008;ry-=.008
            for j in range(sides):
                a=math.tau*j/sides
                vertices.append((rx*math.sin(a),.27-ry*math.cos(a),z+(.008 if inner and k==0 else 0)))
    sheet=len(levels)*sides
    for i in range(len(levels)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
            faces.append((a+sheet,a+sheet+sides,b+sheet+sides,b+sheet))
    for j in range(sides):
        a=(len(levels)-1)*sides+j;b=(len(levels)-1)*sides+(j+1)%sides
        faces.append((a,b,b+sheet,a+sheet))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple(sheet+j for j in range(sides)))
    G.mesh('Panier_paroi_ouverte',vertices,faces,'Osier','09_Panier')
    for row in range(14):
        z=.957+.50*row/13;rx,ry=basket_radius(z)
        ring('Osier_horizontal',rx+.002,ry+.002,z,.27,
            'Osier_clair' if row%3==0 else 'Osier','09_Panier',.004,32,4,.0024,row*math.pi)
    for stake in range(20):
        a=math.tau*stake/20;points=[]
        for j in range(8):
            z=.95+.52*j/7;rx,ry=basket_radius(z)
            variation=.003*math.cos(j*math.pi+stake)
            points.append(((rx+variation)*math.sin(a),.27-(ry+variation)*math.cos(a),z))
        G.tube('Montant_osier',points,.0036,'Osier_clair','09_Panier',sides=4)
    for z in (1.463,1.480):
        ring('Rebord_panier',.192,.146,z,.27,'Osier_clair','09_Panier',.007,36,5)
    ring('Base_panier',.123,.091,.948,.27,'Osier_clair','09_Panier',.005,32,4)


def build_hay():
    G.ellipsoid('Masse_foin',(0,.27,1.477),(.176,.128,.052),'Foin','09_Panier',segments=16,rings=8)
    for i in range(76):
        a=RNG.random()*math.tau;r=math.sqrt(RNG.random())
        x=.16*r*math.sin(a);y=.27+.115*r*math.cos(a)
        z=1.475+RNG.random()*.025
        drift=Vector((RNG.uniform(-.10,.10),RNG.uniform(-.075,.075),RNG.uniform(.045,.145)))
        start=Vector((x,y,z))
        G.tube('Brin_foin',[tuple(start),tuple(start+drift*.55),tuple(start+drift),
            tuple(start+drift+Vector((RNG.uniform(-.04,.04),.015,-.018)))],
            [.0018,.0015,.001,.0003],'Foin_clair' if i%3 else 'Foin','09_Panier',sides=3)


def build_basket_and_hay():
    collect_new('Panier_Osier',build_basket)
    collect_new('Foin_Panier',build_hay)


def build_fork():
    x,y=-1.00,-.32
    G.loft('Manche_fourche',[(.035,.015,.015,0),(.18,.014,.014,0),
        (1.18,.0115,.0115,0),(1.43,.014,.012,0)],'Bois_manche','10_Fourche',
        sides=12,center=(x,y,0),wave=.015)
    G.loft('Douille_fourche',[(1.35,.016,.011,0),(1.47,.016,.010,0),
        (1.51,.027,.009,0)],'Metal_patine','10_Fourche',sides=10,center=(x,y,0))
    G.tube('Traverse_fourche',[(x-.088,y,1.515),(x-.045,y,1.500),(x,y,1.495),
        (x+.045,y,1.50),(x+.088,y,1.515)],.0075,'Metal_patine','10_Fourche',sides=6)
    for i,offset in enumerate([-.09,-.03,.03,.09]):
        top=2.03+(.025 if i in (1,2) else 0)
        tooth=G.tube('Dent_'+str(i+1),[(x+offset*.82,y,1.50),(x+offset,y,1.57),
            (x+offset*1.04,y-.014,1.80),(x+offset*1.09,y-.020,top)],
            [.0075,.007,.0045,.0005],'Metal_patine','10_Fourche',sides=6)
        tooth['dent_index']=i+1
    for z in (1.39,1.45):
        G.ellipsoid('Rivet_douille',(x,y-.0115,z),(.003,.0016,.003),'Laiton','10_Fourche',segments=8,rings=4)


def build_flask():
    x,y=-.22,-.008
    G.loft('Gourde_corps',[(.80,.022,.021,0),(.82,.041,.030,0),(.89,.052,.035,0),
        (.95,.040,.029,0),(.981,.016,.017,0)],'Cuir_gourde','07_Accessoires',sides=18,center=(x,y,0),wave=.018)
    G.loft('Goulot',[(.977,.016,.017,0),(1.005,.016,.016,0)],
        'Cuir_sangles','07_Accessoires',sides=12,center=(x,y,0))
    G.loft('Bouchon_gourde',[(1.002,.018,.018,0),(1.022,.017,.017,0)],
        'Bois_manche','07_Accessoires',sides=10,center=(x,y,0))
    G.tube('Corde_gourde',[(x-.018,y,1.0),(-.18,-.07,1.07),(-.145,-.09,1.085),
        (x+.02,y,1.00)],.003,'Corde_chanvre','07_Accessoires',sides=5)


def build_bag():
    x,y=.215,.025
    G.loft('Sacoche_corps',[(.85,.033,.025,0),(.87,.054,.032,0),(.96,.056,.033,0),
        (1.005,.046,.028,0)],'Cuir_gilet','07_Accessoires',sides=16,center=(x,y,0))
    G.cloth_strip('Sacoche_rabat',[(x,y-.012,1.012),(x,y-.04,.98),(x,y-.045,.94)],
        [.10,.105,.089],.005,'Cuir_sangles','07_Accessoires',fold=.001)
    G.ellipsoid('Fermoir_sacoche',(x,y-.049,.950),(.006,.002,.006),
        'Laiton','07_Accessoires',segments=10,rings=5)


def build_ropes():
    for i in range(3):
        points=[]
        for j in range(25):
            a=math.tau*j/24
            points.append((.151+(.029+i*.003)*math.sin(a),-.097-i*.002,.975+.047*math.cos(a)))
        G.tube('Corde_enroulee',points,.003,'Corde_chanvre','07_Accessoires',sides=4)
    G.tube('Corde_libre',[(.15,-.10,1.03),(.19,-.09,.99),(.23,-.074,.92),(.22,-.05,.86)],
        .003,'Corde_chanvre','07_Accessoires',sides=4)


def build_sickle():
    G.loft('Manche_serpette',[(.815,.009,.009,0),(.94,.010,.010,0)],
        'Bois_manche','07_Accessoires',sides=10,center=(.245,.09,0))
    points=[]
    for j in range(9):
        a=-math.pi*.15+j/8*math.pi*1.15
        points.append((.245+.042*math.cos(a),.09,.972+.043*math.sin(a)))
    G.ribbon('Lame_serpette',points,.013,.004,'Metal_patine','07_Accessoires')


def build_dibber():
    G.loft('Piquet_a_semer',[(.82,.001,.001,0),(.85,.008,.008,0),(.97,.011,.011,0),
        (.985,.015,.012,0)],'Bois_manche','07_Accessoires',sides=10,center=(.25,.16,0))


def build_independent_accessories():
    for name,build in [('Fourche_4_Dents',build_fork),('Gourde_Ceinture',build_flask),
        ('Sacoche_Cuir',build_bag),('Cordes_Ceinture',build_ropes),
        ('Serpette_Ceinture',build_sickle),('Piquet_Bois',build_dibber)]:
        collect_new(name,build)


def build_textures():
    size=PARAMS['texture_size'];rng=np.random.default_rng(PARAMS['seed'])
    y,x=np.mgrid[0:size,0:size].astype(np.float32)/size
    directory=ROOT/'textures/paysan'

    def noise(frequency):
        grid=rng.random((frequency,frequency)).astype(np.float32)
        xx=x*frequency;yy=y*frequency;ix=xx.astype(int);iy=yy.astype(int)
        tx=xx-ix;ty=yy-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty)
        return ((1-tx)*(1-ty)*grid[iy%frequency,ix%frequency]
            +tx*(1-ty)*grid[iy%frequency,(ix+1)%frequency]
            +(1-tx)*ty*grid[(iy+1)%frequency,ix%frequency]
            +tx*ty*grid[(iy+1)%frequency,(ix+1)%frequency])

    def image(name,rgb,color=False):
        if rgb.ndim==2:rgb=np.repeat(rgb[:,:,None],3,axis=2)
        rgb=np.clip(rgb,0,1)
        if color:rgb=np.where(rgb<=.0031308,12.92*rgb,1.055*rgb**(1/2.4)-.055)
        rgba=np.concatenate((rgb,np.ones((size,size,1))),axis=2).astype(np.float32)
        result=bpy.data.images.new('Paysan_'+name,width=size,height=size,alpha=True,float_buffer=False)
        result.colorspace_settings.name='sRGB' if color else 'Non-Color'
        result.pixels.foreach_set(rgba.ravel());result.update()
        result.filepath_raw=str(directory/(name+'.png'));result.file_format='PNG'
        result.save();result.pack()
        return result

    coarse=noise(7)*.55+noise(19)*.30+noise(39)*.15
    fine=noise(96)
    weave=(np.sin(x*math.tau*64)*np.sin(y*math.tau*64)+1)*.5
    braid=(np.sin((x+y)*math.tau*24)*np.sin((x-y)*math.tau*24)+1)*.5
    fields={'cuir':(.74+.44*coarse+.07*fine,.45*noise(110)+.17*coarse,.70),
        'tissu':(.85+.16*coarse+.06*weave,.48*weave+.07*fine,.92),
        'tresse':(.80+.20*coarse+.13*braid,.40*braid+.09*fine,.93)}
    maps={}
    for kind,(_,height,roughness) in fields.items():
        dy,dx=np.gradient(height)
        normal=np.stack((-dx*1.8,-dy*1.8,np.ones_like(dx)),axis=2)
        normal/=np.linalg.norm(normal,axis=2,keepdims=True)
        maps[kind]={'normal':image(kind+'_normal',normal*.5+.5),
            'roughness':image(kind+'_rugosite',roughness+.06*(coarse-.5))}
    targets={'Cuir_gilet':'cuir','Cuir_sangles':'cuir','Cuir_bottes':'cuir','Cuir_gourde':'cuir',
        'Lin_ecru':'tissu','Lin_revers':'tissu','Bandes_beige':'tissu','Pantalon_brun':'tissu',
        'Etoffe_rouge':'tissu','Paille':'tresse','Osier':'tresse'}
    for name,kind in targets.items():
        mat=G.MATERIALS[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links
        shader=nodes.get('Principled BSDF')
        color=np.array(shader.inputs['Base Color'].default_value[:3],dtype=np.float32)
        albedo=image(name+'_couleur',fields[kind][0][:,:,None]*color,True)
        tex=nodes.new('ShaderNodeTexImage');tex.image=albedo
        links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        rough=nodes.new('ShaderNodeTexImage');rough.image=maps[kind]['roughness']
        links.new(rough.outputs['Color'],shader.inputs['Roughness'])
        source=nodes.new('ShaderNodeTexImage');source.image=maps[kind]['normal']
        normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.25
        links.new(source.outputs['Color'],normal.inputs['Color'])
        links.new(normal.outputs['Normal'],shader.inputs['Normal'])


def apply_modifiers(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    for modifier in list(obj.modifiers):
        assert bpy.ops.object.modifier_apply(modifier=modifier.name)=={'FINISHED'}


def bounds(objects):
    bpy.context.view_layer.update()
    points=[obj.matrix_world@Vector(corner) for obj in objects for corner in obj.bound_box]
    return {axis:(min(p[i] for p in points),max(p[i] for p in points))
        for i,axis in enumerate(('x','y','z'))}


def normalize_model(objects):
    fork=set(PARTS['Fourche_4_Dents'])
    for obj in objects:apply_modifiers(obj)
    character=bounds([obj for obj in objects if obj not in fork])
    source_height=character['z'][1]-character['z'][0]
    scale=PARAMS['height_m']/source_height
    offset=Vector((0,0,-character['z'][0]*scale))
    for obj in objects:
        matrix=obj.matrix_world.copy()
        for vertex in obj.data.vertices:vertex.co=(matrix@vertex.co)*scale+offset
        obj.parent=None;obj.matrix_world=Matrix.Identity(4)
        G.correct_normals(obj);G.assign_uvs(obj)
    # La fourche séparée repose au même niveau que les semelles pour l'aperçu.
    fork_floor=bounds(list(fork))['z'][0]
    for obj in fork:
        for vertex in obj.data.vertices:vertex.co.z-=fork_floor
        obj.data.update()
    return scale


def merge_accessories(root):
    result={}
    for name in ACCESSORIES:
        obj=G.join_objects(PARTS[name],name)
        box=bounds([obj])
        bpy.context.scene.cursor.location=tuple((low+high)/2 for low,high in box.values())
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        obj['accessoire']=True;obj['amovible']=True
        if name=='Fourche_4_Dents':obj['nombre_dents']=4
        if name!='Fourche_4_Dents':obj.parent=root
        result[name]=obj
    hay=result['Foin_Panier'];matrix=hay.matrix_world.copy()
    hay.parent=result['Panier_Osier'];hay.matrix_world=matrix
    bpy.context.scene.cursor.location=(0,0,0)
    return result


def check_glb():
    raw=GLB.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',raw,0)
    assert magic==b'glTF' and version==2 and length==len(raw)
    size,chunk=struct.unpack_from('<I4s',raw,12)
    assert chunk==b'JSON'
    doc=json.loads(raw[20:20+size])
    names={node.get('name') for node in doc['nodes']}
    assert set(ACCESSORIES+['Paysan_Corps']).issubset(names),names
    assert not doc.get('skins') and not doc.get('animations')
    assert len(doc['meshes'])==len(ACCESSORIES)+1
    required={'Peau','Lin_ecru','Cuir_gilet','Paille','Osier','Foin','Metal_patine','Bandes_beige'}
    assert required.issubset({material['name'] for material in doc['materials']})
    triangles=vertices=primitives=0
    for item in doc['meshes']:
        for primitive in item['primitives']:
            assert primitive.get('mode',4)==4
            attrs=primitive['attributes']
            assert {'POSITION','NORMAL','TEXCOORD_0'}.issubset(attrs)
            count=doc['accessors'][primitive['indices']]['count']
            assert count%3==0
            triangles+=count//3;vertices+=doc['accessors'][attrs['POSITION']]['count'];primitives+=1
    assert triangles<=PARAMS['triangle_budget'],f'Budget de V1 dépassé : {triangles} triangles'
    assert all('bufferView' in image and 'uri' not in image for image in doc.get('images',[]))
    assert len(doc.get('images',[]))>=9
    binary_header=20+size
    binary_size,kind=struct.unpack_from('<I4s',raw,binary_header)
    assert kind==b'BIN\0' and binary_header+8+binary_size==len(raw)
    assert all(view.get('byteOffset',0)+view['byteLength']<=binary_size for view in doc['bufferViews'])
    return {'version':'V1 à valider','reference':'Illustration du paysan fournie dans la conversation',
        'triangles':triangles,'vertices_gltf':vertices,'meshes':len(doc['meshes']),
        'materials':len(doc['materials']),'primitives':primitives,'glb_bytes':len(raw),
        'embedded_images':len(doc.get('images',[])),'texture_size':PARAMS['texture_size'],
        'accessories':ACCESSORIES,'fork_tines':4,'animations':False,'armature':False,
        'character_height_with_hat_m':PARAMS['height_m'],
        'limitations':['Visage, cheveux et plis encore stylisés ; aucune reproduction photoréaliste garantie.',
            'Éléments en T-pose, non pondérés ; topologie à retoucher pour les déformations du futur rig.',
            'LOD et atlas à étudier pour de nombreuses instances ; performances sur Quest 3 non mesurées.']}


def check_roundtrip():
    source=bpy.context.scene
    old={kind:set(getattr(bpy.data,kind)) for kind in ('meshes','materials','images')}
    scene=bpy.data.scenes.new('Controle_import_paysan')
    bpy.context.window.scene=scene
    assert bpy.ops.import_scene.gltf(filepath=str(GLB))=={'FINISHED'}
    imported=list(scene.objects)
    meshes=[obj for obj in imported if obj.type=='MESH']
    assert len(meshes)==len(ACCESSORIES)+1
    for name in ACCESSORIES:
        assert any(obj.name.startswith(name) for obj in meshes),name
    character=bounds([obj for obj in meshes if not obj.name.startswith('Fourche_4_Dents')])
    height=character['z'][1]-character['z'][0]
    assert math.isclose(height,PARAMS['height_m'],abs_tol=.003),(height,character)
    assert not any(obj.type=='ARMATURE' or obj.animation_data for obj in imported)
    bpy.context.window.scene=source
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(scene)
    for kind in ('meshes','materials','images'):
        for data in list(getattr(bpy.data,kind)):
            if data not in old[kind] and data.users==0:getattr(bpy.data,kind).remove(data)
    return height


def build_preview_studio():
    G.SETTINGS['preview_size']=PARAMS['preview_size'];G.SETTINGS['samples']=PARAMS['samples']
    cameras=G.build_studio()
    for obj in cameras.values():obj.data.ortho_scale=2.20
    fill=bpy.data.objects.get('Remplissage')
    fill.location.z=1.6;fill.data.energy=185;G.orient_toward(fill,(0,0,1.0))
    data=bpy.data.cameras.new('Camera_three_quarter')
    camera=bpy.data.objects.new('Camera_three_quarter',data)
    G.COLLECTIONS['90_Studio'].objects.link(camera)
    camera.location=(5,-7,2.9);G.orient_toward(camera,(-.06,.02,.93))
    data.type='ORTHO';data.ortho_scale=2.25
    cameras['three_quarter']=camera
    return cameras


def finish():
    stage('normales, UV et échelle métrique')
    model=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    scale=normalize_model(model)
    root=bpy.data.objects.new('Paysan_TPose',None)
    G.COLLECTIONS['01_Corps'].objects.link(root)
    root['version']='V1 complète — validation du concepteur attendue'
    root['reference']='Paysan à chapeau de paille, panier de foin et fourche à quatre dents'
    root['hauteur_m']=PARAMS['height_m']
    prop_objects={obj for values in PARTS.values() for obj in values}
    body=[obj for obj in model if obj not in prop_objects]
    for obj in body:obj.parent=root
    props=merge_accessories(root)
    bpy.context.view_layer.update()

    # Blender conserve ses pièces éditables. Le GLB regroupe le corps, mais pas les accessoires.
    temporary=bpy.data.collections.new('99_Export_paysan')
    bpy.context.scene.collection.children.link(temporary)
    depsgraph=bpy.context.evaluated_depsgraph_get();copies=[]
    for obj in body:
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),depsgraph=depsgraph)
        duplicate=bpy.data.objects.new('Export_'+obj.name,data)
        temporary.objects.link(duplicate);duplicate.matrix_world=obj.matrix_world.copy();copies.append(duplicate)
    exported=G.join_objects(copies,'Paysan_Corps')
    export_root=bpy.data.objects.new('Paysan',None);temporary.objects.link(export_root)
    exported.parent=export_root
    previous={obj:(obj.parent,obj.matrix_world.copy()) for obj in props.values()}
    for name,obj in props.items():
        if name not in ('Foin_Panier','Fourche_4_Dents'):
            matrix=obj.matrix_world.copy();obj.parent=export_root;obj.matrix_world=matrix
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [export_root,exported,*props.values()]:obj.select_set(True)
    bpy.context.view_layer.objects.active=exported
    stage('export GLB avec accessoires indépendants')
    assert bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,
        export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
        export_extras=True)=={'FINISHED'}
    report=check_glb()
    for obj,(parent,matrix) in previous.items():obj.parent=parent;obj.matrix_world=matrix
    bpy.data.objects.remove(exported,do_unlink=True);bpy.data.objects.remove(export_root,do_unlink=True)
    bpy.data.collections.remove(temporary)
    report['roundtrip_height_m']=check_roundtrip();report['roundtrip_import_ok']=True
    report['source_scale_factor']=scale
    report['fork_height_m']=bounds([props['Fourche_4_Dents']])['z'][1]-bounds([props['Fourche_4_Dents']])['z'][0]
    cameras=build_preview_studio()
    scene=bpy.context.scene;scene.camera=cameras['front']
    scene.render.filepath=str(PREVIEWS/'paysan_front.png')
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.shading.color_type='MATERIAL'
    assert bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))=={'FINISHED'}
    for view,camera in cameras.items():
        scene.camera=camera;scene.render.filepath=str(PREVIEWS/f'paysan_{view}.png')
        stage('rendu '+view)
        assert bpy.ops.render.render(write_still=True)=={'FINISHED'}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    for path in [BLEND,GLB,*[PREVIEWS/f'paysan_{view}.png' for view in cameras]]:
        assert path.is_file() and path.stat().st_size>0
        print('FICHIER_VALIDE',path,path.stat().st_size,flush=True)
    print('PAYSAN_V1_OK '+json.dumps(report,ensure_ascii=False),flush=True)


def main():
    stage('scene et base humaine');start_scene();build_person();build_harness()
    stage('chapeau tresse');collect_new('Chapeau_Paille',build_hat)
    stage('panier et foin');build_basket_and_hay()
    stage('fourche et accessoires');build_independent_accessories()
    stage('materiaux PBR');build_textures()
    finish()


if __name__=='__main__':main()
