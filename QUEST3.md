# Eredità sur Meta Quest 3

## Format simplifié et ergonomie — 8 octobre 2026

Les boutons « 2 camps » (Simplifié, sélectionné par défaut) et « 4 camps » (Classique) sont proposés avant l’entraînement, le local ou la création d’un salon, et directement dans le casque. En Simplifié, les trois biomes sont présents sur le plateau initial, sans doublon par joueur ; un seul échange par camp est permis, contre un autre biome aléatoire. Le nouveau format conserve les règles de jeu et les durées existantes.

Toutes les fenêtres, y compris placement, manipulation, paramètres, réglages rapides et notifications, se déplacent par leur poignée. Elles apparaissent parallèles au joueur au-dessus du plateau. Le joystick gauche monte/descend dans les habitants ; le droit suit les villages à droite/gauche physiquement, y compris côté Rouge. Les poses restent stables jusqu’au déplacement ou recentrage volontaire.

À vérifier sur Quest : chaque poignée, les deux orientations du plateau, le maintien des poses entre menus, les deux formats en 2D/3D et les salons à deux régions. Les tests automatiques utilisent un périphérique simulé.


## Réglages de taille et replacement

Les paramètres restent accessibles dès « Choisir une partie », depuis le choix des decks et biomes, pendant la minute de préparation et pendant le combat. Un seul écran regroupe Agrandir/Réduire les fenêtres, Replacer le plateau, la taille du texte, les réglages individuels et les commandes existantes. Agrandir conserve les espaces entre fenêtres. Les limites restent dans Config.xr ; Réinitialiser restaure taille et disposition. Le menu lui-même peut être ajusté dans « Ajuster une fenêtre ».

Une gâchette gauche, une gâchette droite et A effectuent la même sélection au rayon. B annule un replacement en restaurant la pose précédente. Le temps de jeu garde son état : mettre en pause si souhaité avant de régler le plateau.

## Ergonomie VR — 7 octobre 2026

Après placement, les menus sont droits face au regard. Choisir une partie utilise de grands boutons centrés et un accès « Quitter le mode VR ». La préparation reprend les trois decks et la grille de deux ou quatre biomes colorés selon le format du site sur un seul écran. « Retour » est en bas à gauche ; « Lancer la partie » est en bas à droite et confirme aussi le tirage (conservation ou échanges sélectionnés). En local, chaque camp se prépare successivement ; en réseau, l’invité confirme et attend l’hôte.

En partie, quatre fenêtres : Habitants en haut à gauche, Tâches en bas à gauche, Métiers en haut à droite, Gestion du village en bas à droite (stocks, bâtiments, parcelles et ventes). Un clic sur un village les affiche. Les fiches de PV, les ors et le chronomètre ont des coins arrondis et une poignée de déplacement. Toutes les fenêtres sont parallèles au joueur, dans un même plan vertical au-dessus du plateau. Les fenêtres de gestion et le menu sont également déplaçables.

Y ouvre/ferme la boutique. Joystick gauche vertical : habitant précédent vers le haut, suivant vers le bas. Joystick droit horizontal : village physiquement à droite ou à gauche sur le plateau, dans le camp sélectionné, en tenant compte de l’orientation du plateau. Ces axes gardent le même rôle dans la boutique. Les joysticks d’une fenêtre saisie restent réservés à sa distance et sa taille ; le plateau bouge uniquement dans son mode de manipulation. X maintenu récupère les fenêtres.

À vérifier sur Quest : lecture assise, placement des quatre fenêtres sans gêner la table, saisie des fiches de score, parcours entraînement → lancement, changements d’habitant et de village dans la boutique. Aucun essai physique effectué ici.


Le mode réalité mixte est intégré au jeu existant. Il permet de placer le plateau sur une table et de piloter la préparation, la gestion et le combat avec les contrôleurs. Il utilise le module **Three.js r186 déjà présent**, sans CDN, framework ou seconde simulation.

## Lancer sur le casque

### Option USB, sans déploiement

1. Dans le dossier du projet, lancer `npm start` (Node.js 18 minimum pour le serveur).
2. Brancher le Quest 3 en USB. Activer le mode développeur et autoriser le débogage USB du PC sur le casque ; installer les outils ADB si nécessaire.
3. Dans un autre terminal, lancer :

   ```text
   adb devices
   adb reverse tcp:8765 tcp:8765
   ```

