# Accueil cinématographique Eredità

Refonte du 14 octobre 2026. Le site utilise toujours HTML, CSS et JavaScript,
sans framework ni dépendance supplémentaire. Aucun coût, statistique, timer ou
règle de jeu n'a été modifié.

Le logo de l’accueil se révèle directement à sa place de gauche à droite en
1,5 seconde, sur le décor du menu. Les boutons restent utilisables pendant
l’animation. F9 au menu permet de rejouer ; le mouvement réduit affiche
immédiatement le logo statique. Architecture, paramètres et tests :
[INTRO.md](INTRO.md). Le menu et ses destinations conservent leur présentation.

## Structure et navigation examinées

| Fichiers | Fonction |
| --- | --- |
| `index.html`, `css/style.css`, `css/mythology.css`, `css/play.css` | Interface, préparation, partie, légendes et choix de partie |
| `js/network.js` | Menu, sous-menus, formats, entraînement, local et salons |
| `js/game.js`, `js/game-view.js`, `js/ui.js` | Simulation, commandes partagées et interface |
| `js/config.js` | Valeurs centralisées, section `menu` pour cette présentation |
| `js/board3d.js`, `js/vendor/` | Plateau et copie locale de Three.js r186 |
| `js/xr*.js` | Plateau en réalité mixte, contrôleurs, placement et fenêtres |
| `js/audio.js` | Musiques existantes, coupure du son |
| `js/mythology-ui.js`, `js/tutorial.js` | Grimoire des légendes et tutoriel scénarisé |
| `server.js`, `tests/` | Serveur réseau et validation |

Il n'y a pas de routeur : `Network.init()` conserve les handlers des boutons
`data-menu-screen` et `data-open-xr`. JOUER ouvre les formats et le choix
Multijoueur/Entraînement ; LÉGENDES ouvre le grimoire ; TUTORIEL lance
son parcours guidé ; RÉALITÉ MIXTE ouvre le dialogue du plateau existant.

## Présentation et animations

Le grimoire des légendes réutilise le fond de bibliothèque
(`assets/deck-library.webp`, provenance et prompt dans
[`assets/deck-library-source.md`](assets/deck-library-source.md)). Il présente
les seize légendes, leurs pouvoirs et leurs histoires depuis le catalogue unique.
Les cristaux permettent de basculer entre récit et pouvoir, avec les animations
facultatives et le mode de mouvement réduit décrits dans [MYTHOLOGY.md](MYTHOLOGY.md).
L’ancien constructeur de decks et ses fichiers sont supprimés.

L’onglet Jouer est habillé comme une armurerie, avec son propre fond optimisé
`assets/play-armory.webp` et ses styles isolés dans `css/play.css`. Trois panneaux
identiques présentent Format, Multijoueur et Entraînement, avec des libellés
courts. Le format propose 2 camps puis 4 camps ; les deux cartes de mode sont
entièrement cliquables. La sélection de format conserve son état et reste synchronisée
avec l’écran multijoueur. Les panneaux s’empilent sur mobile et le contenu
défile sur les petits écrans. Le fond, créé avec imagegen, est documenté dans
[`assets/play-armory-source.md`](assets/play-armory-source.md). Les commandes
de préparation, de local et de salons restent celles de `js/network.js`.
L’écran multijoueur reprend le fond d’armurerie et se trouve au-dessus du décor
du menu (z-index 130, contre 110 pour le décor). Retour ferme le salon et remet
le réseau en attente pour permettre un autre choix. `npm run test:play` vérifie
les dimensions des trois panneaux, les pixels visibles d’un bouton multijoueur,
les clics réels, le clavier, le mobile, l’annulation d’un salon et une connexion
hôte/invité sur le vrai serveur local.

Les effets d’interface utilisent les WAV fournis par le concepteur dans
`assets/audio/interface/` : page lors de la consultation d’une légende,
épée sur les boutons du menu principal, de l’armurerie
et du multijoueur. Les boutons Retour jouent l’épée inversée, avec priorité sur
le son d’épée normal : un seul effet par activation. Les retours HTML sont
repérés par `data-ui-back` ; les retours VR utilisent la même source sonore.
Les boutons désactivés restent silencieux. Le bouton Son arrête aussi les effets en cours. `Config.audio`
centralise les sources, volumes et la limite de lectures simultanées.
`npm run test:audio` vérifie les vrais fichiers audio dans le navigateur,
la sourdine et le tactile ; il compare aussi les échantillons des deux sons inversés.
Les textes du menu principal, des sous-menus et de la connexion ne se
sélectionnent pas à la souris ou au toucher. Les champs de recherche et de code
conservent la sélection du texte et l’édition.

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

