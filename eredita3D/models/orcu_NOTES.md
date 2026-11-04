# L’Orcu — modèle fourni intégré

Source : `/Users/robin/Downloads/orc barbarian 3d model.glb`.
SHA-256 : `9b79e8bc4d1ebad9e85cdb7f45556c3decc848120781636c8d819d17173e0ffa`.
Le fichier source est uniquement lu ; son empreinte est vérifiée après préparation.

Le modèle fourni possède 10 501 triangles, un matériau, une texture couleur et un squelette. La topologie est conservée. La texture est réduite de 4096 × 4096 à 2048 × 2048 pour le plateau, puis embarquée dans le GLB. Le modèle canonique est centré sur ses pieds et normalisé à 1,80 m ; l’échelle de figurine et le facteur mythologique existant donnent une hauteur d’environ 1 unité de plateau pour L’Orcu.

La source ne contient aucun clip d’animation. Cinq animations simples ont été créées sur son squelette : `Repos`, `Marche`, `Frappe_Droite`, `Frappe_Gauche`, `Mort`. Les frappes utilisent les poings du modèle. Ces animations procédurales constituent une première version ; elles ne sont pas des mouvements capturés. Elles sont pilotées par les déplacements et séquences de combat existants, et se figent pendant la pause.

`js/orcu-model.js` utilise le chargeur GLTF et `SkeletonUtils` déjà présents dans le projet. Géométrie et texture sont partagées ; chaque invocation possède ses matériaux, son squelette et son mélangeur d’animation. Un cercle Rouge/Bleu identifie l’équipe. La teinte mythologique générique est écartée pour conserver les couleurs de la texture fournie ; les effets de dégâts restent visibles. Le modèle s’applique uniquement à `mythologyLegendId === 'l-orcu'`. Un personnage provisoire reste disponible pendant le chargement ou en cas d’échec.

Les 200 PV, 30 dégâts, vitesse 0,7 et conditions d’invocation proviennent toujours des règles existantes. Les événements visuels de mort conservent l’identité et l’échelle mythologiques, pour qu’un client puisse aussi représenter une mort reçue sans avoir affiché l’unité vivante auparavant.

Fichiers :

- `scripts/prepare_orcu.py` : préparation bpy et vérification de l’empreinte source.
- `scripts/inspect_orcu.py` : inspection du fichier fourni.
- `models/orcu.blend`, `models/orcu_source.blend`.
- `exports/orcu.glb`, copié dans `assets/models/orcu.glb` (2 236 360 octets).
- `textures/orcu/orcu_basecolor_2048.jpg`.
- `previews/orcu_repos.png`, `orcu_marche.png`, `orcu_attaque.png`, `orcu_mort.png`.
- `previews/orcu_in_game.png`, `orcu_death_in_game.png`.
- `logs/orcu-validation.json`, `orcu-build.log`, `orcu-browser-test.log`.

Régénérer avec Blender 5.1.1 en mode background :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_orcu.py
cp eredita3D/exports/orcu.glb assets/models/orcu.glb
```

`npm run test:orcu` vérifie les invocations réelles des deux équipes, les statistiques, la texture, la taille, les squelettes indépendants, la marche, les frappes, la pause, la chute, les événements de mort tardifs, le partage de géométrie et le repli de chargement. Le guerrier existant et les tests XR ont également été vérifiés. Aucun casque Quest 3 physique n’a été utilisé.
