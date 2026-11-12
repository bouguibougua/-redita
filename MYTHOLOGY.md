# Renforts mythologiques — Eredità

Les dix-sept pouvoirs confirmés sont intégrés à la partie. Le catalogue existant,
le cristal, les rayons, le délai de 500 ms et les deux choix symétriques sont
réutilisés. L’ancien constructeur de decks, la main, la pioche et les anciens
déblocages mythologiques à 5/10 minutes sont supprimés du dépôt.

## Tester dans une vraie partie

1. Lancer `npm start`, puis ouvrir `http://localhost:8765/?intro=0`.
2. Choisir **JOUER → ENTRAÎNEMENT** ou **MULTIJOUEUR → LOCAL**.
   Confirmer les biomes et lancer la partie.
3. Cliquer sur le cristal jaune centré en haut. Après les rayons et 500 ms,
   les deux propositions se déploient. Choisir directement une illustration.
4. Le choix obtenu apparaît immédiatement dans le panneau latéral **LÉGENDES**,
   en image normale au format parallélogramme. Ce panneau remplace les blocs
   **Banque locale** et **Réserve de barques**. Cliquer sur l’image puis sur
   une région ou une colonne compatible du plateau 2D/3D. Pour un pouvoir
   global, cliquer sur n’importe quelle région du terrain. Ni liste de cible
   ni bouton « Utiliser ». La surbrillance dorée indique les cibles possibles.
   Échap, Annuler ou un second clic sur l’image annulent la préparation.
   Une cible invalide conserve le renfort ; après validation son image quitte
   le stock, sans effacer l’historique privé. Les banques et barques conservent
   leurs données ; les stocks restent consultables dans les villages/boutiques.
5. La sélection et l’utilisation sont distinctes : choisir ne lance aucun
   pouvoir. Le stock permet de conserver plusieurs exemplaires de la même
   légende provenant de propositions différentes.
6. Ne rien choisir jusqu’à 4:00 de combat pour obtenir trois propositions
   (compte à rebours 8:30). Le compteur fait 3 → 2 → 1 → 0 à mesure des choix.
   Le cristal suivant se réarme immédiatement mais exige toujours un nouveau
   clic. Préparation et pauses ne comptent pas dans les échéances.
7. Recommencer une partie : files, stock et effets repartent de zéro.

Pour le réseau, ouvrir deux navigateurs sur le relais, créer un salon côté
Rouge, le rejoindre avec le code côté Bleu, confirmer puis lancer côté hôte.
Chaque connexion ne reçoit que ses propositions et son stock. Une activation
est validée par le relais, exécutée par l’hôte, puis confirmée au propriétaire.
Le mode local sur un seul écran suit le camp sélectionné ; ce n’est pas une
protection contre la personne qui partage physiquement cet écran.

Pour consulter les illustrations sans démarrer : **LÉGENDES** au menu principal.
Le grimoire présente une grande fiche et une galerie des dix-sept légendes en
parallélogrammes. Cliquer sur une miniature affiche son illustration et son
pouvoir ; les filtres limitent la galerie à une catégorie. Le clavier permet
également de parcourir les miniatures. Sur téléphone, l’image apparaît au-dessus
du texte. Le fond réutilise `assets/deck-library.webp`. Chaque clic sur une
légende (ou activation au clavier) joue le son de papier existant, une seule
fois, en respectant la sourdine. L’ouverture du menu et les filtres restent
silencieux. Les fiches développées précisent les cibles et limites confirmées
depuis `gameplay.menuDescription`, dans le même catalogue `mythology-data.js`.
U Diavule conserve sa description publique spéciale. Les résumés des choix
en partie et les mécaniques restent inchangés. La consultation ne modifie
pas la partie.

