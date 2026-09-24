# Eredità sur Meta Quest 3

Le mode réalité mixte est intégré au jeu existant. Il permet de placer le plateau sur une table, de le manipuler et de consulter ses villages. Il utilise le module **Three.js r186 déjà présent**, sans CDN, framework ou seconde simulation.

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

- **Depuis le menu** : le mode AR expose le tirage courant du moteur, avant confirmation des biomes. Il ne lance pas une seconde partie et ne valide aucun choix automatiquement.
- **Pour suivre une partie** : préparer et lancer normalement l'entraînement, le local ou le salon, puis cliquer sur **Réalité mixte** au-dessus du plateau. Les mêmes unités, bâtiments et productions sont affichés. La simulation continue pendant le placement et les réglages ; mettre en pause avant l'entrée si souhaité et si le mode l'autorise.
- **En réseau** : créer/rejoindre le salon comme d'habitude. Rouge reste l'hôte autoritaire, Bleu reste l'invité. Chacun peut choisir sa représentation. Le placement physique reste local au casque ; il n'est pas envoyé à l'autre joueur.
- **Tutoriel** : le parcours guidé nécessite encore les contrôles HTML ; l'entrée AR y est désactivée. Revenir au menu à sa fin pour utiliser l'AR.
- **Gestion économique et cartes** : cette étape AR permet la consultation. Revenir au desktop pour construire, attribuer des métiers, etc. Le jeu de cartes en AR n'est pas implémenté.

## Placement et commandes

Le panneau 3D apparaît devant le joueur, légèrement sur sa gauche. Il reste dans le monde et ne suit pas chaque mouvement de tête. Les boutons se visent au rayon et s'activent à la gâchette ; leur surface est une vraie géométrie 3D.

1. Viser la table. Un repère vert et un plateau transparent apparaissent sur une surface horizontale admissible. **Vérifier soi-même qu'il s'agit bien de sa table** : le code ne déduit aucune catégorie de mobilier.
2. Appuyer sur la gâchette du contrôleur qui porte le repère pour confirmer. Si l'autre contrôleur était prioritaire, une première pression transfère la priorité à celui utilisé ; viser et confirmer une seconde fois.
3. Si rien n'est détecté, choisir **Placement manuel**. Un plan virtuel remplace la surface détectée ; **Plus haut / Plus bas** règlent sa hauteur. Viser vers le bas et confirmer uniquement lorsque l'aperçu correspond à la vraie table. Le repère manuel est jaune.
4. Après placement, pointer un village : son cercle devient vert. La gâchette ouvre sa fiche ; le village sélectionné est indiqué en jaune. Les PV, habitants, stocks et bâtiments proviennent du moteur.
5. Utiliser **Manipuler** pour régler le plateau. **Terminer** rétablit la sélection des villages. **Recentrer** recommence le placement face à la position actuelle ; B/Annuler restaure la pose précédente tant que le repère spatial n'a pas changé.
6. **Quitter AR** ferme la session et restaure la vue 2D/3D et l'interface de départ.

