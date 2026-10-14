# Introduction artistique Eredità

Séquence de présentation ajoutée le 15 octobre 2026. Le projet reste en HTML,
CSS et JavaScript, avec Canvas 2D natif et les dépendances déjà présentes.

Le logo retrouvé et utilisé par l’accueil est **`assets/eredita-logo.png`**,
2172 × 724. L’introduction charge directement ce même fichier. Il n’est ni
réécrit, ni régénéré, ni remplacé par du texte. Son ratio et son alpha sont
conservés. Empreinte SHA-256 à l’intégration :
`b944c36b1a2f5d70ecc43dde20d7ae384a84adda8f8b7ab8e7531b65bf286385`.

## Déroulement

| Temps | Composition |
| --- | --- |
| 0–1 s | Fond presque noir, poussières lumineuses lentes |
| 1–3 s | Pinceaux azur, turquoise, violet, carmin, orange et filaments or |
| 3–4,5 s | Arabesques resserrées derrière le logo, grains dorés dans les encres |
| 4,5–6 s | Révélation du vrai PNG par un masque fibreux, reflet métallique chaud |
| 6–7 s | Logo net, immobile, sans filtre ; disparition des dernières traces |

Le passage au menu ajoute une transition de 450 ms ; un passage manuel dure
160 ms. L’utilisateur peut cliquer/toucher n’importe où, utiliser le bouton
**Passer l’introduction**, ou appuyer sur une touche. Les modificateurs seuls
ne passent pas la séquence. Les clics de passage n’activent pas les boutons
placés sous l’introduction.

## Architecture

- `js/intro-paint.js` : rendu autonome. Courbes de Bézier ouvertes, largeurs
  variables, pointes effilées, contours irréguliers, lavis transparents,
  veinures et texture de granulation procédurale. Les grains dorés suivent
  les gestes de peinture. Aucun anneau de particules ou géométrie tournante.
- `js/intro.js` : chargement du PNG, horloge, relance, clavier/tactile,
  mouvement réduit, gestion du focus et retour au menu.
- `css/intro.css` et `#game-intro` : couche d’introduction indépendante.
- `Config.intro` : durée, phases, palette, limites de résolution et cadence.

Pendant la révélation, le masque est appliqué avec `destination-in` sur une
copie de rendu du PNG : il n’altère pas les pixels du fichier. Le reflet utilise
le même alpha pour rester dans les lettres. Dès 6 s, le PNG est dessiné
directement, sans masque supplémentaire ni reflet. La dernière image est
comparée pixel par pixel au rendu direct du fichier original dans le test.

Le rendu du décor du menu s’arrête pendant l’intro et reprend pour la transition.
L’introduction ne change aucune route, commande ou état de la partie. Les
éléments situés derrière elle deviennent temporairement `inert` ; leur état
précédent est restauré, et le focus revient au menu. Elle se joue au chargement
de la page, avant toute demande de session immersive. Une relance est refusée
pendant une partie, dans un sous-menu ou en VR.

Le ratio de pixels est plafonné à 1,5 et le grand côté à 1920 pixels ; la cadence
cible est de 60 images/s sur ordinateur et 30 sur mobile. Les canvas temporaires
sont libérés à la fin. Une page masquée suspend le temps de l’intro. Ces plafonds
ne garantissent pas la cadence sur tous les appareils : mesure physique mobile
et Quest Browser encore nécessaire.

## Accessibilité et replis

Avec `prefers-reduced-motion: reduce`, le logo complet reste statique pendant
0,8 s, puis le menu apparaît sans transition animée. Aucun ruban ou grain ne
bouge. Un changement vers cette préférence pendant la séquence l’interrompt.

Si Canvas 2D est indisponible, le PNG statique sert de repli. Si le logo ne charge
pas ou dépasse quatre secondes de chargement, l’intro libère le menu. Le
chargement tardif après un passage ne peut pas rouvrir l’introduction.

## Relancer et inspecter

- **F9**, depuis le menu principal : rejouer la séquence.
- Recharger la page : lecture complète.
- `/-redita/?intro=0` : ouvrir directement le menu, utile pour les autres tests.
- `/-redita/?intro=preview&intro-time=4.9` : figer une image de l’intro.
- Console : `Eredita.Intro.replay()`, `Eredita.Intro.seek(3.9)`,
  `Eredita.Intro.resume()`, `Eredita.Intro.skip()`.
- Diagnostic : `Eredita.Intro.diagnostics`.

Les chemins CSS, JS et PNG restent relatifs, compatibles avec GitHub Pages.
Aucun bundler ou étape de compilation n’est nécessaire.

## Vérifications

```sh
npm run test:intro
npm run test:menu
npm run test:xr
npm run test:xr-browser
```

`test:intro` utilise Chrome/Chromium et vérifie la lecture complète, la pose
finale identique au PNG, le passage par souris/clavier/tactile, le focus,
les relances, le repli Canvas/asset, le mouvement réduit sur écran 390 × 844
et les chemins `/-redita/`. Pour conserver ses captures :

```sh
EREDITA_INTRO_PREVIEW_DIR=/tmp/eredita-intro npm run test:intro
```

À vérifier physiquement : fluidité sur le téléphone cible, rotation de l’écran,
reprise après changement d’onglet, puis accès normal au menu et aux sessions VR
dans Quest Browser. La séquence n’entre pas elle-même en session immersive.
