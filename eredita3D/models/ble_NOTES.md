# Champ de blé — première version

Parcelle de terre travaillée avec cinq sillons et 35 pieds de blé. Tiges, feuilles pliées, grains et barbes sont des volumes 3D. Les variations de hauteur et de couleur sont déterministes. Le style facetté est adapté à l’échelle du plateau.

- Source : `scripts/create_ble.py`, exécutée avec Blender 5.1.1 / bpy.
- Scène : `models/ble.blend` ; export : `exports/ble.glb`.
- Aperçus : `previews/ble_three_quarter.png`, `ble_top.png`, `ble_detail.png`, `ble_sprite.png`.
- 4 420 triangles, deux matériaux PBR opaques avec couleurs de sommets, aucune texture ; GLB de 480 500 octets.
- Encombrement Three.js : 0,48 × 0,309 × 0,48 unité ; trois meshes d’édition, fusionnés en deux lots de rendu par champ.
- La géométrie est partagée entre les champs ; chaque champ possède ses matériaux pour isoler les effets de couleur.

Le jeu charge `assets/models/ble.glb` via `js/crop-model.js`. La hauteur du socle est réglable dans `Config.cropModels.ble.elevation`. Le sprite `assets/generated/crop-ble-v1.webp` (256 × 256, transparent) sert à la vue 2D et au bouton de plantation.

Le modèle remplace uniquement l’apparence du blé planté : les slots commencent vides, le placement reste limité à la Plaine et au Littoral, et les 200 PV ainsi que les récoltes existantes sont conservés. Les autres cultures gardent leur apparence actuelle. Cette V1 est statique et représente du blé mûr ; aucun vent ni cycle de croissance n’est ajouté.

Régénérer depuis la racine du projet avec `npm run assets:ble` (Blender et Chrome locaux), puis vérifier avec `npm run test:ble`. Le journal de Blender est dans `logs/ble-build.log`, les mesures dans `logs/ble-validation.json`. Le test navigateur contrôle la plantation, les dimensions, les matériaux, le cache, le remplacement et le repli visuel. La scène est commune à la vue 3D et à WebXR ; aucun casque physique n’a été utilisé pour mesurer les performances.
