# Barque fournie

Source : `/Users/robin/Downloads/barque 3d.glb`, laissée intacte. Son empreinte figure dans `logs/barque-validation.json`.

Le modèle `../assets/models/barque.glb` conserve la coque, les bancs, les UV et la texture de bois du concepteur. Il passe de 9 838 à 5 000 triangles et sa texture est réduite à 1 024 pixels. L’export pèse environ 480 Ko. La longueur est de 0,58 unité, la largeur d’environ 0,276 et la hauteur de 0,143 ; le fond repose à zéro et la longueur suit +Z dans glTF.

`RowboatModel` partage géométrie et texture entre les barques ; chaque instance possède ses matériaux pour les effets d’impact. Le même modèle est utilisé sur le Littoral et pendant les traversées, y compris par le Chien. Le rendu de secours apparaît tant que le modèle n’est pas prêt ; la signature visuelle des unités entraîne leur actualisation au chargement. Le voilier conserve son modèle existant. Le sprite 2D provient du même GLB.

Aucune règle de prix, capacité, vitesse, réserve locale ou embarquement n’est modifiée.

## Régénérer avec Blender 5.1

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_rowboat.py -- --source "/Users/robin/Downloads/barque 3d.glb" --output-dir /private/tmp/eredita-rowboat
```

Copier le GLB vers `assets/models`, le sprite vers `assets/generated/barque-v1.png` et actualiser l’empreinte de l’URL dans `Config.transportModels.barque`. Le script n’installe pas automatiquement ses sorties. Le fichier Blender dans `models/barque.blend` contient le modèle et sa texture empaquetée.

`npm run test:rowboat` vérifie le modèle chargé, sa taille, les réserves, l’embarquement/débarquement, la vue 2D, le chargement tardif, les matériaux indépendants et le cache partagé. `npm test` vérifie les règles de transport et le multijoueur. Les performances sur Quest physique restent à mesurer.
