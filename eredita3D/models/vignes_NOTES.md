# Vignobles — modèles N1/N2/N3

Parcelles de vigne en volume, avec ceps ramifiés, supports en bois, feuilles lobées et grappes composées de grains fermés. Les trois compositions occupent la même emprise et se distinguent par leur nombre de rangées.

| Niveau | Composition visuelle | Triangles | Taille du GLB | Coût de l’action / rendement |
| --- | --- | ---: | ---: | --- |
| N1 / petit | 1 rangée, 3 ceps | 3 096 | 337 856 octets | Plantation : 75 or / ×1 |
| N2 / moyen | 2 rangées, 6 ceps | 5 368 | 581 756 octets | Amélioration : 150 or / ×2 |
| N3 / grand | 3 rangées, 9 ceps | 7 640 | 825 644 octets | Amélioration : 300 or / ×3 |

Le nombre de ceps est une représentation visuelle. Les rendements suivent exclusivement les niveaux et les règles de récolte existantes. Chaque slot choisit son modèle via `Config.cropModels.vignoble.variants`. Améliorer un vignoble ne modifie aucun voisin ; vendre puis replanter ramène la culture au N1. Les vignobles sont autorisés en Montagne et sur le Littoral, sur les slots libres. La Plaine et les emplacements réservés aux animaux restent incompatibles.

Deux matériaux PBR opaques par modèle : terre/palissage et feuillage/raisin, avec couleurs de sommets. Aucune texture, transparence ou animation. Trois meshes d’édition sont fusionnés en deux lots par parcelle au chargement. Les géométries sont partagées entre instances du même niveau, avec des matériaux propres à chaque parcelle. Dimensions Three.js : 0,50 × 0,294 × 0,50 unité de plateau. Le socle se place à la hauteur du marqueur existant.

Fichiers dans `eredita3D` :

- `scripts/create_vignes.py`
- `models/vignoble_{petit,moyen,grand}.blend`
- `exports/vignoble_{petit,moyen,grand}.glb`
- `previews/vignes_comparatif.png`
- `previews/vignoble_{petit,moyen,grand}_three_quarter.png` et `_sprite.png`
- `previews/vignes_in_game.png`, `vignes_web_2d.png`
- `logs/vignes-validation.json`, `vignes-build.log`, `vignes-browser-test.log`

Le jeu utilise `assets/models/vignoble_{petit,moyen,grand}.glb` et les sprites transparents `assets/generated/crop-vignoble-{petit,moyen,grand}-v1.webp`. Le bouton de plantation montre le N1. Le rendu simple précédent reste disponible pendant le chargement et si un GLB manque.

Régénérer avec `npm run assets:vignes` (Blender 5.1.1 et Chrome locaux), puis vérifier avec `npm run test:vignes`. Les contrôles couvrent le placement par l’interface, les améliorations, l’indépendance des parcelles, les biomes, la vente et la replantation, les dimensions, le cache et les sprites 2D. Les sources sont déterministes. Le rendu est commun à Three.js et WebXR ; les performances sur Quest 3 physique restent à mesurer.