Le cristal situé à droite de l’illustration utilise la palette de cette légende.
Des particules magiques flottent en permanence autour du cristal. Au survol
(ou au focus clavier), des éclairs parcourent ses arêtes, pointes et faces
latérales en restant à sa surface. Ils s’arrêtent dès que le pointeur sort ;
le focus laissé par un clic ne les maintient pas. Le rendu ambiant est limité
à 30 images/s et suspendu hors écran, dans un onglet masqué ou en mouvement réduit.
Cliquer **SON HISTOIRE** fait éclater ses facettes, glisser l’image à gauche
et apparaître le récit à droite ; le cristal se reforme à gauche. Cliquer
**SON POUVOIR** effectue le mouvement inverse. Entrée/Espace et le toucher
activent le même bouton. Les clics pendant une transition sont ignorés et
changer de légende annule la transition en cours. Avec mouvement réduit,
la bascule est immédiate, sans éclatement ni glissement.

Les seize textes fournis par le concepteur sont conservés dans `entry.lore`
du catalogue existant, séparés des paramètres de gameplay. Les mentions de
sources et les noms de sites du document ne sont pas affichés. Les récits
longs défilent dans leur zone de lecture ; sur mobile, le texte est placé
sous l’illustration et le cristal. Une seule instance du renderer existant
est réutilisée pour toutes les fiches, puis libérée à la fermeture du menu.
Les durées et le nombre d’effets du grimoire sont regroupés dans
`Config.mythology.codex` ; les rayons et choix en partie gardent leur animation.

**A Strega Bianca** possède également la vidéo fournie par le concepteur.
Cliquer son cristal lance la préparation du MP4, puis révèle l’animation avec
un léger flash blanc dans le parallélogramme au passage à **SON HISTOIRE**.
Au retour à **SON POUVOIR**, le même flash accompagne le retour de l’image
originale. La vidéo est muette, en boucle, et ne télécharge rien avant le clic.
Elle attend une image décodée pour apparaître ; en cas de refus de lecture,
l’image reste visible. La lecture s’arrête hors écran, dans un onglet masqué,
au changement de légende ou à la fermeture du menu. Le mouvement réduit
conserve l’illustration et supprime les flashs et la lecture automatique.

Les clips facultatifs sont définis par `visuals.motion` dans le même catalogue,
sans second catalogue. A Strega Bianca et U Diavule disposent actuellement
d’une animation ; les autres fiches gardent leur illustration. Le MP4 de
A Strega Bianca, H.264 à 30 images/s, est
optimisé en boucle aller-retour avec ralentissement aux extrémités ; les
caractéristiques de préparation sont dans `assets/mythology/MOTION.md`.

**U Diavule** possède un GIF de quatre secondes avec une flamme peinte ancrée
dans sa main, une lumière chaude et des braises. Le personnage et le décor
proviennent de l’illustration originale intacte. Le menu lit la version MP4
à 30 images/s avec exactement les mêmes flashs et le même retour à l’image.
Le GIF téléchargeable reste dans `assets/mythology/u-diavulu-motion.gif`.
La description publique spéciale et les effets de jeu sont conservés.

En partie, le même chronomètre apparaît directement sous le cristal :
préparation, combat, pause et Overtime suivent toujours l’horloge existante.
Il reste entre les deux propositions lorsqu’elles s’ouvrent. Le panneau
**Vos légendes** reprend les couleurs et les détails du grimoire, avec les
illustrations et le ciblage existants.
Pour l’animation seule : `http://localhost:8765/?intro=0&crystal=preview`, choisir
deux légendes, cliquer le cristal, sélectionner puis rejouer. Cet aperçu ne
déclenche aucun pouvoir et n’ajoute rien au stock de partie.

L’hébergement statique utilise aussi les URL relatives sous `/-redita/`.
GitHub Pages prend en charge les modes hors ligne ; le multijoueur a toujours
besoin du relais WebSocket existant.

## Architecture réutilisée

