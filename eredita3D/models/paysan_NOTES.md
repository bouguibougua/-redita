# Paysan corse — V1 à valider

Première étude procédurale guidée par l’illustration fournie, en T-pose et avec
les mains libres. Le personnage mesure 1,75 m avec son chapeau. La fourche
séparée mesure environ 1,84 m. Aucun rig ni animation n’est créé.

Le BLEND conserve les pièces éditables dans des collections. Pour le GLB,
le corps est regroupé ; les neuf accessoires restent des objets indépendants :
chapeau, fourche à quatre dents, panier, foin, gourde, sacoche, cordes, serpette
et piquet. Le foin est un enfant du panier et peut également être retiré seul.

La V1 contient 40 730 triangles, 27 matériaux et 17 images PBR intégrées de
512 × 512 pixels. Le GLB pèse environ 4,49 Mo. Les chiffres et vérifications
exacts figurent dans `../logs/paysan-validation.json` et
`../logs/paysan-threejs-validation.json`.

## Limites et suite proposée après validation

- Le visage, les cheveux, les plis et l’usure sont encore stylisés. Une
  sculpture manuelle du visage et des mèches permettrait de mieux retrouver
  les traits, l’âge et les détails de la référence.
- La géométrie volumétrique est modulaire et n’est pas une retopologie de
  production. Avant le rigging, reprendre les boucles des épaules, des coudes,
  des hanches et des doigts, puis tester les déformations des vêtements.
- Les textures sont répétables et ne reproduisent pas chaque motif de
  l’image. Une sculpture détaillée, suivie d’une retopologie et d’un bake des
  normales, améliorerait les plis, la paille et le cuir sans multiplier les
  triangles de la version de jeu.
- Pour de nombreux paysans sur Meta Quest 3, prévoir des LOD et un atlas de
  matériaux afin de réduire les triangles et les appels de dessin. Le
  chargement Three.js est contrôlé, mais les performances sur le casque ne
  sont pas mesurées.

Ces améliorations ne sont pas lancées sans validation de cette V1.

## Régénération

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/create_paysan.py
node eredita3D/scripts/validate_paysan_threejs.js
```

Le script importe en lecture seule les fonctions géométriques de
`create_guerrier.py`. Il n’exécute pas le générateur du guerrier et n’écrit
aucun fichier du jeu. Toutes ses sorties restent dans `eredita3D`.
