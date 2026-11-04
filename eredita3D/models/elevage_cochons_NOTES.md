# Élevage de cochons — V1

Trois enclos rustiques avec clôtures, portail, auge de nourriture, abreuvoir et zone boueuse en volume. Les enclos moyen et grand possèdent aussi un abri. Les cochons ont un corps trapu, quatre membres courts, des sabots fendus, un groin avec deux narines, des oreilles tombantes et une queue en tire-bouchon. Le pelage sombre s’accorde au décor corse du plateau. La géométrie est statique, sans rig ni animation.

| Variante | Effectif réel dans le slot | Animaux visibles en 3D | Triangles en jeu | GLB d’aperçu |
| --- | --- | --- | --- | --- |
| Petit | 1 à 2 | 1 ou 2 | 2 206 à 3 108 | 221 160 octets, avec 1 cochon |
| Moyen | 3 à 5 | 3 à 5 | 4 230 à 6 034 | 410 584 octets, avec 3 cochons |
| Grand | 6 et plus | 6 maximum | 6 936 | 669 420 octets, avec 6 cochons |

Le système est commun à celui des chèvres, dans `js/livestock-model.js`. Chaque GLB fournit l’enclos et un prototype animal identifié par `livestockRole` / `animalIndex`. Le chargeur compose les animaux jusqu’à la limite visuelle, fusionne leur géométrie et partage les résultats en cache. Deux lots de rendu et deux matériaux PBR opaques par enclos, avec couleurs de sommets, sans textures. Un cochon compte 902 triangles. L’interface conserve toujours l’effectif réel, y compris au-delà de six.

Les seuils, positions et hauteurs provisoires sont dans `Config.livestockModels.cochon`. Le nombre est celui du slot concerné. La variante et les cochons visibles évoluent avec les naissances, achats et abattages ; le dernier animal retiré supprime l’enclos. L’emprise maximale reste de 0,532 × 0,532 unité, pour une hauteur de 0,229. Le rendu simple précédent reste disponible pendant le chargement ou si un modèle manque.

Le placement en slot libre ou réservé aux animaux, l’achat avec Bergerie, les 20 PV par cochon, la reproduction existante et les 8 viandes par abattage restent gérés par la simulation. Les cochons ne produisent pas de lait. Les variantes visuelles n’ajoutent aucun bonus économique.

Fichiers dans `eredita3D` :

- `scripts/create_elevage_cochons.py`
- `models/elevage_cochon_{petit,moyen,grand}.blend`
- `exports/elevage_cochon_{petit,moyen,grand}.glb`
- `previews/elevage_cochons_comparatif.png`
- `previews/elevage_cochon_{petit,moyen,grand}_three_quarter.png` et `_sprite.png`
- `previews/cochon_detail.png`
- `previews/cochons_in_game.png`, `cochons_web_2d.png`
- `logs/cochons-validation.json`, `cochons-build.log`, `cochons-browser-test.log`

`npm run assets:cochons` régénère les scènes, GLB, aperçus et sprites WebP avec Blender 5.1.1 et Chrome locaux. `npm run test:cochons` vérifie le placement via l’interface, les naissances par le cycle économique, les achats, les trois variantes, les compteurs, l’abattage, le retrait du dernier animal, les trois biomes, le cache, les sprites et le repli. Le test des chèvres contrôle aussi leur cohabitation avec les nouveaux cochons. Le rendu 3D est commun à WebXR ; les performances sur Quest 3 physique restent à mesurer.