| Fichier | Responsabilité |
| --- | --- |
| `js/mythology-data.js` | Unique catalogue : identités, alias, illustrations, couleurs, catégories, descriptions, paramètres, cibles et état. |
| `js/mythology-effects.js` | Validation de cible, effets, morts, résurrections, vision, unicité d’exécution et mise à jour sur l’horloge du jeu. |
| `js/mythology-crystal.js` | Rendu Three.js existant du cristal, rayons et éclairs ; indépendant des pouvoirs. |
| `js/mythology-ui.js`, `css/mythology.css` | Choix, collection des dix-sept légendes, stock et commandes d’utilisation. |
| `js/mythology-match.js` | Autorité : tirage, FIFO privée, sélection, réservation et confirmation d’activation. |
| `js/mythology-session.js` | Raccordement à une partie, compteur, choix et stock du joueur courant. |
| `server-mythology.js`, `server.js`, `js/network.js` | Même catalogue/règles dans le relais, messages privés et exécution de l’hôte. |
| `js/config.js` | Valeurs confirmées et valeurs temporaires regroupées dans `reinforcementPowers`. |
| `js/economy.js`, `js/combat.js`, `js/board3d.js`, `js/ui.js` | Hooks dans les systèmes existants, sans moteur d’économie ou de combat parallèle. |

Les villages, ressources locales, or, achats, capacité d’habitants, métiers,
tâches et combat gardent leurs systèmes. Les effets modifient seulement les
entités ou calculs concernés par un pouvoir demandé.
Les effets de terrain et la vision dépendent directement de `MythologyEffects`.
Le bonus d’Artisanat dépend de `Buildings.updateArtisanatBonuses`, avec les mêmes
statistiques, la conservation des blessures et sans cumul. L’ancien moteur de
cartes, ses composants, styles, illustrations, paramètres et tests ont été retirés,
ainsi que ses branches inaccessibles de moulin, tour, sentier, piège et charrette.
Le fond de bibliothèque reste utilisé par le grimoire. Les embarcations et les
achats de la boutique restent disponibles.

## Pouvoirs confirmés

| Légende | Effet |
| --- | --- |
| U Mazzeru | Archer invoqué : 45 PV, 15 dégâts, un tir toutes les 9 s. Vise globalement le plus proche non marqué ; Mauvais Présage exécute à 15 % des PV max. Chaque mort marquée donne +15 PV max aux Mazzeri alliés vivants. |
| A Strega | Rendement d’une région ennemie ×0,5 pendant 120 s. |
| U Stregu | Rendement d’une région alliée ×2 pendant 120 s. |
| A Fata | Rivière et vitesse de pêche +25 % dans la région choisie. |
| Anima in Pena | Une âme par mort allié de la colonne, 1 PV / 1 DPS, tâches possibles mais métiers interdits. |
| L’Orcu | Invocation de 200 PV / 30 dégâts, très lente. |
| Le Lion de Roccapina | Invocation de 145 PV / 25 dégâts par coup ; regroupement des troupes militaires alliées à avancement identique. |
| U Magu | Uniquement le prochain habitant de chaque village allié : statistiques ×2, taille ×1,5, aura violette et dorée. |
| U Surpatore | Sanglier puis vampire : 40 PV / 11 dégâts. Le vampire marque et conserve sa victime jusqu’à sa mort ; le sanglier ne marque pas. |
| U Lupu Mannaru | Transforme un humain libre sans métier, sinon le prochain nouveau-né : 60 PV / 20 dégâts de base. Champs et élevages au contact en priorité, puis village ; aucune attaque contre les troupes. |
| U Diavule | Brûle les deux territoires de la colonne, cultures, élevages et habitants dehors. Bâtiments et habitants dans les villages épargnés. |
| A Strega Bianca | Pendant les prochaines 60 s, sauve les humains qui devraient mourir : retour au début du terrain, pleine vie, tâche et équipement conservés, aura verte et dorée. Pas de timer affiché, pas de légendes ni de morts antérieures. |
| A Squadra d’Arozza | Ressuscite les humains morts durant les dernières 60 s, sans double résurrection. |
| A Mumma | Fait repartir les intrus ennemis des territoires alliés. |
| I Lacramanti | Humains alliés de la colonne : +2 PV / +1 dégât par mort allié depuis le début, pas les légendes. |
| U Fullettu | Cinq follets, 20 PV / 0 dégât, très rapides ; vol de ressources ennemies directement vers la banque locale alliée. |
| Œil de Sainte-Lucie | Ancien pouvoir de vision des Littoraux ; ils sont désormais toujours visibles, sans bonus de remplacement. |

