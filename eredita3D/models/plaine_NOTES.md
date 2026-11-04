# Plaine corse — V1 pour le plateau Eredità

Prairie méditerranéenne, chemins de terre, granite, maquis bas et touffes sèches.
Le terrain est un volume 3D fermé ; les rochers et les végétaux sont des meshes
opaques. L'albédo et la normale procéduraux sont inclus dans le GLB.

## Fichiers

- `models/plaine.blend` : source Blender 5.1.1 avec collections et caméras.
- `exports/plaine.glb` : export autonome, sans caméra, lumière ni animation.
- `scripts/create_plaine.py` : génération déterministe avec bpy, sans dépendance à installer.
- `previews/plaine_three_quarter.png`, `plaine_top.png`, `plaine_detail.png` : rendus Blender.
- `previews/plaine_in_game.png` : capture du terrain dans le jeu.
- `previews/plaine_web_top.png`, `plaine_web_card.png` : rendus adaptés au web,
  convertis en `assets/generated/terrain-plaine-v1.webp` et `terrain-plaine-card-v1.webp`.
- `logs/plaine-validation.json` et `logs/plaine-build.log` : validation et journal Blender.

## Adaptation au jeu / à la VR

La tuile mesure **2,82 × 4,85 unités de plateau**, avec le sol autour de Y=0,03
en glTF. Elle est destinée à une maquette stratégique sur table, pas à un
paysage à parcourir à l'échelle humaine. WebXR applique l'échelle du plateau.

**10 414 triangles, 2 matériaux PBR, 2 textures 1024 × 1024, GLB de 4,40 Mo.**
La végétation ne nécessite aucune transparence. Les 235 meshes d'édition
restent séparés dans Blender et dans le GLB pour conserver leurs positions.
`js/plain-terrain.js` les fusionne au chargement en **3 meshes par région**
(surface, coupe de terre, décors). La géométrie et les textures sont partagées
entre les régions ; chaque région conserve ses propres matériaux pour les effets.
Deux variantes sont mises en cache : largeur normale et largeur +15 %.
Les rochers et les touffes sont espacés sans être étirés.

Les quatre slots, les villages, les habitants, les cultures et la rivière
ne sont pas inclus dans le modèle : ils restent ajoutés par le jeu. Les repères
de slots dans Blender sont des objets Empty exclus de l'export. Le centre,
les emplacements des slots et les zones des bâtiments restent dégagés.
En cas d'échec de chargement, le terrain simple existant reste utilisable.

## Reproduction

Depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/create_plaine.py
cp eredita3D/exports/plaine.glb assets/models/plaine.glb
npm run test:plaine
```

Pour régénérer aussi les visuels de la vue 2D et du choix des biomes :

```sh
npm run assets:plaine
```

Cette commande utilise le BLEND existant, puis Chrome pour encoder deux WebP
(environ 176 Kio au total). Elle ne modifie pas le modèle ni les autres biomes.
Les cultures et bâtiments restent superposés dynamiquement en vue 2D.

Après une modification de l'asset, incrémenter sa version dans
`Config.terrainModels.plaine.src` pour renouveler le cache navigateur.

## Limites

Première version stylisée à examiner : les formes du maquis restent simples,
le relief est volontairement faible et les régions partagent la même disposition.
Les contrôles dans Chrome et les tests XR simulés ne remplacent pas une mesure
des performances dans un Meta Quest 3 physique. Aucun nouveau comportement,
obstacle, coût ni règle de combat n'a été introduit.