4. Dans **Meta Quest Browser**, ouvrir `http://localhost:8765`. Le port du casque est redirigé vers le serveur du PC. `localhost` est utilisable comme contexte sécurisé.
5. Choisir **RÉALITÉ MIXTE · QUEST 3**, puis **Entrer en réalité mixte** et accepter les autorisations. Garder les deux contrôleurs Touch Plus allumés.

Cette méthode de redirection est décrite dans la [documentation Meta de débogage du navigateur](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/). Le serveur doit rester ouvert sur le PC. Pour retirer la redirection : `adb reverse --remove tcp:8765`.

### Option Wi-Fi / Internet

Ouvrir dans Quest Browser l'adresse **HTTPS** d'un déploiement du projet complet, serveur WebSocket inclus, selon [MULTIJOUEUR.md](MULTIJOUEUR.md). Un certificat doit être reconnu par le casque. `http://192.168.…:8765` permet le jeu desktop, mais n'est pas un contexte sécurisé pour WebXR. Le serveur local fourni ne génère pas de certificat HTTPS.

### Aperçu ou partie en cours

- **Depuis le menu** : le casque propose entraînement ou local, puis la préparation des decks et biomes. Aucun choix n'est validé automatiquement.
- **Pour suivre une partie** : préparer et lancer normalement l'entraînement, le local ou le salon, puis cliquer sur **Réalité mixte** au-dessus du plateau. Les mêmes unités, bâtiments et productions sont affichés. La simulation continue pendant le placement et les réglages ; mettre en pause avant l'entrée si souhaité et si le mode l'autorise.
- **En réseau** : créer/rejoindre le salon comme d'habitude. Rouge reste l'hôte autoritaire, Bleu reste l'invité. Chacun peut choisir sa représentation. Le placement physique reste local au casque ; il n'est pas envoyé à l'autre joueur.
- **Tutoriel** : le parcours guidé nécessite encore les contrôles HTML ; l'entrée AR y est désactivée. Revenir au menu à sa fin pour utiliser l'AR.
- **Gestion économique** : les panneaux du casque permettent de construire, attribuer des métiers et missions, planter, élever, vendre et acheter en appelant le même moteur que le desktop. Les cartes actives n'existent pas encore dans le prototype desktop et Y ouvre la boutique.

## Placement et commandes

Le panneau de placement apparaît droit devant le joueur, parallèle à lui, et possède aussi une poignée de déplacement. Après placement et lancement, le tableau de bord répartit les quatre ou huit fiches de villages, les ors globaux et l’horloge en haut, puis les quatre fenêtres de gestion décrites ci-dessus. Les fenêtres restent stables dans l’espace et peuvent être déplacées individuellement par leur barre supérieure. Les fiches et boutons se visent au rayon et s'activent à la gâchette index ; leur surface est une vraie géométrie 3D. Agriculture, élevage, pêche et chasse utilisent les missions économiques existantes ; les commandes de combat conservent également leurs règles.

1. Viser la table. Un repère vert et un plateau transparent apparaissent sur une surface horizontale admissible. **Vérifier soi-même qu'il s'agit bien de sa table** : le code ne déduit aucune catégorie de mobilier.
2. Appuyer sur la gâchette du contrôleur qui porte le repère pour confirmer. Si l'autre contrôleur était prioritaire, une première pression transfère la priorité à celui utilisé ; viser et confirmer une seconde fois.
3. Si rien n'est détecté, choisir **Placement manuel**. Un plan virtuel remplace la surface détectée ; **Plus haut / Plus bas** règlent sa hauteur. Viser vers le bas et confirmer uniquement lorsque l'aperçu correspond à la vraie table. Le repère manuel est jaune.
4. Après placement, pointer un village : son cercle devient vert. La gâchette le sélectionne et met à jour les panneaux ; A a le même effet que les deux gâchettes : sélectionner le village visé et afficher sa gestion. Les PV, habitants, stocks et bâtiments proviennent du moteur.
5. Utiliser **⚙ Réglages** pour déplacer, pivoter ou redimensionner le plateau. **Terminer** rétablit les commandes de jeu. **Replacer le plateau**, accessible dès le menu de début et pendant les deux préparations, recommence le placement face à la position actuelle ; B/Annuler restaure la pose précédente tant que le repère spatial n'a pas changé.
6. **Quitter la réalité mixte** ferme la session et restaure l'interface classique. **Retour au salon** demande une confirmation, ferme la session puis revient au menu.

