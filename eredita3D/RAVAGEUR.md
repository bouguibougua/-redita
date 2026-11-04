# Ravageur et hache fournis

Les sources `/Users/robin/Downloads/ravageur 3d.glb` et `/Users/robin/Downloads/hache 3D.glb` restent intactes. Leurs empreintes figurent dans `logs/ravageur-validation.json`.

Le GLB de jeu `../assets/models/ravageur.glb` conserve le corps et le squelette fournis : 9 399 triangles. La hache est réduite de 1 910 774 à 2 200 triangles, ses UV et textures sont conservés. Les textures sont réduites à 1 024 pixels et empaquetées dans le GLB et le fichier Blender. L’asset complet compte 11 599 triangles et 81 joints.

Le mesh `Hache_Fournie` utilise uniquement l’os `axe`, enfant de `hand_r`. L’arme reste rigide pendant les animations et les doigts sont repliés pour la prise. Les clips sont `Repos` (2 s), `Marche` (1 s), `Coup_Hache` (1 s, lecture adaptée à 0,8 s dans le jeu) et `Mort` (1,8 s). La simulation conserve ses déplacements, dégâts, bonus et cadences. Le modèle normal du Ravageur est remplacé ; les modèles des légendes restent prioritaires.

Le fichier éditable est `models/ravageur.blend`. Il contient les deux modèles, les matériaux et les animations ; les textures sont empaquetées. Les poses de contrôle sont dans `previews/ravageur-*`.

## Régénérer avec Blender 5.1

Depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_ravager.py -- --source "/Users/robin/Downloads/ravageur 3d.glb" --axe "/Users/robin/Downloads/hache 3D.glb" --output-dir /private/tmp/eredita-ravager
```

Copier `ravageur.glb` vers `assets/models`, le sprite vers `assets/generated/ravageur-v1.png`, puis actualiser l’empreinte dans `Config.characterModels.ravager`. Le script ne modifie pas automatiquement le projet.

## Vérifier

`npm run test:ravager` vérifie les sources chargées, la liaison rigide de la hache, les clips, les poses indépendantes, la pause, les statistiques existantes, le portrait, les équipements, les transports et le nettoyage. `npm test` vérifie les règles et le multijoueur. Les performances sur Quest physique restent à mesurer.
