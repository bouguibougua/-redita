# Amélioration de la lisibilité VR — Eredità

Date : 5 octobre 2026. Cette intervention améliore l’interface VR existante, principalement la taille et la qualité du texte, les paramètres et l’accès aux actions. Les fonctions de gameplay, les règles et la synchronisation réseau restent celles du projet.

## Utilisation

Ouvrir la roue dentée **Paramètres**, puis utiliser **Texte − / Texte +**. Taille par défaut : **120 %**, réglable de **100 à 180 %** par pas de 10 %. Les boutons restent accessibles sur chaque page des paramètres. **Lisibilité et aperçu** contient les raccourcis 100/120/150/180 %, un exemple et le **contraste renforcé**. B et Retour reviennent aux paramètres depuis cet écran.

La préférence est locale au navigateur du casque et conservée après rechargement. Un stockage privé ou refusé ne bloque pas le jeu : le réglage reste actif pendant la session. Le placement et la manipulation du plateau emploient le même réglage de lisibilité que la gestion du village.

Les lettres et les boutons suivent le réglage. Les textes passent sur plusieurs lignes ; les grilles prennent moins de colonnes si nécessaire. La pagination inclut aussi les statistiques et les ressources : les boutons situés après ces informations restent consultables. Les raccourcis **À tous / Aux prochains** sont fixes dans les panneaux Métiers et Tâches. Le panneau Informations est plus haut pour conserver les six stocks et les accès aux boutiques/parcelles visibles à 120 % avec les données ordinaires du jeu.

## Fichiers modifiés

- `js/config.js` : limites, pas et valeur initiale du réglage.
- `js/xr-design.js` : préférences persistantes, partage entre panneaux, coupure des identifiants longs et dimensions des surfaces.
- `js/xr-dashboard.js` : glyphes réglables, mesure des lignes, hauteur des boutons, grilles et pagination, préhension adaptée aux titres, rendu des textures.
- `js/xr-ui.js` : commandes de lisibilité, aperçu, contraste, raccourcis collectifs fixes et retour par B.
- `package.json` : ajout de la vérification de lisibilité à `test:xr`.
- `tests/xr-ui-premium.test.js` et `tests/xr-browser.test.js` : réglage, navigation et vérification des vrais glyphes dans le navigateur.
- `MR_INTERFACE.md` et la section 94 de `GAME_DESIGN.md` : documentation cohérente avec le réglage.

## Fichiers créés

- `tests/xr-readability.test.js` : validation des neuf tailles, pagination, cibles, poses, préférences et stockage refusé.
- `VR_READABILITY_REPORT.md` : ce rapport.
- `vr-readability-preview.png` : capture du navigateur à 120 %, avec un périphérique XR simulé et sans passthrough réel.

## Fonctions desktop et accès VR identifiés

Les accès ci-dessous existaient déjà dans l’adaptateur XR ; la nouvelle mise en page conserve leurs commandes et validations.

| Fonction | Accès VR |
| --- | --- |
| Choisir un deck, sélectionner/échanger les biomes, confirmer et démarrer | Panneau de préparation |
| Sélectionner chacun des huit villages | Village sur le plateau ou carte du bandeau supérieur |
| Lire PV, niveau, population et stocks locaux | Panneau Informations |
| Lire les deux ors globaux et le chronomètre | Bandeau supérieur |
| Choisir un habitant | Carrousel inférieur, flèches et joystick droit |
| Attribuer ou retirer un métier | Panneau Métiers ; Sans métier retire la spécialité selon les règles |
| Affecter agriculture, élevage, pêche, chasse, attaque, défense ou disponibilité | Panneau Tâches |
| Attribuer à tous et régler les prochains habitants | Raccourcis fixes des panneaux, puis choix du métier/de la tâche |
| Libérer les travailleurs | Disponible/Libérer la tâche ; commande collective du menu À tous |
| Construire et améliorer village, Bergerie, Artisanat et Boucherie | Panneau Bâtiments et choix de la ressource d’amélioration |
| Placer cultures/élevages et abattre un animal d’enclos | Parcelles, puis emplacement |
| Vendre les stocks et acheter un habitant | Échoppes |
| Acheter animaux, véhicules, équipements et compagnons | Menus des boutiques et validation par le moteur |
| Commander les compagnons disponibles | Menu Compagnons |
| Choisir une redirection | Panneau contextuel de route |
| Pause, reprise, audio, graphismes, retour au salon | Paramètres ; retour au salon confirmé |