| Commande | Effet |
| --- | --- |
| Gâchette gauche ou droite | Confirmer un placement, un bouton ou un village |
| A, contrôleur droit Touch reconnu | Même effet que les deux gâchettes : confirmer un placement, un bouton ou un village |
| B, contrôleur droit Touch reconnu | Revenir/fermer un menu, terminer la manipulation ou annuler un repositionnement |
| X, contrôleur gauche Touch reconnu | Masquer ou afficher les panneaux de gestion |
| X maintenu 1,2 seconde | Récupérer toutes les fenêtres devant soi, y compris hors champ |
| Y, contrôleur gauche Touch reconnu | Ouvrir/fermer la boutique |
| Joystick droit horizontal, jeu | Changer de village dans le camp sélectionné |
| Joystick gauche vertical, jeu | Parcourir les habitants du village sélectionné |
| Préhension sur la barre supérieure, jeu | Saisir une seule fenêtre, la déplacer/orienter puis relâcher ; la gâchette index est neutralisée pendant la saisie |
| Joystick pendant la saisie d'une fenêtre | Vertical : distance ; horizontal : taille ; B annule le déplacement |
| Paramètres : Agrandir / Réduire les fenêtres | Modifier la taille de toutes les fenêtres et leurs espacements, sans déplacer le plateau |
| Paramètres : recentrer / réinitialiser les fenêtres | Récupérer les panneaux devant soi / restaurer leur disposition initiale |
| Joystick gauche, mode manipulation | Déplacer sur le plan horizontal relatif au regard |
| Joystick droit, mode manipulation | Pivoter |
| Une préhension, mode manipulation | Déplacer avec la main, hauteur comprise |
| Deux préhensions, mode manipulation | Déplacer, tourner et changer la taille selon l'écartement |
| Paramètres : Déplacer / Rotation / Taille | Ouvrir les réglages du plateau à boutons, tous utilisables à la gâchette |
| Recentrer | Replacer sur la table ; ne déplace pas la caméra |

Les boutons système ne sont jamais liés. Pour un profil inconnu, les événements WebXR `select`/`squeeze` restent utilisables et les boutons A/B sont ignorés. Les axes ne sont lus que pour une manette déclarant `xr-standard`. Les rayons donnent un retour vert pour une cible/confirmation et rouge pour une action invalide.

Réglages provisoires dans `js/config.js`, section `xr` : largeur initiale **0,8 m**, limites **0,45–1,4 m**, centre du plateau à **0,4–2,5 m** horizontalement du joueur, hauteur entre **0,15 et 1,5 m sous les yeux**. Le réglage manuel commence à 0,55 m sous les yeux pour permettre un usage assis. Ces paramètres n'ont aucun effet sur les unités logiques du jeu.

## Architecture et fichiers

| Fichier | Rôle |
| --- | --- |
| `js/game-view.js` (créé) | Lecture de l'état courant et sélection via le contrôleur existant ; contrat pour une future carte active |
| `js/xr.js` (créé) | Entrée `immersive-ar`, cycle de session, orchestration, restauration desktop, diagnostics |
| `js/xr-placement.js` (créé) | Hit-test par rayon de contrôleur, aperçu, plan manuel, ancres de session et transformations bornées |
| `js/xr-input.js` (créé) | Deux contrôleurs, `handedness`, rayons, profils, boutons et préhensions |
| `js/xr-interactions.js` (créé) | Raycaster, zones de sélection des villages et surbrillance |
| `js/xr-panels.js` (créé) | Panneau flottant et boutons 3D, textes sur CanvasTexture |
| `js/xr-design.js` | Couleurs reprises du CSS, typographie, espacements et composants Canvas partagés |
| `js/xr-dashboard.js`, `js/xr-ui.js` | Tableau de bord spatial, menus et adaptation des commandes métier existantes |
| `js/xr-windows.js` | Saisie individuelle, orientation, limites de confort et récupération des fenêtres |
| `js/board3d.js` (modifié) | Renderer existant transparent/XR, socle dans `world`, tags des villages/slots, aperçu et boucle commune |
| `js/game.js` (modifié) | Adaptateur de vue et unique pas de simulation appelé par `setAnimationLoop` ; RAF de repli si Three.js échoue |
| `js/config.js` (modifié) | Paramètres temporaires de présentation et de confort |
| `index.html`, `css/style.css` (modifiés) | Accès AR dans le menu, la préparation et la partie, dialogue préalable |
| `tests/xr.test.js`, `tests/xr-browser.test.js` (créés) | Tests géométriques, cycle XR simulé et intégration réseau dans le navigateur |
| `package.json`, `THREE_DIMENSIONS.md`, `GAME_DESIGN.md` (modifiés) | Commandes de tests et documentation cohérente |