| Commande | Effet |
| --- | --- |
| Gâchette gauche ou droite | Confirmer un placement, un bouton ou un village |
| A, contrôleur droit Touch reconnu | Même confirmation que la gâchette |
| B, contrôleur droit Touch reconnu | Fermer la fiche, terminer la manipulation ou annuler un repositionnement |
| Joystick gauche, mode manipulation | Déplacer sur le plan horizontal relatif au regard |
| Joystick droit, mode manipulation | Pivoter |
| Une préhension, mode manipulation | Déplacer avec la main, hauteur comprise |
| Deux préhensions, mode manipulation | Déplacer, tourner et changer la taille selon l'écartement |
| Déplacer / Rotation / Taille | Ouvrir les réglages à boutons, tous utilisables à la gâchette |
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
- A/B utilisent les index 4/5 **uniquement** à droite pour les profils Touch connus, notamment [le profil officiel Touch Plus](https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/registry/profiles/meta/meta-quest-touch-plus.json). Les axes 2/3 sont définis par [WebXR Gamepads, mapping xr-standard](https://www.w3.org/TR/webxr-gamepads-module-1/). Aucun index n'est considéré comme universel.
- Les modèles sont les géométries provisoires existantes. Les ombres et le brouillard desktop sont désactivés en AR, les mises à jour HTML sont espacées. Les performances sur Quest, notamment avec une partie chargée en unités, restent à mesurer. Il n'y a pas d'occlusion par le mobilier réel, de suivi des mains nues ou de partage d'ancres entre casques.

Dans le débogueur du navigateur, `Eredita.XR.diagnostics` donne les fonctionnalités accordées, les profils/mains, le suivi, la taille, la sélection et l'état de l'ancre. Le diagnostic ne modifie aucune donnée de jeu. Le code ne peut pas vérifier la version réellement installée de Quest Browser avant que vous ouvriez le prototype sur ce casque.

## Tests automatiques effectués

```text
npm run test:xr
npm run test:xr-browser
node tests/network-server.test.js
npm test
```

Les deux suites XR et le test serveur passent. La suite XR utilise le vrai module Three.js pour vérifier géométrie, Raycaster, orientation Rouge/Bleu, limites, préhensions, profils, déconnexions, sources tardives et perte d'ancre. La suite navigateur utilise Edge sans fenêtre, le vrai rendu WebGL et un **périphérique XR simulé**. Elle vérifie le menu, le refus d'autorisation, l'activation au clic, les boutons 3D, les deux contrôleurs, le placement, les réglages, plusieurs entrées/sorties, le retour 2D/3D, ainsi qu'un salon avec hôte et invité AR recevant la construction faite sur le PC. Elle ne teste pas la couche WebXR native du casque. Les API simulées sont uniquement dans `tests/`.

Le test navigateur nécessite Node.js **22+** (WebSocket natif) et Edge sous Windows. `EREDITA_BROWSER` peut indiquer le chemin d'un Chromium différent. Il lance ses propres processus sur les ports 8787 et 9447 et les ferme après le test.

`npm test` rencontre deux échecs **préexistants**, dans `tests/special-animals.test.js` : les assertions de dégâts continus du sanglier attendent 2 dégâts sur un quart de seconde, alors que le moteur et le GDD actuels appliquent un impact de 8. Même résultat vérifié avec la configuration originale de `HEAD` et les modules métier inchangés. Ces tests et les règles de combat n'ont pas été modifiés dans cette adaptation. Les suites suivantes, bloquées par le `&&` après cet échec, ont été exécutées séparément et passent : âne, modèles 3D des animaux, animations de combat et decks. Les suites noyau, IA, achats d'élevages, équipements, apparences 3D et commandes réseau passent également.

## Vérification physique à faire sur le Quest 3

**Non réalisée ici : aucun casque accessible.** Noter la version du navigateur, les permissions accordées et les éventuels messages de diagnostic.

- [ ] Depuis le menu, lancer l'AR et vérifier que la vraie pièce reste visible en passthrough, sans fond opaque.
- [ ] Refuser une autorisation puis réessayer ; vérifier que le desktop reste utilisable.
- [ ] Viser une table connue du casque ; vérifier repère et aperçu, puis confirmer à la gâchette.
- [ ] Viser un mur, une zone lointaine et le sol : aucune identification automatique comme « table » ; vérifier les limites et la confirmation volontaire.
- [ ] Tester sans hit-test et avec la case de lancement simplifié ; ajuster la hauteur manuellement jusqu'à la table.
- [ ] Vérifier une largeur initiale de 80 cm, les quatre villages du joueur près de lui et l'eau littorale vers le centre, côté Rouge puis côté Bleu.
- [ ] Sélectionner les huit villages avec chaque contrôleur ; comparer PV, habitants, ressources et bâtiments avec le desktop.
- [ ] Ouvrir et fermer une fiche par gâchette, A, B et bouton Fermer ; vérifier la lisibilité assis et l'absence de masquage gênant.
- [ ] En mode interaction, manipuler joysticks/préhensions : aucun déplacement du plateau.
- [ ] En mode manipulation, déplacer et tourner avec les joysticks, saisir à une main, puis agrandir/réduire à deux mains ; vérifier les limites et l'absence de saut au relâchement.
- [ ] Faire les mêmes réglages uniquement avec les boutons 3D à la gâchette ; tester Recentrer, Annuler et Terminer.
- [ ] Déconnecter chaque contrôleur, masquer brièvement le suivi puis le rétablir ; vérifier l'absence de sélection fantôme.
- [ ] Tester le recentrage système et la perte d'ancre ; vérifier suivi ou demande de nouveau placement selon les capacités disponibles.
- [ ] Lancer une partie PC ↔ Quest et, si disponible, Quest ↔ Quest : mêmes états, positions physiques indépendantes, pas de double simulation.
- [ ] Quitter via Quitter AR puis via l'interface système ; rentrer de nouveau, vérifier absence de duplication et nouveau placement requis.
- [ ] Après sortie, tester menus, boutique, sélection desktop, pause/reprise, vues 2D/3D et salon toujours connecté.
- [ ] Vérifier le confort et la fluidité pendant plusieurs minutes avec plusieurs bâtiments, habitants et combats.
