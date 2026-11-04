# Élevage de vaches — V1

Trois enclos rustiques dans le style des autres productions du plateau. Clôtures, portail, abreuvoir et râtelier à foin sont des volumes opaques ; les variantes moyenne et grande ajoutent un abri et un seau de traite décoratif. Les vaches possèdent un corps massif, quatre membres avec sabots fendus, une tête à large museau, des cornes, des oreilles, une mamelle avec quatre trayons et une longue queue terminée par une touffe. Le modèle est statique, sans rig ni animation.

| Variante | Effectif réel dans le slot | Vaches visibles en 3D | Triangles en jeu | GLB d’aperçu |
| --- | --- | --- | --- | --- |
| Petit | 1 à 2 | 1 ou 2 | 2 550 à 3 944 | 251 368 octets, avec 1 vache |
| Moyen | 3 à 5 | 3 à 5 | 5 830 à 8 618 | 562 228 octets, avec 3 vaches |
| Grand | 6 et plus | 6 maximum | 10 012 | 972 684 octets, avec 6 vaches |

Le chargeur commun `js/livestock-model.js` reprend le système des chèvres et des cochons. Les GLB complets contiennent un enclos et des animaux indépendants. Les métadonnées `livestockRole` et `animalIndex` permettent de conserver un prototype animal, puis de composer l’effectif visible. Le cache partage les géométries entre enclos ; chaque instance possède ses matériaux. Deux lots de rendu et deux matériaux PBR opaques avec couleurs de sommets, sans texture. Une vache représente 1 394 triangles.

Les seuils, positions, hauteur et limite visuelle provisoires sont centralisés dans `Config.livestockModels.vache`. Les vaches sont orientées en deux rangées pour conserver leur place dans le slot. L’effectif du slot choisit la variante ; le compteur reste exact au-delà des six vaches visibles. Naissances, achats et abattages font évoluer le rendu, et retirer le dernier animal supprime l’enclos. L’emprise du modèle reste inférieure à 0,56 × 0,56 unité de plateau, pour une hauteur de 0,24.

Les 30 PV par vache, la reproduction existante, la traite puis le transport du lait, les conditions d’achat et les 8 viandes par abattage restent gérés par les règles actuelles. Les variantes ne constituent pas des niveaux économiques. Le rendu simple précédent reste disponible si un GLB manque ou pendant le chargement.

Fichiers dans `eredita3D` :

- `scripts/create_elevage_vaches.py`
- `models/elevage_vache_{petit,moyen,grand}.blend`
- `exports/elevage_vache_{petit,moyen,grand}.glb`
- `previews/elevage_vaches_comparatif.png`
- `previews/elevage_vache_{petit,moyen,grand}_three_quarter.png` et `_sprite.png`
- `previews/vache_detail.png`
- `previews/vaches_in_game.png`, `vaches_web_2d.png`
- `logs/vaches-validation.json`, `vaches-build.log`, `vaches-browser-test.log`

`npm run assets:vaches` régénère scènes, exports, aperçus et sprites WebP avec Blender 5.1.1 et Chrome locaux. `npm run test:vaches` vérifie le placement par l’interface, les naissances par le cycle économique, les achats, les trois variantes, les effectifs laitiers, l’abattage, le retrait du dernier animal, les trois biomes, les dimensions, le cache, les sprites 2D et le repli. Le rendu 3D est commun à WebXR ; les performances sur Quest 3 physique restent à mesurer.