Analyse initiale : `Board.createState` crée les joueurs et villages, `Biomes.createInitialDraw/createSlots` définit les régions, les méthodes de `game.js` déclenchent les actions, `UI.init` lie les événements HTML, `Network.init` conserve menus/salons et remplace l'état de l'invité par les snapshots hôte. Le `Proxy` de contrôleur reste responsable des restrictions solo/réseau. `Board3D.update` continue d'observer cet état. Le dossier `B3MAR56-TD3-main-main` n'était pas fourni dans ce workspace.

Le seul problème structurel nécessaire à corriger était la coexistence des RAF du moteur et du rendu, qui ne convient pas à une session immersive, ainsi que le socle ajouté directement à la scène. Ils utilisent maintenant la même boucle et le même groupe que le plateau. Les règles, le protocole réseau et le serveur n'ont pas été réécrits.

Pour les futures cartes, les slots portent `xrTarget: { kind: 'slot', playerId, lane, slotIndex }`. `GameView.createCardTargeting(adapter)` réserve activation, lecture des cibles autorisées, confirmation et annulation. L'adaptateur métier partagé devra fournir `canActivate`, `getTargets` et `play(controller, …)`. Sans adaptateur, aucune carte n'est activable : aucun coût, droit ou effet fictif n'est ajouté. La surbrillance des emplacements sera raccordée à ces cibles à cette étape future.

## Compatibilité et replis

Vérification documentaire effectuée le 24 septembre 2026, sans accès physique au casque :