La seule description affichée pour U Diavule est « Anéantit le village de
votre adversaire. », conformément à la demande. Sa description mécanique
complète reste dans le catalogue. Son terrain brûlé dure toujours 120 s ;
le village d’origine doit être vivant. L’ancienne exception de dégâts aux
bâtiments depuis une Montagne est retirée.
A Squadra conserve le retour au village d’origine ou au plus proche survivant
et l’attente si l’accueil est plein/brûlé, selon les règles existantes.

Les identifiants historiques `a-stregha`, `u-diavulu`, `i-lacrimenti` et
`oeil-sainte-lucie` sont conservés ; les noms demandés sont résolus par alias.
A Mazzera, visible dans la planche mais absente des seize pouvoirs fournis,
n’est pas ajoutée.

## Illustrations et couleurs

Les seize illustrations normales existent dans `assets/mythology/{id}.webp`,
en 1536 × 1024, environ 112 à 213 Ko chacune.
Elles ont été générées individuellement avec **image_gen intégré**, dans un
traitement graphique sombre : silhouettes fortes, couleurs limitées et
réalisme réduit à la demande du concepteur. Ce sont des interprétations,
pas des découpes exactes de la planche absente du système de fichiers.
Les prompts complets et fichiers finaux sont dans
`assets/mythology/generation.json`.

Aucune illustration normale ne manque. Les seize variantes inversées distinctes
sont absentes : le fallback CSS ne retourne que l’illustration à droite,
jamais le texte, les icônes ou la géométrie.
Les couleurs sont centralisées dans `mythology-data.js` et marquées
`paletteStatus: 'provisional'`, d’après la référence ; ce ne sont pas des
couleurs définitives inventées. Une couleur manquante est signalée par
`getCrystalPalette` et dans l’aperçu.

Les valeurs qualitatives non chiffrées par le concepteur restent explicitement
temporaires dans `Config.reinforcementPowers` : vitesses d’Orcu, du vampire
et des follets, cadence/quantité de vol, position d’invocation.
Le sanglier de Surpatore réutilise l’archétype existant.

## Réseau et événements

Le relais détermine le propriétaire depuis la connexion, conserve l’ordre FIFO,
valide l’offre obtenue, interdit une sélection arbitraire et réserve l’activation.
Le navigateur hôte valide la cible dans le monde courant puis exécute.
Le journal public `state.mythology.executions` rend les réessais idempotents.
Seul l’hôte peut confirmer le résultat au relais.

L’hôte ne reçoit pas le stock privé Bleu ; il apprend la légende explicitement
utilisée au moment de son exécution. Les effets publics sont diffusés avec la
simulation. Le prototype conserve l’autorité de simulation du navigateur Rouge :
ce chantier ne remplace pas le relais par un serveur de jeu entièrement autoritaire.

L’événement existant `eredita:mythology-select` reste celui du choix visuel.
Après validation, `eredita:mythology-collected` annonce uniquement au propriétaire
la légende obtenue. L’aperçu ne l’émet pas.
`MythologySession.getObtainedLegends()` dérive le stock des confirmations privées.

`Config.reinforcements` conserve `intervalSeconds: 120`, `pendingPolicy: 'fifo'`
et le mode développement. Les dix-sept pouvoirs étant implémentés, aucune fiche
ne reste « non configurée ». Si une future fiche est incomplète, son test visuel
reste possible sans activation :
`Eredita.Config.reinforcements.development.includeUnconfigured = true`
avant une nouvelle partie locale ; en réseau, utiliser
`EREDITA_MYTHOLOGY_DEVELOPMENT=1 npm start` côté relais.

