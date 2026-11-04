# Guerrier fourni par le concepteur

Source conservée : `/Users/robin/Downloads/medieval swordsman 3d model.glb`.
Ce modèle visuel est la version finale désignée par le concepteur.
Empreinte SHA-256 de la source : `cd44bcb24b67db2c1185bbfb0745ec3f30f35f156b1e726bd94d6c4df05f724e`.
Le GLB original est une sculpture statique sans squelette, avec 1 932 310 triangles.

`scripts/prepare_swordsman.py` importe cette source dans Blender 5.1.1, réduit
le modèle à 36 000 triangles, conserve ses UV et textures, extrait la lame et
ajoute un squelette de 20 os. Les poids sont calculés sur un volume temporaire
fermé et transférés au mesh texturé, puis corrigés au niveau du torse et de la
main droite. Le volume de calcul est absent de l'export.

Les animations `Repos`, `Marche`, `Coup_Droit`, `Revers` et `Mort` sont intégrées
dans `exports/guerrier_importe.glb` et dans la copie `assets/models/guerrier.glb`
utilisée par le jeu. La marche reste sur place : le moteur du jeu contrôle le
déplacement réel. Les attaques suivent les frappes effectives du combat. La
mort est jouée une fois et sa fin libère la figurine. La pause fige les animations,
y compris la mort. L'épée suit la main ; chaque instance a son squelette propre.

Textures : couleur 2048 px, normales et rugosité/métal 1024 px. Les textures et
la géométrie sont partagées entre les instances. Il s'agit d'une première
adaptation animée du modèle sculpté dans sa pose d'origine : les doigts, le
visage et les étoffes n'ont pas de contrôleurs individuels. Une retopologie
manuelle des articulations et un LOD permettraient d'améliorer les gros plans
et les grandes foules sur Quest. Les performances sur un casque physique
ne sont pas mesurées par les tests de navigateur.

Reconstruction complète, depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_swordsman.py
```

Les aperçus sont dans `previews/guerrier_importe_*.png` et le rapport de
validation dans `logs/swordsman-validation.json`. Aucun paquet n'est à installer.
