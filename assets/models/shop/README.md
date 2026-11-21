# Modèles de boutique

La version actuelle utilise les [20 nouveaux modèles v2](v2/README.md),
avec le sanglier représenté par sa tête murale. L’âne `donkey.glb` et la barque
sont conservés. La pancarte est maintenant construite dans `js/shop-decor.js`.
Les générations précédentes ci-dessous sont conservées comme historique.

## Pancarte VINDUTU — version initiale

Modèle : `vindutu-sign.glb`, généré avec le plugin Tripo 3D à la demande du concepteur,
après son accord du 16 novembre 2026.

- Tâche : `001e493d-4946-427e-8fe5-7fcda7167f0b`, `text_to_model`.
- Modèle Tripo : P1 (`P1-20260311`), budget demandé 1 500 faces, PBR texturé.
- Génération : **40 crédits**. Aucune autre tâche facturée. **Total : 40 crédits**.
- Sources et reçu : `assets/shop/tripo-out/vindutu-sign-001e493d/`.
- Version web : 1 494 triangles, 698 712 octets, trois textures 512 × 512.
- Optimisation locale : `scripts/prepare-shop-sign.py`, Blender 5.1.1 ; aucun crédit Tripo.

La face du modèle est volontairement vierge. `js/shop-scene.js` l'oriente vers
la caméra et superpose le texte exact VINDUTU. Les instances partagent leur
géométrie et leurs textures. La pancarte apparaît uniquement pour un article
épuisé dans le village affiché ; elle ne porte aucune logique économique.

Exemple de préparation depuis la racine :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-shop-sign.py -- \
  assets/shop/tripo-out/vindutu-sign-001e493d/model.glb \
  assets/models/shop/vindutu-sign.glb
```


## Animaux de boutique — première passe du 17 novembre 2026

Deux modèles indépendants générés avec Tripo P1 (`tripo-p1` → `P1-20260311`),
`text_to_model`, PBR, limite demandée 5 000 faces, sans conversion distante.

| Animal | Fichier web | Triangles | Taille | Tâche | Crédits |
| --- | --- | ---: | ---: | --- | ---: |
| Âne | `donkey.glb` | 4 698 | 3 762 900 octets | `672760ed-f236-410c-9d7e-eeb4346ebe48` | 40 |
| Sanglier | `boar.glb` | 4 938 | 3 741 988 octets | `b8ef5922-5dc4-4265-b133-a6a1a30c568b` | 40 |

**Total de cette passe : 80 crédits. Solde vérifié après génération : 840 crédits.**
Les sources, aperçus et reçus sont dans `assets/shop/tripo-out/shop-donkey-672760ed/`
et `assets/shop/tripo-out/shop-boar-b8ef5922/`. Aucun autre traitement Tripo facturé.

Les prompts demandent un animal corse seul, debout, proportions naturelles, quatre
pattes séparées, pelage PBR peint avec détails réalistes, aucun socle/décor/texte.
L’âne possède un pelage gris-brun, un museau ivoire, de longues oreilles et un licol
en cuir ; le sanglier un pelage brun sombre hérissé et de petites défenses ivoire.
Les prompts complets figurent dans les reçus `task.json`.

`scripts/prepare-shop-animal.py` conserve la géométrie et plafonne localement les
trois textures de chaque modèle à 1 024 pixels dans Blender. Exemple :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-shop-animal.py -- \
  assets/shop/tripo-out/shop-boar-b8ef5922/model.glb assets/models/shop/boar.glb
```

Leur axe longitudinal source est X, la tête vers +X. La boutique applique une
rotation Y de −1,35 rad (âne) et −1,12 rad (sanglier), puis normalise le modèle
dans son emplacement. Ils restent distincts et raycastables, et ne changent
pas la logique des animaux du plateau.