- Le passthrough demande une session `immersive-ar` et un fond transparent. La détection de disponibilité utilise `navigator.xr.isSessionSupported`, puis les permissions sont demandées au clic. Voir [Meta, réalité mixte dans Browser](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/).
- `hit-test` et `anchors` sont **optionnels**. Chaque source hit-test utilise le `targetRaySpace` du contrôleur, selon la [spécification WebXR Hit Test](https://immersive-web.github.io/hit-test/). L'absence d'API, le refus, l'absence de résultats ou des résultats trop inclinés/éloignés conduisent au placement manuel. Une surface du monde réel doit être connue du navigateur : les autorisations spatiales et la configuration de la pièce peuvent influer sur les résultats.
- La case **Placement manuel simplifié** démarre une session ne demandant aucune de ces extensions. Elle peut servir après un refus ou une incompatibilité. Il faut refaire un clic explicite ; aucun essai de session n'est lancé automatiquement après un refus.
- Une ancre est créée avec `XRFrame.createAnchor` seulement lorsque disponible. Les promesses tardives sont nettoyées à la fermeture et après manipulation. Si l'ancre perd son suivi, le plateau est masqué jusqu'au retour du suivi ou au recentrage. Aucun identifiant persistant n'est stocké.
- Le repli sans ancre conserve la pose dans l'espace `local` de la session. Un événement `reset` de cet espace impose un nouveau placement pour éviter de prétendre à une stabilité spatiale que l'application ne peut garantir.
- A/B utilisent les index 4/5 à droite et X/Y les mêmes index à gauche **uniquement** pour les profils Touch connus, notamment [le profil officiel Touch Plus](https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/registry/profiles/meta/meta-quest-touch-plus.json). Les axes 2/3 sont définis par [WebXR Gamepads, mapping xr-standard](https://www.w3.org/TR/webxr-gamepads-module-1/). Aucun index n'est considéré comme universel.
- Les modèles sont les géométries provisoires existantes. Les ombres et le brouillard desktop sont désactivés en AR, les mises à jour HTML sont espacées. Les performances sur Quest, notamment avec une partie chargée en unités, restent à mesurer. Il n'y a pas d'occlusion par le mobilier réel, de suivi des mains nues ou de partage d'ancres entre casques.

Dans le débogueur du navigateur, `Eredita.XR.diagnostics` donne les fonctionnalités accordées, les profils/mains, le suivi, la taille, la sélection et l'état de l'ancre. Le diagnostic ne modifie aucune donnée de jeu. Le code ne peut pas vérifier la version réellement installée de Quest Browser avant que vous ouvriez le prototype sur ce casque.

## Tests automatiques effectués

```text
npm run test:xr
npm run test:xr-browser
node tests/network-server.test.js
npm test
```

Sous PowerShell si l'exécution de `npm.ps1` est bloquée, utiliser `npm.cmd` avec les mêmes arguments, sans changer la politique d'exécution. Le détail de la présente interface, de ses fichiers et de sa validation se trouve dans [MR_INTERFACE.md](MR_INTERFACE.md).

Les deux suites XR et le test serveur passent. La suite XR utilise le vrai module Three.js pour vérifier géométrie, Raycaster, orientation Rouge/Bleu, limites, préhensions, profils, déconnexions, sources tardives et perte d'ancre. La suite navigateur utilise Edge sans fenêtre, le vrai rendu WebGL et un **périphérique XR simulé**. Elle vérifie le menu, le refus d'autorisation, l'activation au clic, les boutons 3D, les deux contrôleurs, le placement, les réglages, plusieurs entrées/sorties, le retour 2D/3D, une préparation solo lancée en XR, ainsi qu'un salon où l'invité construit en XR et l'hôte reçoit cette action. Elle ne teste pas la couche WebXR native du casque. Les API simulées sont uniquement dans `tests/`.

Le test navigateur nécessite Node.js **22+** (WebSocket natif) et Edge sous Windows. `EREDITA_BROWSER` peut indiquer le chemin d'un Chromium différent. Il lance ses propres processus sur les ports 8787 et 9447 et les ferme après le test.

`npm test` rencontre deux échecs **préexistants**, dans `tests/special-animals.test.js` : les assertions de dégâts continus du sanglier attendent 2 dégâts sur un quart de seconde, alors que le moteur et le GDD actuels appliquent un impact de 8. Même résultat vérifié avec la configuration originale de `HEAD` et les modules métier inchangés. Ces tests et les règles de combat n'ont pas été modifiés dans cette adaptation. Les suites suivantes, bloquées par le `&&` après cet échec, ont été exécutées séparément et passent : âne, modèles 3D des animaux, animations de combat et decks. Les suites noyau, IA, achats d'élevages, équipements, apparences 3D et commandes réseau passent également.

## Vérification physique à faire sur le Quest 3

**Non réalisée ici : aucun casque accessible.** Noter la version du navigateur, les permissions accordées et les éventuels messages de diagnostic.

La procédure détaillée de l’interface, incluant mesures angulaires de texte, trois tailles, manipulation de chaque fenêtre, absence de conflit gâchette/préhension, récupération, interactions et performance, se trouve dans [MR_INTERFACE.md](MR_INTERFACE.md).

- [ ] Depuis le menu, lancer l'AR et vérifier que la vraie pièce reste visible en passthrough, sans fond opaque.
- [ ] Refuser une autorisation puis réessayer ; vérifier que le desktop reste utilisable.
- [ ] Viser une table connue du casque ; vérifier repère et aperçu, puis confirmer à la gâchette.
- [ ] Viser un mur, une zone lointaine et le sol : aucune identification automatique comme « table » ; vérifier les limites et la confirmation volontaire.
- [ ] Tester sans hit-test et avec la case de lancement simplifié ; ajuster la hauteur manuellement jusqu'à la table.
- [ ] Vérifier une largeur initiale de 80 cm, les quatre villages du joueur près de lui et l'eau littorale vers le centre, côté Rouge puis côté Bleu.
- [ ] Sélectionner les quatre ou huit villages avec chaque contrôleur ; comparer PV, habitants, ressources et bâtiments avec le desktop.
- [ ] Vérifier que les deux gâchettes et A sélectionnent les mêmes villages, activent les mêmes boutons et valident le placement. Pendant une saisie et juste après, aucun des trois ne déclenche d’action parasite.
- [ ] En mode interaction, manipuler joysticks/préhensions : aucun déplacement du plateau.
- [ ] En mode manipulation, déplacer et tourner avec les joysticks, saisir à une main, puis agrandir/réduire à deux mains ; vérifier les limites et l'absence de saut au relâchement.
- [ ] Faire les mêmes réglages uniquement avec les boutons 3D à la gâchette ; tester Recentrer, Annuler et Terminer.
- [ ] Déconnecter chaque contrôleur, masquer brièvement le suivi puis le rétablir ; vérifier l'absence de sélection fantôme.
- [ ] Tester le recentrage système et la perte d'ancre ; vérifier suivi ou demande de nouveau placement selon les capacités disponibles.
- [ ] Lancer une partie PC ↔ Quest et, si disponible, Quest ↔ Quest : mêmes états, positions physiques indépendantes, pas de double simulation.
- [ ] Quitter via Quitter AR puis via l'interface système ; rentrer de nouveau, vérifier absence de duplication et nouveau placement requis.
- [ ] Après sortie, tester menus, boutique, sélection desktop, pause/reprise, vues 2D/3D et salon toujours connecté.
- [ ] Vérifier le confort et la fluidité pendant plusieurs minutes avec plusieurs bâtiments, habitants et combats.
