# Élevage de chèvres — V1

Trois enclos rustiques pour le plateau : petit, moyen et grand. Clôtures, portail, mangeoire et abreuvoir sont des volumes opaques. Les variantes moyenne et grande ajoutent un abri à couverture de planches. Chaque chèvre possède quatre membres articulés visuellement, des sabots fendus, des oreilles, des cornes recourbées, une barbiche et un collier avec clochette. La géométrie est statique, sans rig ni animation.

| Variante | Effectif réel dans le slot | Chèvres visibles en 3D | Triangles en jeu | GLB d’aperçu |
| --- | --- | --- | --- | --- |
| Petit | 1 à 2 | 1 ou 2 | 2 098 à 3 060 | 203 444 octets, avec 1 chèvre |
| Moyen | 3 à 5 | 3 à 5 | 4 242 à 6 166 | 401 360 octets, avec 3 chèvres |
| Grand | 6 et plus | 6 maximum | 7 128 | 672 936 octets, avec 6 chèvres |

Le nombre affiché par l’interface reste toujours l’effectif réel. Les seuils, positions, hauteur et limite visuelle sont centralisés dans `Config.livestockModels.chevre` comme valeurs provisoires de présentation. Le choix dépend du troupeau de chaque slot, pas du total du village. Un abattage peut réduire la variante ; retirer la dernière chèvre supprime l’enclos.

Les GLB complets contiennent un enclos et des chèvres indépendantes, avec les métadonnées `livestockRole` et `animalIndex`. Le chargeur `js/livestock-model.js` garde le premier animal comme prototype et compose l’effectif visible, en fusionnant les animaux en un seul lot. L’enclos constitue le second lot. Les géométries sont mises en cache pour les six effectifs visibles possibles et partagées entre instances ; les matériaux sont propres à chaque enclos. Deux matériaux PBR avec couleurs de sommets, aucune texture, aucune transparence. Le modèle d’une chèvre compte 962 triangles.

L’emprise maximale est de 0,532 × 0,532 unité de plateau, pour une hauteur maximale de 0,229. Le sol se place au-dessus du marqueur de slot existant. Le rendu de repli précédent reste utilisable pendant le chargement et si un modèle manque. Les cochons et vaches conservent leur rendu actuel.

Le placement direct, l’achat conditionné par la Bergerie, les naissances, les 25 PV par chèvre, les trajets de traite et les 4 viandes par abattage restent gérés par les modules de simulation existants. Les enclos peuvent être placés en Plaine, Montagne ou Littoral, dans les slots libres ou réservés aux animaux, selon les règles actuelles.

Fichiers dans `eredita3D` :

- Script : `scripts/create_elevage_chevres.py`.
- Scènes : `models/elevage_chevre_{petit,moyen,grand}.blend`.
- Exports : `exports/elevage_chevre_{petit,moyen,grand}.glb`.
- Comparatif : `previews/elevage_chevres_comparatif.png`.
- Vues individuelles : `previews/elevage_chevre_{petit,moyen,grand}_three_quarter.png`.
- Chèvre en détail : `previews/chevre_detail.png`.
- Rendus du jeu : `previews/chevres_in_game.png`, `chevres_web_2d.png`.
- Validation : `logs/chevres-validation.json`, `chevres-build.log`, `chevres-browser-test.log`.

`npm run assets:chevres` régénère les scènes, GLB, aperçus et sprites WebP transparents avec Blender 5.1.1 et Chrome locaux. `npm run test:chevres` contrôle le placement réel, les naissances par le cycle économique, les achats, les transitions d’effectif, l’abattage via le menu, le retrait du dernier animal, les trois biomes, le cache, les sprites et le repli. Le rendu 3D est commun à WebXR ; les tests XR utilisent une API simulée. Les performances sur Quest 3 physique restent à mesurer.
