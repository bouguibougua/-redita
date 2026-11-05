# Modèles de village T3 et Boucherie T2

Les cinq modèles T3 et le modèle dédié de Boucherie T2 sont ceux fournis par le concepteur. Le modèle T2 dédié remplace la forge utilisée provisoirement pour la Boucherie. Les commerces changent d’apparence à leur propre amélioration ; le feu et l’hôtel suivent le niveau du village. Les règles et valeurs du jeu sont inchangées.

| Fichier source | Modèle prêt pour le jeu | Triangles | Taille |
|---|---|---:|---:|
| artisanat T3 3d.glb | artisanat_t3 | 18,000 | 1013 Ko |
| bergerie T3 3d.glb | bergerie_t3 | 18,000 | 1013 Ko |
| boucherie T2 3d.glb | boucherie_t2 | 18,000 | 1048 Ko |
| boucherie T3 3d.glb | boucherie_t3 | 18,000 | 1030 Ko |
| campfire T3 3d.glb | feu_camp_t3 | 18,000 | 949 Ko |
| Hotel T3  3d.glb | hotel_t3 | 18,000 | 963 Ko |

## Régénérer

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python eredita3D/scripts/prepare_village_t3.py -- --source-dir /Users/robin/Downloads --output-dir /tmp/eredita-village-t3
```

Le nom source de l’hôtel est exactement `Hotel T3  3d.glb` (deux espaces après T3). `--only boucherie_t2` ou `--only feu_camp_t3` permet de régénérer un seul modèle. Les fichiers source restent inchangés. Les sources Blender optimisées sont dans `models`, les rendus dans `previews`, les mesures et empreintes dans `logs/village-t3-validation.json`.

Textures limitées à 1024 px, géométries à 18 000 triangles, proportions et UV conservés. Les textures et géométries sont partagées par le rendu ; les matériaux des villages sont indépendants. Les GLB sont dans `assets/models`, leurs images dans `assets/generated`. Les URL des GLB et de l’image corrigée de Boucherie T2 portent une empreinte de version. Aucun appel payant ni crédit Tripo.

## Vérifier

```sh
npm run test:villages
npm test
npm run test:xr
```