## Vérifications

```sh
npm test
npm run test:crystal
npm run test:mythology-browser
npm run test:reinforcements-browser
npm run test:powers-browser
npm run test:menu
npm run test:xr
```

Les tests métier couvrent les dix-sept effets, les statistiques, la durée et les
cibles, la conservation des ressources, les résurrections, la vision et
l’unicité. Les tests navigateur couvrent le catalogue sous `/-redita/`,
les images normales/inversées, le délai de 500 ms, la symétrie, le FIFO
3 → 2 → 1 → 0, le réarmement manuel, la pause et la remise à zéro.
Le parcours de pouvoirs vérifie l’ajout immédiat de l’image au panneau, le
parallélogramme, U Magu par clic 3D sur un terrain, A Strega sur une région
ennemie en 2D et I Lacramanti sur une colonne en mode tactile. Il couvre
l’annulation, la pause et la conservation des cibles refusées, puis utilise
deux clients du relais : activation invitée unique et stock adverse inaccessible.
Le mobile est simulé à 390 × 844 ; les erreurs JS/console/HTTP sont contrôlées.

Captures facultatives :
`EREDITA_LEGENDS_PREVIEW_DIR=/tmp/eredita-legendes npm run test:powers-browser`.

## Limites connues

* Les figurines 3D réutilisent les archétypes existants, teintés et redimensionnés ;
  elles ne sont pas encore des modèles sculptés propres aux seize légendes.
* L’IA ne choisit ni n’utilise encore ses renforts. Le tutoriel ne reçoit pas
  de propositions supplémentaires.
* Le cristal et le stock sont HTML : utilisables dans la fenêtre 2D du navigateur,
  pas encore dans les panneaux WebXR immersifs. Pas de validation matérielle Quest.
* Les ressources et la visibilité du monde restent dans le snapshot partagé,
  comme avant ; seules files et sélections sont privées côté relais.


## Lion de Roccapina — ajout du 12 novembre 2026

Dix-septième renfort demandé par le concepteur : invocation de **145 PV et 25 dégâts par coup**. À son placement, seuls les guerriers, ravageurs et archers alliés déjà déployés rejoignent sa colonne ; leur avancement longitudinal, leurs blessures, leur équipement et leur village d’origine sont conservés. Les troupes adverses, travailleurs en défense automatique, animaux et autres légendes restent en place. La redirection courante est annulée ; les règles existantes de rappel, bateau et noyade s’appliquent ensuite. La vitesse 5 reste provisoire dans `Config.reinforcementPowers.roccapinaSpeed`.

Le récit fourni évoque le guerrier transformé en lion de granit après un amour impossible (source transmise : Pozzo di Borgo). Le GLB fourni est copié dans `assets/models/lion-roccapina.glb` ; aucun clip n’y est présent. `roccapina-model.js` normalise sa hauteur, partage ses géométries/textures et donne à chaque instance ses matériaux et son squelette. La version armée utilise cinq clips ajoutés au squelette fourni : Repos, Marche, Frappe_Droite, Frappe_Revers et Mort. Son épée fournie est attachée à la paume droite ; les vraies frappes du moteur déclenchent les deux attaques en alternance. Sa hauteur visuelle est réduite à 0,60 unité, proche du Guerrier. Toutes ces animations respectent la pause.

La vidéo fournie est conservée dans `assets/mythology/lion-roccapina-motion.mp4`. Le poster WebP 1280×720 est extrait à une seconde de cette vidéo. Aucun asset généré ni crédit Tripo consommé. La fiche est disponible dans le grimoire, les propositions aléatoires et le stock existants.

