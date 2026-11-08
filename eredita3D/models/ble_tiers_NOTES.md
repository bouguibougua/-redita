# Blé — trois niveaux visuels

- T1 : `ble_petit.blend` — 3 rangées, 15 plants, 1 788 triangles.
- T2 : `ble_moyen.blend` — 5 rangées, 35 plants, 4 080 triangles.
- T3 : `ble_grand.blend` — 7 rangées, 63 plants, 7 284 triangles.

Même parcelle de 0,48 × 0,48 unité ; hauteur progressive. Chaque modèle utilise deux matériaux opaques avec couleurs de sommets, sans texture externe. Les géométries sont partagées en jeu et les matériaux restent propres à chaque instance.

Régénérer avec `npm run assets:ble` (Blender local + Chrome pour l’encodage WebP). Le script source est `eredita3D/scripts/create_ble.py`. Les sprites sont rendus à la même échelle et conservent leur transparence. Aucun prix, rendement, PV ni prérequis de culture n’est modifié. Les anciennes ressources V1 restent conservées pour compatibilité.
