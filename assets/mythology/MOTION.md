# Illustrations animées

## A Strega Bianca

Source fournie par le concepteur : `Enregistrement de l’écran 2026-10-20 à 20.21.25.mov`.
Le fichier original reste intact.

Le MP4 publié `a-stregha-bianca-motion.mp4` est associé uniquement à cette
légende dans `visuals.motion` du catalogue existant.

- H.264, 1024 × 586, 30 images/s constantes, sans piste audio.
- Boucle de 8,4 secondes, 252 images : aller-retour sans duplication des extrémités.
- Ralentissement progressif aux deux extrémités et interpolation par mélange
  des images voisines de l’enregistrement à cadence variable. Ce traitement
  ne recrée pas de détails ni de mouvement par flux optique.
- Débit cible 2,4 Mbit/s, environ 2,4 Mo. Index MP4 placé avant les images
  pour commencer la lecture sans attendre le téléchargement complet.
- Préparation hors application avec AVFoundation/Core Image de macOS ;
  aucune dépendance ajoutée au site.

## U Diavule

La source `u-diavulu.webp` reste intacte. Une planche de seize flammes peintes
`u-diavulu-flames.png` a été créée avec l’outil intégré image_gen, en suivant
son style graphique. Le prompt exact est conservé dans `u-diavulu-flames.json`.

`scripts/export-diavule-animation.js` compose ces flammes au creux de la main,
avec une lumière chaude et quelques braises, sans déformer le personnage ni
le décor. Les formes se mélangent progressivement ; la composition est
périodique sur quatre secondes pour une boucle continue.

- `u-diavulu-motion.gif` : GIF animé en boucle, 768 × 512, 15 images/s, 60 images.
- `u-diavulu-motion.mp4` : H.264, 960 × 640, 30 images/s, 120 images, sans audio.
- `u-diavulu-motion-poster.png` : première image de contrôle, 960 × 640.

Le menu réutilise le lecteur MP4 existant, ses flashs aller-retour, son arrêt
hors écran et son mode de mouvement réduit. Le GIF est fourni séparément.
La préparation utilise Canvas dans Chrome et AVFoundation/ImageIO de macOS,
comme l’export du menu, sans dépendance du site.

Les autres légendes peuvent recevoir leur animation dans le même champ
facultatif `visuals.motion`, sans changer le composant.