Validation : `npm test`, `npm run test:roccapina` et test navigateur spécifique du grimoire du Lion. Le test spécifique utilise des états contrôlés pour vérifier les trois métiers, les deux camps/formats, la conservation des origines, les refus/rejeux, le dégât exact, la pause, le GLB, les illustrations et la vidéo du récit. Captures dans `eredita3D/previews/roccapina-*.png`. Aucun test physique Quest ni multijoueur visuel à deux clients réalisé pour ce nouveau modèle ; les validations d’autorité existantes font partie des tests généraux.

Le test historique `mythology-browser.test.js` échoue sur son attente d’un GIF de U Diavule : la référence actuelle associe déjà un MP4 au grimoire, et le GIF optionnel manque dans les assets locaux. Cet échec, extérieur au Lion, est conservé explicitement ; le scénario spécifique vérifie la vidéo, le récit et les compteurs à 17.


### Préparation du Lion armé

`eredita3D/scripts/prepare_roccapina.py` importe les deux sources locales intactes, ignore la forme de contrôle Icosphere, conserve la pose de base, allège l’épée à 6 000 triangles, limite les textures à 1 024 pixels et crée les cinq clips avec Blender. Le GLB web complet fait environ 7 Mo, contre 67 Mo pour la seule épée originale. Les dimensions et durées visuelles restent dans `characterModels.roccapina`, sans changement des 145 PV, 25 dégâts ou du regroupement allié. Empreintes et mesures dans `eredita3D/logs/roccapina-animation-validation.json` ; aperçu comparatif Guerrier/Lion/repos/frappe dans `eredita3D/previews/roccapina-armed-comparison.png`.


## Champs et enclos au contact — 12 novembre 2026

Nouvelle règle du concepteur : le Ravageur et U Lupu Mannaru rejoignent physiquement les champs et élevages adverses de leur colonne avant de frapper. Cela remplace l’ancienne exclusion de Lupu de la priorité sur les cultures. Les zones de contact utilisent les positions réelles des slots en 3D ; les rayons provisoires restent centralisés dans `economicHitboxes`. Les coups suivent les animations et la cadence existantes, avec le bonus spécialisé +5 du rôle Ravageur. Après destruction des cibles économiques, retour au centre et progression habituelle ; Lupu ignore toujours les troupes. Le Sanglier garde son comportement précédent.


## U Mazzeru et Mauvais Présage — nouvelle règle du 12 novembre 2026

L’invocation remplace l’ancien pouvoir de vision sous le même identifiant `u-mazzeru`. Le concepteur a confirmé les travailleurs comme cibles et le gain à toute mort marquée, quelle qu’en soit la cause. Tir global prioritaire sur le plus proche non marqué, immobilité durant cette phase, 45 PV/15 dégâts/9 s ; tous marqués : déplacement et portée habituelle de l’archer, cadence toujours 9 s. L’impact applique dégâts et marque, puis l’exécution au seuil inclusif de 15 % des PV max. Aucun cumul de marques ni soin gratuit avec le gain de +15 PV max. Les morts marquées par le vampire ouvrent également le gain. Pour plusieurs Mazzeri, le partage actuel à tous les alliés vivants est un réglage provisoire centralisé (`growthRecipients`), non une règle définitive ajoutée.

`bad-omen.js` gère identités, cibles locales et déployées, flèches en vol, exécutions et gains ; le moteur de combat conserve les protections et morts existantes. Le vampire verrouille sa victime jusqu’à son décès, sans changer de cible parce qu’une autre n’a pas de marque. Le logo fourni s’affiche au sol et la barre conserve une zone rouge fixe à gauche ; les gains de Mazzeru ont une pulsation rouge. Les paramètres temporaires restent dans `config.js`.

Modèle et arc fournis, sans génération nouvelle : `prepare_mazzeru.py` produit un GLB d’environ 1,8 Mo, arc 6 000 triangles et quatre clips. Tests : `npm run test:mazzeru`, suite générale et contrôle de marche. Captures et mesures dans `eredita3D/previews/mazzeru-*` et `eredita3D/logs/mazzeru-animation-validation.json`.
