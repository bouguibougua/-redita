# U Surpatore — nouveau modèle fourni

Source : `/Users/robin/Downloads/u surpatore 3d.glb`, laissée intacte.
SHA-256 : `b4398d72e6bcfe409fb021a4dfb6042d27a1faa71f7f985ef846e522e603bf2f`.

Le modèle de jeu utilise le squelette fourni (noms Unreal, doigts et os de torsion conservés). Un os `jaw` permet de garder la bouche fermée au repos et de l’ouvrir pendant la griffe. L’export comprend 81 joints, 8 156 triangles, un mesh et un matériau avec texture JPEG 2 048 px. La hauteur normalisée est de 1,80 m. Les textures sont empaquetées dans le GLB et dans le fichier Blender.

Clips : `Repos` (2 s), `Marche` (1 s, déplacement sur place), `Griffe` (1 s, adaptée à 0,9 s dans le jeu) et `Mort` (1,75 s, adaptée à la durée existante). Le mouvement de la griffe lève la main droite puis la rabat en travers du torse. Les doigts suivent le squelette fourni ; le manteau n’utilise pas de simulation physique.

Le GLB est utilisé uniquement pour `mythologyLegendId: u-surpatore` avec `mythologyForm: vampire`. Le sanglier initial reste visible jusqu’à sa mort et possède ensuite sa propre figurine de mort. La seconde forme conserve 40 PV, 11 dégâts et la vitesse déjà définie ; une seconde mort retire l’invocation. Aucun changement de règle économique ou de combat n’est ajouté.

Géométrie et textures sont partagées, matériaux et squelettes restent indépendants. La pause fige les animations. Le chargement simple sert de solution de secours.

## Régénérer avec Blender 5.1

Depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_surpatore.py -- --source "/Users/robin/Downloads/u surpatore 3d.glb" --output-dir eredita3D --asset-output assets/models/surpatore_vampire.glb
```

Le paramètre `--asset-output` est facultatif : sans lui, seules les sorties dans `--output-dir` sont écrites. Après régénération, actualiser l’empreinte de l’URL dans `Config.characterModels.surpatore`.

Le fichier éditable est `surpatore_vampire.blend`, les aperçus sont dans `../previews`, et les empreintes/mesures dans `../logs/surpatore-validation.json`.

Vérifier avec `npm run test:surpatore` et `npm test`. Le test navigateur contrôle aussi que le modèle chargé provient du nouveau fichier source, la transformation et les morts tardives reçues en réseau. Les performances sur Quest physique restent à mesurer.
