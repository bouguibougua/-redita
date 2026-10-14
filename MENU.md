# Accueil cinématographique Eredità

Refonte du 14 octobre 2026. Le site utilise toujours HTML, CSS et JavaScript,
sans framework ni dépendance supplémentaire. Aucun coût, statistique, timer ou
règle de jeu n'a été modifié.

## Structure et navigation examinées

| Fichiers | Fonction |
| --- | --- |
| `index.html`, `css/style.css`, `css/cards.css`, `css/decks.css` | Interface, préparation, partie et decks |
| `js/network.js` | Menu, sous-menus, formats, entraînement, local et salons |
| `js/game.js`, `js/game-view.js`, `js/ui.js` | Simulation, commandes partagées et interface |
| `js/config.js` | Valeurs centralisées, section `menu` pour cette présentation |
| `js/board3d.js`, `js/vendor/` | Plateau et copie locale de Three.js r186 |
| `js/xr*.js` | Plateau en réalité mixte, contrôleurs, placement et fenêtres |
| `js/audio.js` | Musiques existantes, coupure du son |
| `js/decks.js`, `js/tutorial.js` | Decks sauvegardés et tutoriel scénarisé |
| `server.js`, `tests/` | Serveur réseau et validation |

Il n'y a pas de routeur : `Network.init()` conserve les handlers des boutons
`data-menu-screen` et `data-open-xr`. JOUER ouvre les formats et le choix
Multijoueur/Entraînement ; DECKS ouvre le constructeur existant ; TUTORIEL lance
son parcours guidé ; RÉALITÉ MIXTE ouvre le dialogue du plateau existant.

## Présentation et animations

`css/menu.css` remplace uniquement la présentation de l'accueil. Le grand logo
fourni reste une image transparente, avec des textes en Georgia, filets et
losanges dorés. Les sous-menus conservent leurs commandes.

`js/menu-scene.js` possède son propre renderer Three.js :

- à l'ouverture, cadrage plat conservant la composition de la référence, sans
  étirement de l'image ; léger mouvement au passage de la souris ;
- glissement de souris ou **Explorer le panorama** : sphère retournée vue de
  l'intérieur, rotation libre sur 360° et inclinaison bornée avant les pôles ;
- **Recentrer le décor** : retour au cadrage de référence ;
- déformation locale légère du drapeau, scintillement et lumière chaude du
  brasero droit, brume et 55 braises ;
- **Animations : en pause**, préférence système de mouvement réduit et coupure
  du son ; repli vers la photographie fixe si WebGL échoue.

Le rendu desktop est limité à 30 images/s, le ratio de pixels à 1,5, sans ombres
ni post-traitement. En VR, WebXR fixe la cadence et la résolution de framebuffer
utilise un facteur de 0,85. L'animation du menu s'arrête hors des menus ; le
plateau caché évite son dessin tout en conservant l'horloge de simulation.
Les performances natives restent à mesurer sur Quest.

## Sources et projection

Les deux PNG fournis ont été copiés tels quels :

- `assets/menu-360.png` : **1774 × 887**, panorama des ruines ;
- `assets/eredita-logo.png` : **564 × 135**, logo avec transparence.

La texture n'est pas inversée : le drapeau est à gauche et le brasero à droite
dans le cadrage initial. Le ratio est 2:1, adapté à une projection
équirectangulaire, mais l'illustration ne garantit pas un relevé sphérique exact.
La couture arrière reste perceptible et les pôles étirent les pierres/nuages.
Le ciel et le sol ne sont pas reconstruits artificiellement. En VR, inspecter
le raccord derrière soi et les pôles ; une source 360° réellement raccordée
pourra remplacer ce PNG sans modifier les commandes du jeu.

`assets/menu-animated.gif` est une boucle du décor, exportée avec les mêmes
effets. Le site anime le PNG directement pour garder une image nette et une
navigation VR fluide. Le GIF reste un livrable séparé.

## Menu VR et passage au plateau

