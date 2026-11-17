# Pancarte VINDUTU

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
