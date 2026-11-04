# U Lupu Mannaru — modèle fourni animé

Le fichier original `/Users/robin/Downloads/U lupu mannaru 3d.glb` est conservé sans modification. Son SHA-256 est `f708c7a3a23176ad5e0e488e277a1f1a94259fd91755a79ebd52546f3e314edf`.

Le modèle de jeu garde 10 406 triangles, un mesh et un matériau avec la texture originale réduite à 2 048 pixels. Un squelette de 22 os est ajouté pour le tronc, la tête, les quatre membres et la queue. Les poids sont calculés sur un volume temporaire fermé, transférés aux sommets UV d’origine puis ajustés sur les poignets. Le proxy n’est pas exporté.

Les quatre clips sont `Repos`, `Quatre_Pattes`, `Griffes_Croisees` et `Mort`. Le déplacement est animé en place, avec appuis diagonaux alternés. L’attaque passe de la posture basse à une posture debout, puis enchaîne une griffure droite descendante vers la gauche et une griffure gauche descendante vers la droite. Les deux gestes correspondent à une seule attaque existante du jeu. La durée du clip est adaptée par le lecteur à la cadence visuelle configurée ; aucune animation ne déplace l’unité dans la simulation.

Il s’agit d’un premier rig créé par script sur une illustration sculptée en pose fixe. Les rotations importantes des épaules, coudes et poignets peuvent pincer ou étirer certaines mèches et bandages. Une amélioration manuelle consiste à peindre les poids dans Blender et à ajouter des articulations de torsion aux avant-bras ; la fourrure et le pagne ne sont pas simulés. Les performances en Quest 3 physique restent à mesurer.

Les règles sont conservées : transformation d’un habitant admissible ou du prochain nouveau-né, 60 PV, 20 dégâts, propriétés du Ravageur et ciblage des structures seulement. Le partage de géométrie et de texture entre instances n’empêche pas leurs poses et matériaux indépendants.

Régénération avec Blender 5.1.1 :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python eredita3D/scripts/prepare_lupu.py
```

Vérification : `npm run test:lupu`. Mesures et empreinte : `../logs/lupu-validation.json`. Scène : `lupu_mannaru.blend`. Export : `../exports/lupu_mannaru.glb`. Aperçus : `../previews/lupu_repos.png`, `lupu_quatre_pattes.png`, `lupu_debout.png`, `lupu_griffe_droite.png`, `lupu_griffe_gauche.png` et `lupu_mort.png`.