**Menu en VR** demande une session `immersive-vr`, distincte du `immersive-ar`
du plateau. `js/menu-vr.js` affiche un panneau stable devant le joueur, avec
le logo et les commandes reliées aux boutons HTML. Les deux contrôleurs
possèdent un rayon ; survol doré et gâchette pour sélectionner. A/B sont
reconnus uniquement pour les profils Touch compatibles. Les listes longues
sont paginées et le panneau possède Retour, Recentrer et Quitter VR.

Les decks peuvent être parcourus au casque ; les illustrations détaillées et
la saisie avancée restent dans le constructeur web. Le code d'un salon se
saisit dans Quest Browser. L'entraînement, le local, le tutoriel et le passage
au plateau terminent le menu VR avant d'activer leur destination existante.
Le tutoriel conserve son interface classique conformément au Game Design.
Pour le plateau, choisir ensuite Réalité mixte et confirmer son dialogue :
aucune deuxième session immersive n'est demandée automatiquement.

Les sessions nécessitent HTTPS ou localhost et une activation explicite de
l'utilisateur : [spécification WebXR](https://www.w3.org/TR/webxr/).
Le rendu utilise le gestionnaire natif de
[Three.js](https://threejs.org/docs/#WebXRManager).

## Exécution et GitHub Pages

```sh
npm start
# Ouvrir http://localhost:8765
npm test
npm run test:xr
npm run test:menu
npm run test:xr-browser
npm run menu:gif
```

Le projet est statique : aucune compilation/bundler n'est nécessaire.
Les fichiers HTML/CSS/JS sont servis directement. L'export GIF utilise Chrome
et Swift/ImageIO sur macOS, sans ajouter de dépendance. `EREDITA_BROWSER`
peut indiquer le chemin d'un Chromium pour les nouveaux tests du menu.

Les chemins d'assets, de feuilles CSS et d'imports sont relatifs. Le nouveau
test navigateur sert le dépôt sous **`/-redita/`**, comme GitHub Pages,
et vérifie les ressources et les interactions. GitHub Pages peut héberger
l'accueil, les decks, le tutoriel, le solo, le local et WebXR en HTTPS.
Les salons nécessitent toujours le serveur WebSocket Node existant : Pages
seul ne fournit pas de serveur réseau. Aucune publication n'a été effectuée.

Validation effectuée : `npm test`, `npm run test:xr`,
`npm run test:xr-browser`, les deux tests du menu et la vérification de syntaxe
des scripts modifiés passent. Le navigateur utilise le vrai WebGL, avec un
serveur statique sous `/-redita/` ; le cycle du menu VR utilise des sessions
simulées. Le GIF a été vérifié : **72 images, 6 secondes, boucle infinie,
960 × 480, environ 3,1 Mo**.

## Validation physique Quest 3

Aucun casque n'est disponible pour cette validation. À effectuer dans
Meta Quest Browser, sur l'adresse HTTPS du site :

- tourner la tête sur 360°, regarder en haut/en bas, inspecter orientation,
  couture arrière, netteté du logo et absence de translation inconfortable ;
- viser chaque entrée avec chaque contrôleur, vérifier survol et gâchettes,
  puis A/B, Retour, pagination des decks et Recentrer ;
- refuser la permission VR puis réessayer ; quitter par le menu puis par le
  système et rentrer plusieurs fois sans rayon ou panneau dupliqué ;
- vérifier pause des animations, perte/rétablissement du suivi et
  déconnexion/reconnexion des contrôleurs, sans sélection fantôme ;
- quitter le menu VR, ouvrir le plateau en réalité mixte, vérifier passthrough,
  placement et préparation sans changer la simulation ;
- vérifier le tutoriel classique, la saisie d'un salon et le retour aux decks ;
- mesurer la fluidité et le confort pendant plusieurs minutes, idéalement avec
  les outils de performance Quest. Ajuster `Config.menu` si nécessaire.

La checklist complète du plateau reste dans `QUEST3.md` et `MR_INTERFACE.md`.
