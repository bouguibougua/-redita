# Modèles de village T2

Intégration des cinq GLB fournis. Chaque bâtiment remplace uniquement son apparence T2 ; l’amélioration du feu remplace aussi l’hôtel T1 par l’hôtel T2. Les coûts, PV, capacités, bonus, habitants et remparts conservent leurs règles.

## Correspondance confirmée par le concepteur

| Fichier fourni | Usage | Triangles | GLB prêt pour le jeu |
|---|---|---:|---:|
| artisanat T2 3d.glb | artisanat_t2 | 17,999 | 1059 Ko |
| bergerie T2 3d.glb | bergerie_t2 | 18,000 | 1049 Ko |
| campfire T2 3d.glb | feu_camp_t2 | 18,000 | 937 Ko |
| hotel T2 3d.glb | hotel_t2 | 18,000 | 1071 Ko |
| artisans T2 3d.glb | boucherie_t2 | 17,999 | 1051 Ko |

Les deux fichiers Artisanat/Artisans sont des forges différentes. Le concepteur a explicitement choisi `artisans T2 3d.glb` pour la Boucherie T2. Leurs fichiers d’origine restent inchangés.

## Régénérer

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python eredita3D/scripts/prepare_village_t2.py -- --source-dir /Users/robin/Downloads --output-dir /tmp/eredita-village-t2
```

Les versions optimisées Blender sont dans `models`, les aperçus dans `previews`, les empreintes des modèles source et du jeu dans `logs/village-t2-validation.json`. Les géométries sont réduites à 18 000 triangles, les textures à 1024 px. Les proportions et UV sont conservés. Les GLB prêts pour le jeu sont dans `assets/models` ; leurs rendus PNG dans `assets/generated`. Chaque URL de modèle possède une empreinte de version. Aucun service payant ni crédit Tripo n’est utilisé.

## Vérifier

```sh
npm run test:villages
npm test
npm run test:xr
```
