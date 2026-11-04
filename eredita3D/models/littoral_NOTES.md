# Littoral corse — V1 pour Eredità

Deux compositions indépendantes : sable, maquis, granite côtier, mer turquoise
et filets d'écume. Le tracé du rivage et les positions des décors diffèrent entre
les camps ; la côte bleue n'est pas une rotation de la côte rouge.

## Fichiers

- `models/littoral_rouge.blend`, `models/littoral_bleu.blend` : scènes Blender 5.1.1.
- `exports/littoral_rouge.glb`, `exports/littoral_bleu.glb` : exports autonomes.
- `scripts/create_littoral.py` : génération des deux variantes avec bpy.
- `previews/littoral_rouge_{three_quarter,top,detail}.png` et équivalents bleus : aperçus.
- `previews/littoral_{rouge,bleu}_web_{top,card}.png` : sources des quatre images WebP.
- `logs/littoral-build.log`, `logs/littoral_{rouge,bleu}-validation.json` : vérifications.

## Plateau et performances

Chaque variante compte **9 384 triangles, 3 matériaux PBR et 2 textures 1024 px**,
pour environ **3,72 Mo** par GLB. Les 144 objets d'édition sont regroupés au
chargement en **5 lots de rendu** : sol, socle, rochers, végétation et eau.
La géométrie et les textures sont partagées entre les régions d'un même camp.

La tuile mesure **2,82 × 4,85 unités du plateau**. La mer est en Z positif
pour Rouge, en Z négatif pour Bleu, donc toujours vers le centre du plateau.
Le village reste à l'arrière. Les **deux slots libres** sont dégagés sur la terre.
Le format Simplifié élargit le sol et l'eau, et écarte les rochers et végétaux
sans déformer leurs volumes.

L'eau est un mesh fermé opaque à faible relief. Les vaguelettes et l'écume
sont statiques ; aucune superposition de transparences ni simulation liquide
n'est nécessaire. Un incendie laisse l'eau bleue et masque la végétation.

Les barques, voiliers, filets, cultures, unités et villages sont ajoutés par le
jeu, indépendamment du modèle. Leurs règles, capacités et zones de navigation
ne changent pas. Le terrain simple reste disponible en cas d'échec du chargement.

## Régénération

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/create_littoral.py
cp eredita3D/exports/littoral_rouge.glb assets/models/littoral_rouge.glb
cp eredita3D/exports/littoral_bleu.glb assets/models/littoral_bleu.glb
npm run assets:littoral
npm run test:littoral
```

Première version stylisée pour un plateau de stratégie, sans animation de vagues.
Les performances sur Quest 3 physique restent à mesurer ; les tests navigateur
et XR simulés ne remplacent pas une mesure dans le casque.