Le menu conserve sa composition, avec un drapeau retouché selon la référence :
tête noire tournée vers la gauche, bandeau blanc sur les yeux. L’exploration
panoramique utilise un décor distinct de Bonifacio depuis les remparts,
avec falaises calcaires et mer à gauche, citadelle à droite. Le logo fourni
reste en haute résolution :

- `assets/menu-360.png` : **1774 × 887**, accueil avec le drapeau corrigé ;
- `assets/panorama-360.png` : **1774 × 887**, Bonifacio avec terrasse pavée ;
- `assets/eredita-logo.png` : **2172 × 724**, nouveau logo fourni, détouré avec
  imagegen et vérifié dans le rendu web.

La texture n'est pas inversée : le drapeau est à gauche et le brasero à droite
dans le cadrage initial. Le ratio est 2:1, adapté à une projection
équirectangulaire, mais l'illustration ne garantit pas un relevé sphérique exact.
Le raccord arrière et l’étirement des pierres/nuages aux pôles doivent être
inspectés au casque sur cette illustration générée.
Un sol pavé 3D complète la texture sous les pieds **en mode panorama seulement**.
La texture `assets/vr-stone-floor.png` apporte un pavage détaillé sur un disque
de 3 m de rayon, avec un bord fondu pour conserver la vue sur la mer.
Un autel en pierre avec corniche et ornements bronze est visible à l’exploration.
En partie, sa dalle supérieure suit précisément le dessous du plateau, sa
position, sa hauteur, sa rotation et sa taille. Il disparaît avec le décor en
passthrough. Cet autel est visuel et ne crée aucun bâtiment ou règle de jeu.
Le prompt et la provenance sont conservés dans `assets/menu-360-source.md`. En VR, inspecter
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

Le grimoire et les renforts en partie restent dans l’interface HTML de
Quest Browser ; ils ne sont pas projetés dans les panneaux immersifs. Le code d'un salon se
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
l'accueil, les légendes, le tutoriel, le solo, le local et WebXR en HTTPS.
Les salons nécessitent toujours le serveur WebSocket Node existant : Pages
seul ne fournit pas de serveur réseau. Aucune publication n'a été effectuée.

Validation effectuée : `npm test`, `npm run test:xr`,
`npm run test:xr-browser`, les deux tests du menu et la vérification de syntaxe
des scripts modifiés passent. Le navigateur utilise le vrai WebGL, avec un
serveur statique sous `/-redita/` ; le cycle du menu VR utilise des sessions
simulées. Le GIF a été vérifié : **72 images, 6 secondes, boucle infinie,
960 × 480**, avec le drapeau corrigé de l’accueil.

## Palette commune et ambiance en partie

`css/theme.css` centralise le noir chaud, bronze, or et ivoire pour préparation,
jeu, boutique, grimoire, tutoriel, dialogues et réalité mixte.
`XRDesign.theme()` lit ces mêmes variables pour les textures des fenêtres XR.
Les couleurs sémantiques des camps et des biomes restent distinctes.

La musique de combat commence dès le lancement de la préparation, y compris
sur l’invité réseau ; la fin de la préparation ne la relance pas.
`js/xr-environment.js` ajoute un décor indépendant du plateau. Le placement
montre la pièce ; le panorama apparaît progressivement dès la préparation.
**Voir ma pièce / Afficher le décor corse** permet de basculer en session.
Le sol utilise `local-floor` ou une hauteur temporaire configurable, avec repli
transparent si le chargement du panorama échoue. Ce décor n’ajoute ni lumière
dynamique ni ombre ou post-traitement ; ses ressources sont libérées à la sortie.

## Validation physique Quest 3

Aucun casque n'est disponible pour cette validation. À effectuer dans
Meta Quest Browser, sur l'adresse HTTPS du site :

- tourner la tête sur 360°, regarder en haut/en bas, inspecter orientation,
  couture arrière, netteté du logo et absence de translation inconfortable ;
- viser chaque entrée avec chaque contrôleur, vérifier survol et gâchettes,
  puis A/B, Retour, pagination des menus et Recentrer ;
- refuser la permission VR puis réessayer ; quitter par le menu puis par le
  système et rentrer plusieurs fois sans rayon ou panneau dupliqué ;
- vérifier pause des animations, perte/rétablissement du suivi et
  déconnexion/reconnexion des contrôleurs, sans sélection fantôme ;
- quitter le menu VR, ouvrir le plateau en réalité mixte, vérifier passthrough,
  placement et préparation sans changer la simulation ;
- vérifier le tutoriel classique, la saisie d'un salon et le retour au grimoire ;
- mesurer la fluidité et le confort pendant plusieurs minutes, idéalement avec
  les outils de performance Quest. Ajuster `Config.menu` si nécessaire.

La checklist complète du plateau reste dans `QUEST3.md` et `MR_INTERFACE.md`.