La création/modification des decks et le tutoriel scénarisé conservent leur interface web. Le code d’un salon se saisit dans Quest Browser. Cette intervention ne prétend pas achever une refonte de tous ces parcours.

## Contrôleurs et fenêtres

Les deux gâchettes sélectionnent les boutons et villages. A ouvre les informations, B revient/annule, X masque/réaffiche la gestion, X maintenu récupère les fenêtres et Y ouvre l’information sur les futures cartes. Les joysticks parcourent habitants et pages selon le contexte.

La préhension d’une barre supérieure déplace et oriente la fenêtre concernée. Pendant la saisie, le joystick ajuste distance et taille ; B annule la pose. Les clics sont bloqués pendant cette manipulation. Les fenêtres restent indépendantes du plateau. Le réglage de texte conserve leur position, orientation et taille physique, y compris pour une pose personnalisée. Les poses restent locales à la session ; elles ne sont pas sauvegardées entre sessions.

Le placement du plateau, son hit-test/plan manuel, sa confirmation et son ancre optionnelle restent ceux du projet. Sa manipulation s’ouvre explicitement depuis les paramètres : une préhension déplace, deux ajustent orientation et taille. Les restrictions hôte/invité restent en vigueur.

## Rendu et performances

Les textes utilisent une densité de texture supérieure, plafonnée à 2048 pixels par dimension et aux capacités du GPU. Mipmaps et anisotropie limitée à 4 stabilisent l’échantillonnage selon les [options Three.js](https://threejs.org/docs/pages/Texture.html). Les cibles sont réutilisées et les surfaces inchangées ne sont pas redessinées continuellement. Les couleurs sombres, Rouge/Bleu et dorées proviennent de la palette existante.

## Tests et limites

- `npm run test:xr` : succès, y compris 100–180 %, conservation des poses, cibles d’au moins 6 cm de haut, accès à chaque métier, préférences partagées et stockage refusé/corrompu.
- `npm run test:xr-browser` : succès dans Edge avec Three.js/WebGL réels et XR simulé ; glyphes et contenus dans les limites des fenêtres, placement/manipulation, contrôleurs, préparation solo, construction invitée et synchronisation réseau.
- `node tests/decks-browser.test.js` : succès du parcours desktop.
- `npm test` : noyau, IA, élevage, équipements, apparence 3D et commandes réseau passent, puis deux échecs sur les dégâts des sangliers dans `special-animals.test.js`.
- Ces deux échecs se reproduisent avec le `config.js` d’avant cette intervention : 198 attendus contre 192 pour la culture, 273 attendus contre 267 pour le village. Les règles de combat n’ont pas été modifiées.
- Les suites qui suivent dans `npm test` ont été exécutées séparément : âne, animaux 3D, animations de combat et decks passent.

À fort agrandissement, certaines informations réclament une page supplémentaire. Les longues conditions peuvent continuer sur la page suivante. La qualité optique, le confort assis, le suivi et le coût GPU doivent être validés sur un vrai Quest 3 ; aucun test matériel n’a été réalisé ici.

Les cartes actives restent non jouables tant que leur moteur desktop n’existe pas. Les menus de boutiques conservent leur organisation existante. Aucune nouvelle règle de gameplay n’a été définie ; la différence déjà présente entre assertions de dégâts continus et impacts des sangliers reste à trancher séparément.

Les changements sont locaux. Aucun déploiement n’a été effectué.
