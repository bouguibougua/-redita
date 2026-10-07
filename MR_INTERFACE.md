# Validation de l’interface spatiale Eredità

## Ergonomie VR — 7 octobre 2026

Après placement, les menus sont droits face au regard. Choisir une partie utilise de grands boutons centrés et un accès « Quitter le mode VR ». La préparation reprend les trois decks et la grille de quatre biomes colorés du site sur un seul écran. « Retour » est en bas à gauche ; « Lancer la partie » est en bas à droite et confirme aussi le tirage (conservation ou échanges sélectionnés). En local, chaque camp se prépare successivement ; en réseau, l’invité confirme et attend l’hôte.

En partie, quatre fenêtres : Habitants en haut à gauche, Tâches en bas à gauche, Métiers en haut à droite, Gestion du village en bas à droite (stocks, bâtiments, parcelles et ventes). Un clic sur un village les affiche. Les fiches de PV, les ors et le chronomètre ont des coins arrondis, une légère inclinaison vers le joueur et une poignée de déplacement. Les fenêtres de gestion et le menu sont également déplaçables.

Y ouvre/ferme la boutique. Joystick gauche vertical : habitant suivant vers le haut, précédent vers le bas. Joystick droit horizontal : village suivant vers la droite, précédent vers la gauche, dans le camp sélectionné. Ces axes gardent le même rôle dans la boutique. Les joysticks d’une fenêtre saisie restent réservés à sa distance et sa taille ; le plateau bouge uniquement dans son mode de manipulation. X maintenu récupère les fenêtres.

À vérifier sur Quest : lecture assise, placement des quatre fenêtres sans gêner la table, saisie des fiches de score, parcours entraînement → lancement, changements d’habitant et de village dans la boutique. Aucun essai physique effectué ici.


Cette procédure porte sur l’interface autour du plateau, en complément du placement et des replis décrits dans [QUEST3.md](QUEST3.md). **Aucun test physique sur Meta Quest 3 n’a été réalisé dans cet environnement.** Un navigateur avec périphérique WebXR simulé ne mesure ni la netteté dans les lentilles, ni le confort, ni la stabilité du suivi réel.

## Référence graphique et limites

Les valeurs de référence proviennent de `css/style.css` : texte `#f4efe2`, texte secondaire `#aaa99f`, surface `#20231f`, surface élevée `#2a2e28`, or `#dfb85e`, Rouge `#c54f46` / `#702f2a`, Bleu `#4e87b8` / `#294d70`, erreur `#e36a5f`. Les portraits proviennent de `assets/generated/characters-atlas.png`, cadrés sur le haut du personnage selon son vrai métier. Les boutons utilisent une famille d'icônes monochromes dessinées par le composant. Les assets de bâtiments déjà présents et le rendu du plateau sont conservés.

Les réglages spatiaux et tailles de texte sont des valeurs de présentation provisoires, à valider avec le casque. La disposition de référence est celle de la révision du 7 octobre ci-dessus : villages, ors et chronomètre en haut ; Habitants et Tâches à gauche ; Métiers et Gestion du village à droite ; paramètres en haut à droite.

## Implémentation et fichiers de cette mission

Créés : `js/xr-design.js` (tokens et dessins partagés), `js/xr-windows.js` (manipulation indépendante), `tests/xr-windows.test.js`, `tests/xr-ui-premium.test.js`, `MR_INTERFACE.md`.

Modifiés : `js/xr-dashboard.js` (rendu, pagination, cibles réutilisées, tailles et dispositions), `js/xr-panels.js` (même composant pour le placement), `js/xr-ui.js` (vraies professions, tâches, coûts, états et menus), `js/xr-input.js` (A et gâchettes équivalents, protection des clics, X maintenu), `js/xr-interactions.js` (identification explicite des modales), `js/xr.js` (orchestration), `js/config.js` (confort et manipulation), `js/audio.js` (confirmation courte respectant la sourdine), `js/game-view.js` (propagation des refus explicites du contrôleur), `index.html` (chargement), `package.json` (tests XR), `tests/xr.test.js`, `tests/xr-browser.test.js`, `QUEST3.md`, `GAME_DESIGN.md` (section 94 uniquement).

