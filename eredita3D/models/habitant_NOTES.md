# Habitant sans métier — préparation du modèle fourni

Source : `medieval warrior 3d model.glb` (fichier original conservé).

La copie `habitant.glb` conserve la tenue, les couleurs et les UV du modèle fourni. Le maillage est simplifié à 15 999 triangles, les trois textures sont réduites à 1024 × 1024, et les bras sont abaissés de la T-pose vers une pose au repos, sans squelette ni animation ajoutés. Le personnage mesure 1,80 m, pieds à Y=0, face vers +Z en glTF. Le matériau est opaque.

`habitant-sprite.png` est un rendu trois-quarts transparent de 512 × 512 pixels, corps entier, destiné au plateau 2D ou aux portraits. Les trois fichiers `preview_*.png` servent au contrôle visuel. `summary.json` contient les caractéristiques et la vérification du GLB final.

Pour reproduire (Blender 5.1.1 ; adapter les chemins) :

```sh
blender --background --factory-startup --disable-autoexec --threads 4 \
  --python prepare_villager.py -- \
  --source "/chemin/medieval warrior 3d model.glb" \
  --output-dir "/chemin/sortie"
```

Le script écrit uniquement dans le dossier de sortie indiqué. Le GLB de jeu est `assets/models/habitant.glb` ; le sprite WebP est `assets/generated/habitant-v1.webp`. La validation du fichier intégré est enregistrée dans `eredita3D/logs/habitant-validation.json`.

L’intégration est contrôlée avec `npm run test:villager` (ordinateur, mobile simulé, métiers, missions, équipements, transports, sélection et libération des ressources). Les performances sur Meta Quest 3 restent à mesurer sur le casque.

Cette préparation utilise des opérations locales sur le fichier fourni, sans génération externe ni service payant. Le modèle original ne contient pas de rig ni de clips d’animation ; toute animation de marche nécessiterait une étape supplémentaire.
