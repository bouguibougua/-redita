# Agriculteur et chasseur

Les sources du concepteur restent intactes. Les scripts utilisent Blender 5.1 localement, sans crédit Tripo.

- `assets/models/agriculteur.glb` : 18 000 triangles, 20 os, textures 1 024 px, 2,37 Mo. Repos, marche, récolte accroupie, frappe et mort.
- `assets/models/chasseur.glb` : 10 992 triangles, 23 os, textures 1 024 px, 1,68 Mo. Repos, marche, tir et mort. Arc en noyer, poignée en cuir, bagues, corde déformable et flèche inclus. Les poids fournis sont regroupés sur le squelette du jeu ; le carquois est fixé au buste.

Les fichiers Blender sont dans `models`, les aperçus dans `previews`, et les empreintes des sources et exports dans `logs/*-validation.json`.

## Régénérer

Depuis la racine du projet :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_farmer.py -- --source "/Users/robin/Downloads/fermier 3d.glb" --output-dir /private/tmp/eredita-farmer
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python eredita3D/scripts/prepare_hunter.py -- --source "/Users/robin/Downloads/chasseur 3d.glb" --output-dir /private/tmp/eredita-hunter
```

Copier les GLB dans `assets/models`, les sprites PNG dans `assets/generated` et actualiser les empreintes des URL dans `Config.characterModels`. Les scripts n’installent pas automatiquement leurs sorties.

## Fonctionnement

Géométrie et textures sont partagées ; matériaux et squelettes sont indépendants. Les équipements, transports, sélections, impacts et morts sont conservés. Le modèle simple assure le chargement de secours.

La récolte accroupie dépend uniquement de la tâche Agriculture pendant la phase `harvesting`. Aucun temps ou rendement économique n’est modifié.

La portée de 15 unités du métier Chasseur est centralisée dans `Config.combat.professionAttackRanges`. Elle concerne les troupes de la même ligne et le village ennemi. Dégâts et cadence restent inchangés. La position de cible enregistrée dans l’événement sert au projectile visuel et à l’orientation ; le réseau transmet cet événement. Le moteur applique les dégâts indépendamment du rendu. La pause fige les animations et les projectiles.

## Vérifier

```sh
npm test
npm run test:farmer
npm run test:hunter
npm run test:villager
npm run test:xr
```

Les tests couvrent les phases de travail, les pieds au sol, les poses indépendantes, la pause, l’équipement, les transports, la limite de portée, l’attaque/défense des deux camps, les tirs, les projectiles et le nettoyage. Les performances sur Quest physique restent à mesurer.
