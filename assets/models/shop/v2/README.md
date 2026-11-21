# Boutique v2 — modèles indépendants

Les 20 modèles de cette version remplacent les articles de la boutique, à
l’exception de l’âne et de la barque dont les fichiers sont conservés octet pour
octet. Le sanglier est uniquement une tête montée sur un support mural.

Génération : Tripo P1 (`tripo-p1` → `P1-20260311`), PBR texturé, une étape par
article, sans rig ni conversion distante. Le concepteur a validé explicitement
le budget de 800 crédits. Aucun nouvel essai payant n’a été effectué.

| Ordre | Modèle | Tâche | Étape | Crédits réels | Triangles web |
| ---: | --- | --- | --- | ---: | ---: |
| 1 | Chien | `30942970-cc0a-4533-a05a-a6ee3bb02ab0` | `text_to_model` | 40 | 4,923 |
| 2 | Tête de sanglier murale | `855f2ce5-81a5-4b1a-b87a-8c3bd27089ec` | `text_to_model` | 40 | 4,915 |
| 3 | Vache | `c2c25b03-ea11-477e-b8e8-3d118c91395b` | `text_to_model` | 40 | 4,758 |
| 4 | Chèvre | `fdc38bcc-c01b-4ae2-a986-4d8e4f903b9b` | `text_to_model` | 40 | 4,914 |
| 5 | Cochon | `0103eed3-c33b-479a-b332-0d43e4a92b9c` | `text_to_model` | 40 | 5,116 |
| 6 | Armes et outils en pierre | `743ffea1-1743-4a8c-9fe7-64b8ca63b3ea` | `text_to_model` | 40 | 4,014 |
| 7 | Armes et outils en bronze | `4b6bb8e8-531a-45c9-b91e-a70a71fb7516` | `text_to_model` | 40 | 3,832 |
| 8 | Armes et outils en fer | `4e0a0f23-5138-4d4d-abcc-8fda802a9072` | `text_to_model` | 40 | 3,793 |
| 9 | Armure de cuir | `d836b553-2403-4094-9ba9-1580f3f591a3` | `text_to_model` | 40 | 4,446 |
| 10 | Cotte de mailles | `48d2b262-bcbc-44fe-82d1-2e385036eec8` | `text_to_model` | 40 | 4,722 |
| 11 | Armure de fer | `0838613e-2314-4f57-87b9-65da3d9d67cb` | `text_to_model` | 40 | 4,404 |
| 12 | Filet de pêche | `9220441d-2e4a-4391-93a8-c7ee17517e84` | `text_to_model` | 40 | 7,762 |
| 13 | Piège de chasse | `f3f3f1da-cc98-456f-9f4a-5a343c8f6750` | `text_to_model` | 40 | 3,730 |
| 14 | Piège défensif | `598529f0-9818-4f7b-89f9-5ac9f409cdd5` | `text_to_model` | 40 | 3,910 |
| 15 | Panier de blé | `c0742546-ebcc-48f2-a3c6-7e5d17e0a594` | `text_to_model` | 40 | 5,200 |
| 16 | Panier de châtaignes | `74a17091-308b-4995-97d0-de26083d23a3` | `text_to_model` | 40 | 4,566 |
| 17 | Panier de raisin | `2e3925cc-3664-406b-afc0-0660dfa34547` | `text_to_model` | 40 | 4,592 |
| 18 | Panier de viande | `31261e0c-01c2-4645-a5b5-bf80e43de7aa` | `text_to_model` | 40 | 4,462 |
| 19 | Panier de poisson | `99d6aa30-de02-46b8-b328-adcead25b44c` | `text_to_model` | 40 | 4,584 |
| 20 | Panier de lait | `2a9da0b8-208a-4c81-84e0-3e5649653462` | `text_to_model` | 40 | 4,364 |

**Total facturé : 800 crédits. Solde vérifié après génération : 40 crédits.**

Les noms de fichiers sont les identifiants de boutique : `<id>.glb`. Sources,
aperçus et reçus complets : `assets/shop/remake-v2/tripo-out/`. Prompts et plans
validés : `assets/shop/remake-plan.json` et `BOUTIQUE_MODELES_PLAN.md`.

Préparation locale : `scripts/prepare-shop-remake.py` avec Blender. Couleurs
plafonnées à 1024 px, normales et rugosité à 512 px. Le filet généré contenait
un fond gris indésirable ; ses faces ont été retirées localement à partir de
leur couleur/UV. Ses cordes et nœuds intérieurs ont été reconstruits en volume
pour obtenir des mailles ouvertes, sans nouvelle tâche Tripo. Les sources sont conservées.
Les dimensions, rotations, bases des animaux et paniers se règlent dans
`Config.shopScene`. Les géométries de décor et la pancarte sont locales dans
`js/shop-decor.js`, sans crédit additionnel.

Empreintes conservées :

- Âne : `e643ce412246759b8d35a007f3e6ea7e92307584e3882b68bdbc1c185ac3a7e7`.
- Barque : `e1ff6a2744b32c1754a7e3dfe2f7b24193fd976550c31609bee5c9d04a81a2b1`.