Les fenêtres proposent préhension, orientation au poignet, joystick vertical pour la distance et horizontal pour la taille, annulation B, réglages alternatifs à la gâchette et récupération par X maintenu 1,2 s. Les paramètres regroupent audio, fovéation, trois tailles de texte, ajustement/recentrage/réinitialisation des fenêtres et manipulation du plateau suivant les droits réseau. Le retour au salon conserve sa confirmation. Aucun contrôle permanent de transformation du plateau n'est ajouté.

Les CanvasTexture ont au plus 2 048 pixels par axe, utilisent les couleurs CSS et ne sont redessinées que si le contenu ou l'état interactif change. Les cibles de boutons sont réutilisées et la pagination conserve des dimensions de texte fixes ; les préréglages agrandissent physiquement les fenêtres (×1, ×1,16 et ×1,32). Base du corps de texte : 32 pixels à 1 600 pixels/mètre, soit une boîte typographique de 20 mm avant échelle. Cela ne mesure pas la hauteur réelle des glyphes ni leur confort dans les lentilles.

## Résultats automatiques et limites

- `npm.cmd run test:xr` : géométrie réelle Three.js, profils Touch Plus, A séparé, garde index/préhension, X long ; déplacements indépendants à deux mains, rotation, taille, limites, annulation et perte de suivi ; UI branchée aux vraies professions/coûts, revalidation de disponibilité, droits adverses et remplacement d'état.
- `npm.cmd run test:xr-browser` : Edge headless avec WebGL réel et périphérique XR simulé ; réseau hôte/invité, entrée/refus/sortie, préparation et construction, quatre fenêtres de gestion et poignées de score, stabilité après mouvement de tête, manipulation d'une fenêtre sans déplacement du plateau, A sans activation, tailles, réinitialisation et cache de texture. Capture de contrôle possible avec la variable `EREDITA_XR_SCREENSHOT` contenant un chemin PNG. `EREDITA_XR_PREVIEW_DIR` exporte les aperçus `vr-menu.png`, `vr-preparation.png` et `vr-gestion.png`. Les suites XR et navigateur ont été exécutées avec succès après la révision du 7 octobre 2026, incluant les axes gauche/droit, Y, le lancement en une action, les quatre fenêtres, les fiches de score déplaçables et la priorité du village visible devant une fenêtre.
- `node tests/decks-browser.test.js` : menus desktop, contrôles, filtres, modales et sélections réussis ; le test XR vérifie aussi le retour aux vues 2D/3D et la simulation réseau.
- `npm.cmd test` : noyau, IA, élevages, équipements, apparence 3D et commandes réseau réussis, puis les **deux échecs préexistants** de `tests/special-animals.test.js` (attente de dégâts de sanglier continus contre impacts par seconde). Les suites suivantes (âne, animaux 3D, animations de combat, decks) ont été exécutées séparément et réussissent. Aucune règle de combat n'a été modifiée pour faire passer ces assertions.
- L'ancien `tests/browser-smoke.test.js` échoue déjà avant la partie parce qu'il clique le bouton local sans ouvrir le menu actuel. Le parcours navigateur à jour est couvert ci-dessus ; cet ancien script n'a pas été réécrit dans cette mission.

