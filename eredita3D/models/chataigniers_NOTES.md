# Châtaigneraies — trois compositions V1

Modèles de plateau en volumes facettés, générés avec Blender 5.1.1 et bpy. Chaque composition possède sa ramure et son feuillage propres : ce ne sont pas trois copies redimensionnées. Les troncs sont ramifiés, les feuilles détaillées sont dentées et fermées, et les bogues épineuses et châtaignes sont des volumes opaques.

| Variante | Composition | Triangles | Taille GLB | Dimensions Three.js (X/Y/Z) |
| --- | --- | ---: | ---: | --- |
| Petit (N1) | Un jeune arbre | 3 484 | 370 868 octets | 0,50 / 0,452 / 0,50 |
| Moyen (N2) | Deux arbres de hauteurs différentes | 5 512 | 579 608 octets | 0,50 / 0,582 / 0,50 |
| Grand (N3) | Trois arbres et ramure plus dense | 7 540 | 788 336 octets | 0,50 / 0,702 / 0,510 |

Deux matériaux PBR par variante : terre/écorce et feuillage/bogues, avec couleurs de sommets. Aucune texture ni transparence dans les GLB. Trois meshes d’édition sont fusionnés en deux lots de rendu par parcelle. Le cache du jeu partage les géométries, avec des matériaux propres à chaque instance.

Le **niveau de la culture dans chaque slot** choisit la composition : N1 → petit, N2 → moyen, N3 → grand. Cette association est dans `Config.cropModels.chataignier.variants`. Planter coûte 75 or ; améliorer au N2 coûte 150 or supplémentaires et au N3 300 or supplémentaires, avec les rendements ×1/×2/×3 définis par `Config.cropLevels`. Les améliorations modifient le modèle 3D et le sprite 2D de ce seul emplacement. Le nombre de parcelles, leurs niveaux et les stocks voisins n’interviennent pas. Retirer une autre plantation ne réduit pas le modèle de la culture restante. Une nouvelle plantation repart au N1.

Les parcelles conservent leur emprise ; aucune superficie, croissance, quantité d’arbres simulée ou nouvelle règle économique n’est ajoutée. Les châtaigniers restent autorisés uniquement en Plaine et en Montagne, sur les emplacements libres. Chaque emplacement libre de Montagne peut également atteindre le N3. Le feuillage est statique. Il s’agit d’une représentation stylisée à l’échelle du plateau, pas d’un modèle botanique réaliste.

Fichiers dans `eredita3D` :

- `scripts/create_chataigniers.py`
- `models/chataignier_petit.blend`, `chataignier_moyen.blend`, `chataignier_grand.blend`
- `exports/chataignier_petit.glb`, `chataignier_moyen.glb`, `chataignier_grand.glb`
- `previews/chataigniers_comparatif.png` : les trois tailles à la même échelle.
- `previews/chataignier_{petit,moyen,grand}_three_quarter.png` et `_sprite.png`
- `previews/chataigniers_in_game.png`, `chataigniers_web_2d.png`
- `logs/chataigniers-validation.json` : mesures des exports.

Depuis la racine du projet, `npm run assets:chataigniers` régénère les modèles et les sprites WebP avec Blender et Chrome locaux. `npm run test:chataigniers` vérifie les trois tailles, les améliorations N1/N2/N3 indépendantes et le retour au N1 après replantation, les restrictions de biome, la transparence des sprites, la géométrie partagée et le repli si un modèle manque. Les tests XR utilisent une API simulée ; les performances sur Quest 3 physique restent à mesurer.
