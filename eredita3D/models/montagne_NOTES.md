# Montagne corse — V1 pour Eredità

Crêtes de granite à plusieurs sommets, éboulis, pins, genévriers et herbe
d'altitude, dans le même style que la plaine. La vallée centrale reste libre.

## Fichiers

- `models/montagne.blend` : scène Blender 5.1.1, collections et caméras.
- `exports/montagne.glb` : géométrie et textures PBR intégrées, sans animation.
- `scripts/create_montagne.py` : génération déterministe avec bpy et NumPy fourni par Blender.
- `previews/montagne_three_quarter.png`, `montagne_top.png`, `montagne_detail.png` : aperçus.
- `previews/montagne_web_top.png`, `montagne_web_card.png` : rendus pour les deux WebP du jeu.
- `logs/montagne-validation.json`, `logs/montagne-build.log` : statistiques et journal.

## Géométrie et règles du plateau

**10 798 triangles, 2 matériaux opaques, 2 textures 1024 px, GLB de 4,29 Mo.**
Tuile de **2,82 × 4,85 unités de plateau**, relief maximal proche de 0,82
au-dessus de l'origine. Il s'agit d'une maquette de stratégie pour le plateau
WebXR, pas d'un paysage à traverser à l'échelle humaine.

Les 157 objets d'édition sont fusionnés au chargement en **4 lots par région** :
surface, socle, roches et végétation. `js/terrain-model.js` partage géométrie
et textures entre les régions. Le format Simplifié espace les décors de 15 %
sans étirer leurs volumes ; seuls le sol et son socle sont élargis.
Un incendie masque la végétation et assombrit les matériaux ; les crêtes restent.

Les **2 slots libres et 2 slots réservés aux animaux** sont ajoutés par le jeu,
ainsi que les bâtiments, les cultures, les troupeaux et les pouvoirs. Le modèle
ne contient aucun champ, animal ou obstacle de gameplay. Les zones des slots,
les villages et la bande de rivière optionnelle restent accessibles.

## Régénération

Depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/create_montagne.py
cp eredita3D/exports/montagne.glb assets/models/montagne.glb
npm run assets:montagne
npm run test:montagne
```

La commande `assets:montagne` produit les images de fond 2D et de sélection
à partir du BLEND existant. Les fonds des autres biomes restent indépendants.

## Limites

Première version stylisée, avec des crêtes volontairement concentrées sur les
bords pour laisser les actions lisibles. Les régions réutilisent la même
disposition. Les tests navigateur et XR simulés ne mesurent pas la fluidité
sur un casque Quest 3 physique ; celle-ci reste à vérifier sur l'appareil.
