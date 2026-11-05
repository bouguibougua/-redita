# Village T1 et remparts

Les cinq bâtiments/objets proviennent des GLB fournis dans Downloads. Les fichiers originaux ne sont jamais modifiés. Les remparts sont créés localement dans Blender à partir de la référence du concepteur. Aucun appel payant Tripo n’est utilisé.

## Régénérer

Blender 5.1.1 :

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python eredita3D/scripts/prepare_village_t1.py -- --source-dir /Users/robin/Downloads --output-dir /tmp/eredita-village
```

Le paramètre `--only feu_camp_t1` ou `--only remparts_t1 remparts_t2 remparts_t3` régénère seulement les objets indiqués. Copier ensuite les GLB dans `assets/models`, les PNG des cinq objets dans `assets/generated`, et mettre à jour les empreintes des URL de `Config.villageModels`.

## Fichiers prêts pour le jeu

| Modèle | Triangles | Taille GLB |
|---|---:|---:|
| artisanat_t1 | 7,830 | 585 Ko |
| bergerie_t1 | 6,724 | 553 Ko |
| boucherie_t1 | 18,000 | 1133 Ko |
| hotel_t1 | 17,999 | 1075 Ko |
| feu_camp_t1 | 18,000 | 1002 Ko |
| remparts_t1 | 2,652 | 194 Ko |
| remparts_t2 | 2,268 | 162 Ko |
| remparts_t3 | 2,268 | 162 Ko |

Textures limitées à 1024 px, UV conservés ; réduction des modèles très denses à 18 000 triangles. Le feu utilise deux matériaux chauds sur ses flammes. Les géométries et textures sont partagées entre villages, les matériaux de rendu restent indépendants. Les versions Blender optimisées sont dans `models`, les aperçus dans `previews`, les empreintes et mesures dans `logs/village-t1-validation.json`.

## Règles

Les remparts représentent les PV existants du village. Aucun PV, coût, bonus, collision ou déclencheur de victoire supplémentaire. Les habitants libres sont dans leur cour ; les emplacements restent devant. Le bouton du feu réutilise la commande réseau `upgrade` avec la cible `village`, les niveaux, coûts et bonus actuels. Les modèles T2 sont désormais intégrés ; voir `VILLAGE_T2.md`. Les commerces et l’hôtel T3 restent les représentations précédentes en attendant les GLB correspondants.

## Vérifier

```sh
npm test
npm run test:villages
npm run test:xr
npm run test:layout
```