Les correspondances de contrôleurs ont été vérifiées dans le [registre Touch Plus](https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/registry/profiles/meta/meta-quest-touch-plus.json) et le [mapping WebXR xr-standard](https://www.w3.org/TR/webxr-gamepads-module-1/). Cela ne remplace pas un essai matériel. Les tailles, angles, absence de chevauchement avec chaque table réelle, stabilité du suivi et temps d'image restent à valider ci-dessous. Les positions ne sont pas enregistrées entre sessions ; la main de cartes demeure explicitement non jouable tant que ses règles ne sont pas implémentées dans le moteur. Les modifications sont locales et ne constituent pas un déploiement GitHub Pages.

## Préparation du test matériel

1. Noter date, version Quest Browser, version système, fréquence d’affichage, commit testé et mode (solo, local, hôte ou invité). Charger les deux Touch Plus et régler l’écartement des lentilles pour le testeur.
2. S’asseoir à la table prévue, avec de la place pour les mains. Entrer en réalité mixte avec le flux de [QUEST3.md](QUEST3.md), placer le plateau et lancer une partie réelle.
3. Noter la hauteur des yeux, la distance au centre du plateau, la largeur du plateau, la taille de texte choisie et la distance aux panneaux. Répéter au moins pour une petite et une grande table ainsi que deux utilisateurs de tailles différentes.
4. Garder un relevé par essai : résultat conforme/non conforme, panneau, main, action, capture éventuelle, message affiché et reproduction précise. Toute validation ci-dessous reste à cocher après observation réelle.

## Lisibilité et géométrie apparente

Ne pas conclure à la lisibilité à partir des pixels du canvas. Pour une hauteur physique de glyphe `h` et une distance yeux–glyphe `d`, relever son angle apparent : `2 × atan(h / (2 × d)) × 180 / π`. Utiliser la hauteur visible du glyphe, pas seulement la boîte de ligne, et contrôler aussi les panneaux vus en biais. Par exemple, un glyphe de 15 mm à 1 m occupe environ 0,86° : c’est un repère de mesure, pas une garantie de confort.

- [ ] Assis, lire sans se pencher les titres, PV, population, habitants disponibles, or de chaque équipe, timer et coûts. Nommer chaque valeur à voix haute et noter les confusions.
- [ ] Essayer Normal, Grand et Très grand depuis les paramètres. Aucun texte utile ne doit être rétréci pour tenir, coupé sans moyen d’accès, superposé à une autre ligne ou placé hors de sa cible.
- [ ] Refaire l’essai près, au placement initial et à la distance maximale autorisée. Vérifier la netteté lors d’un petit mouvement de tête et après immobilisation.
- [ ] Lire les coûts et les raisons d’indisponibilité des métiers, tâches et constructions. La différence entre sélection, disponibilité et erreur doit être comprise sans dépendre uniquement de la couleur.
- [ ] Vérifier les noms longs, les valeurs élevées, chaque niveau de bâtiment et les six stocks locaux. Les flèches de page et les libellés restent lisibles.
- [ ] Pendant une minute de consultation, déplacer légèrement la tête : les panneaux restent dans l’espace ; ils ne poursuivent pas chaque mouvement. Leur disposition laisse les quatre lignes du plateau consultables.

## Taille et replacement depuis les paramètres

- [ ] Dès le menu initial, puis au choix des decks/biomes et pendant la minute de préparation, ouvrir Paramètres et Replacer le plateau sans changer de page. Confirmer avec A puis chacune des deux gâchettes ; B doit restaurer l’ancienne pose.
- [ ] Agrandir/Réduire les fenêtres : vérifier la croissance des fenêtres et des espacements, le maintien des proportions, les limites et l’absence de transformation du plateau. Réinitialiser doit restaurer la taille d’origine.
- [ ] Ajuster individuellement « Menu et paramètres » avant la partie puis chaque fenêtre en jeu ; vérifier la persistance entre les menus et le confort avec les trois tailles de texte.
- [ ] En réseau invité, vérifier que le replacement et la taille des fenêtres restent locaux au casque et accessibles, avec la largeur du plateau toujours contrôlée par l’hôte.
- [ ] Vérifier que les réglages ne remettent pas à zéro les compteurs et que la pause existante reste respectée.

## Manipulation individuelle et récupération

Réaliser les essais pour Habitants, Tâches, Métiers, Gestion du village et fiches supérieures, d’abord main droite puis main gauche.

- [ ] Viser la barre supérieure : la poignée indique clairement la possibilité de saisir. Une pression de l’index ne déplace pas la fenêtre.
- [ ] Maintenir la préhension sur cette poignée, déplacer la main latéralement et verticalement, approcher/éloigner le panneau, orienter le poignet, puis relâcher. Le panneau suit progressivement et reste où il a été déposé.
- [ ] Comparer le plateau et les trois autres panneaux avant/après : ils ne bougent pas avec la fenêtre saisie.
- [ ] Pendant la saisie, presser puis relâcher la gâchette index au-dessus d’un bouton. Aucun achat, attribution, sélection de village ou autre action ne doit partir. Refaire en relâchant les deux gâchettes presque simultanément.
- [ ] Maintenir la préhension en dehors d’une poignée : aucun déplacement du plateau en mode jeu. Avec les deux mains, essayer deux poignées distinctes puis la même poignée ; aucun saut ni commande parasite.
- [ ] Couper brièvement le suivi de la main saisissante, puis le rétablir. Le panneau ne doit pas bondir, rester verrouillé ou déclencher une action au retour du suivi.
- [ ] Essayer de déposer un panneau derrière soi, trop près des yeux, très loin ou sous la table. Vérifier les limites de confort et les messages éventuels.
- [ ] Ouvrir les paramètres et recentrer les panneaux : ils reviennent devant la position actuelle. Puis utiliser Réinitialiser les fenêtres : la disposition initiale complète revient immédiatement.
- [ ] Changer de village, ouvrir/fermer un menu et masquer/réafficher les panneaux : les positions personnalisées persistent pendant la session. Vérifier le nouveau placement après sortie/rentrée AR, sans attendre de persistance entre sessions.
- [ ] Ouvrir la manipulation du plateau via les paramètres et tester sa préhension à une/deux mains ainsi que sa rotation/taille. Aucun panneau ne doit être saisi dans ce mode. Terminer et retrouver la manipulation individuelle des fenêtres.

## Toutes les interactions

- [ ] Avec chaque gâchette index, sélectionner les huit villages depuis le bandeau supérieur. Comparer au desktop les PV, population, disponibles, stocks et niveaux ; les quatre panneaux de gestion restent simultanément accessibles.
- [ ] A et les deux gâchettes valident les mêmes boutons, villages et placements ; une pression maintenue de A ne répète pas une action. B annule/ferme le contexte courant. X masque/réaffiche la gestion ; la récupération et les paramètres restent accessibles. Y ouvre/ferme la boutique.
- [ ] Joystick gauche vertical : parcourir les habitants. Joystick droit horizontal : changer de village, avec répétition maîtrisée et sans déplacement du plateau. Vérifier les solutions par boutons à la gâchette.
- [ ] Parcourir chaque page des habitants. Chaque portrait correspond au métier réel, l’identifiant et l’état sont lisibles, l’habitant choisi garde son cadre doré, les autres panneaux reflètent cette sélection.
- [ ] Construire Bergerie, Artisanat et Boucherie ; améliorer village et bâtiments jusqu’au niveau autorisé. Lire les coûts avant clic et comparer les dépenses réelles au desktop.
- [ ] Sélectionner un habitant et attribuer/retirer chacun des six métiers quand ses conditions sont remplies. Tester aussi une condition absente : explication lisible, aucune dépense ni changement de métier.
- [ ] Tester agriculture, élevage, pêche, chasse, attaque, défense et retour disponible ; tester commandes groupées et choix pour les prochains habitants. Les conditions locales et les règles de délai restent celles du moteur.
- [ ] Tester chaque slot autorisé, placement/remplacement des cultures, élevage, abattage, vente, achat d’habitant, équipement et compagnons. Comparer les changements au village exact et à l’or de la bonne équipe.
- [ ] Provoquer une action indisponible : retour textuel clair. Tester normal, survol, sélection, confirmation et désactivé. Couper les bruitages : le retour visuel reste suffisant et le son ne joue plus.
- [ ] Ouvrir audio, graphismes et taille des textes. Modifier les réglages, fermer/réouvrir, vérifier l’état affiché. Retour au salon doit demander confirmation ; Annuler conserve partie et session.
- [ ] Invité réseau : construire dans un village Bleu, vérifier le snapshot reçu par l’hôte. Les poses des fenêtres restent locales ; les restrictions de manipulation/redimensionnement du plateau de l’invité sont respectées.

## Stabilité, performance et retour desktop

- [ ] Jouer au moins 15 minutes avec bâtiments, cultures, habitants en mission et combats sur plusieurs lignes. Relever temps d’image, mémoire et mises à jour de textures avec le débogueur distant ; noter les ralentissements pendant navigation, saisie et changement de texte.
- [ ] Comparer une scène immobile et une scène active : les surfaces inchangées ne doivent pas imposer une reconstruction continue des textures. Les mises à jour de PV, timer et stocks ne doivent pas bloquer le rayon.
- [ ] Ouvrir/fermer les menus et changer plusieurs fois de village et de taille de texte. Vérifier l’absence de croissance continue des textures/géométries après stabilisation et l’absence de saccades perceptibles.
- [ ] Perdre/récupérer le suivi, recentrer via le système et reconnecter les contrôleurs. Les panneaux peuvent être récupérés, le plateau suit le protocole d’ancre/replacement existant, aucune action fantôme.
- [ ] Sortir via Quitter AR et via le système, puis rentrer. Aucun doublon de panneau ou de simulation. Après sortie, vérifier menus, pause/reprise, boutique, vues 2D/3D, sélection des habitants et salon desktop.

Les mesures de performance et l’appréciation du confort doivent être consignées après ces essais, avec leur appareil et leur version de navigateur. Les résultats automatiques ne remplacent aucune case de cette procédure.
