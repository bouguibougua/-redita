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


## Lion de Roccapina

Vidéo fournie : `gemini_generated_video_7d268ef3.mp4`, copiée sans réencodage en `lion-roccapina-motion.mp4`. Le grimoire la lit muette avec les règles de visibilité et de mouvement réduit existantes. Le poster `lion-roccapina.webp` (1280×720) est extrait à t=1s via AVFoundation puis converti en WebP dans Canvas. Le modèle fourni `Roccapina 3d.glb` est intégré séparément au plateau. Aucune génération nouvelle.


## U Mazzeru — tir à l’arc amélioré

Le clip `Tir` de `assets/models/mazzeru.glb` est refait localement par
`eredita3D/scripts/animate_mazzeru_attack.py`, après `prepare_mazzeru.py`.
Les deux bras sont résolus par cinématique inverse : montée de l’arc,
encoche, corde tirée vers la joue, visée, décoche et retour. Les pieds restent
plantés. Le clip dure 1,25 s et la décoche intervient à 0,75 s.
L’arc fourni est redressé ; le rendu ajoute une corde qui se tend, une flèche
en main et une lueur rouge brève, synchronisées avec le projectile réel.
Le logo de Mauvais Présage reste petit sous les pieds ; l’anneau d’équipe
et les pictogrammes d’équipement restent visibles autour.
Les originaux fournis ne sont pas modifiés. Aucune génération Tripo ou image
ni aucun crédit n’est utilisé. Rapport :
`eredita3D/logs/mazzeru-archery-validation.json`.


## Lupu, Mazzeru et Lion — fluidité et taille

Retouche locale dans Blender : `eredita3D/scripts/polish_legend_motion.py`.
À lancer après les préparations initiales et, pour Mazzeru, après
`animate_mazzeru_attack.py`. Le script reconnaît les modèles déjà retouchés
pour éviter de multiplier les amplitudes lors d’un second lancement.

- Taille visuelle augmentée de 10 %, réglée dans `Config.legendMotion`.
- Boucles de repos/marche raccordées ; interpolation sphérique des rotations
  et rééchantillonnage à 60 Hz pour les trois rigs.
- Lupu : foulées plus amples à quatre pattes, appuis au sol et levée progressive.
- Mazzeru et Lion : foulées plus amples ; garde du Lion moins raide.
- Fondus entre gestes de 0,16 s ; lecture par sous-pas pour les images longues.
- Textures originales conservées sans recompression ; aucun appel Tripo payant.

Rapport : `eredita3D/logs/legend-motion-polish.json`.
Aperçu comparatif : `eredita3D/previews/legends-fluid-motion.png`.
