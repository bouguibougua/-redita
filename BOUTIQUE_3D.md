# Boutique 3D immersive — suivi et analyse

Dernière mise à jour : 18 novembre 2026. Référence de départ du 16 novembre : commit `1a433d2`.

**Construction autorisée par le concepteur (« je te donne l’accord »), puis poursuivie à sa demande.**
La scène PC, les objets indépendants, la pancarte VINDUTU, les interactions, la progression
et les confirmations économiques sont implémentés. La réorganisation du panneau
principal et l’intégration du même étal dans WebXR restent les lots suivants.

## Livraison actuelle — état du code

- `js/shop-scene.js` gère la caméra fixe, les 22 articles, le décor en volume,
  les zones rectangulaires invisibles, les articles verrouillés et les mouvements réduits.
  La zone de sélection est calculée à partir du modèle au repos. Si deux zones
  se recouvrent, celle de l’article le plus proche de la caméra a la priorité.
- Les modèles de la refonte sont dans `assets/models/shop/v2/`. Le fichier
  `assets/models/shop/collier.glb` est la version optimisée du collier fourni
  qui représente le chien. Le sanglier reste une tête murale.
- La barque agrandie est placée plus bas devant la table inclinée de la
  Boucherie. Les deux pièges sont plus grands et décalés à droite. Le cochon
  est devant la vache. Les enseignes affichent Bergerie, Artisanal et Boucherie.
- Au survol, l’article s’éclaire, grossit, avance et s’incline suivant le
  pointeur, puis revient au repos. Les conditions d’achat s’appliquent.
- Pancarte locale en bois avec inscription exacte VINDUTU. Usure diffuse et discrète
  du support après épuisement ; emplacement et autres marchandises conservés.
- Pierre → Bronze → Fer et Cuir → Mailles → Fer obligatoires, indépendants, prix/bonus
  conservés, héritage des habitants actuels/futurs et anciens états équipés préservés.
  `bois` reste une clé de compatibilité, affichée Pierre.
- `js/shop-transactions.js` : reçus identifiés, déduplication pendant la partie, montant
  exact de la transaction et retour sonore après validation. L’invité attend l’hôte ;
  un refus ou une répétition réseau ne rejoue pas le son et ne débite pas l’or.
- Son fourni copié dans `assets/audio/interface/shop-purchase.mp3` ; vente plus discrète,
  muet respecté. Les devis et commandes sont communs aux interfaces PC et XR existantes.
- Village détruit : ouverture refusée, transactions bloquées. Chronomètre et simulation
  continuent ; rendu du plateau PC suspendu derrière la boutique pour limiter le GPU.
- Un seul renderer boutique, limité à 30 images/s et DPR 1,5, ombres statiques 2 048,
  géométries fusionnées par matériau à l’intérieur des articles. Arrêt du rendu quand
  fermé ou en Gestion ; repli illustré si WebGL échoue. Aucune mesure matérielle Quest.

### Coût du lot initial — historique

| Étape | Tâche | Crédits |
| --- | --- | ---: |
| `text_to_model`, P1, pancarte texturée PBR | `001e493d-4946-427e-8fe5-7fcda7167f0b` | **40** |
| Optimisation locale Blender, textures 512 | Sans tâche Tripo | 0 |
| **Total** | Une seule génération, aucun reroll | **40** |

CLI 0.7.2 installée avec l’accord reçu, sous `/Users/robin/.local` ; `doctor` et dry-run
réussis avant génération. Métadonnées du coût dans
`assets/shop/tripo-out/vindutu-sign-001e493d/task.json`.

Les sections d’audit ci-dessous décrivent le point de départ du lot 1 ; elles sont
conservées pour expliquer les choix. La section finale « Refonte de tous les modèles
et survol vidéo » décrit la dernière livraison et ses 800 crédits facturés.

## Demande et références examinées

- Cahier des charges : `/Users/robin/.codex/attachments/4c3e4ec2-64b8-4af5-b470-5fcab835296a/Texte collé.txt`.
- Illustration : `/Users/robin/Desktop/boutique.png`. Conserver l'échoppe corse, bois chaud, pierre, tissus, animaux à gauche, équipements au centre/droite et ressources devant. Le cadre du navigateur ne fait pas partie du décor.
- Vidéo : `/Users/robin/Desktop/Enregistrement de l’écran 2026-11-16 à 14.24.17.mov`, durée mesurée 2,497 s ; images extraites à 20 %, 50 % et 80 %, début et fin examinés. Elle montre notamment la sélection par contour de l'objet. Retenir ce principe d'interaction, sans reprendre le décor, les objets, la composition ni les fenêtres de The Forest.
- Son d'achat : `/Users/robin/Downloads/song achat.mp3`, accessible, durée mesurée 1,855 s ; pas encore importé ni évalué à l'écoute.
- `AGENTS.md`, sections concernées de `GAME_DESIGN.md`, boutique HTML/SVG/CSS, configuration, transactions, commandes réseau, sélection de carte, chargement des modèles et interfaces XR examinés.

L'image contient une infobulle avec prix et bouton « Acheter ». Le texte demande explicitement **aucune infobulle**, aucun prix sur les objets et un achat direct : ces instructions textuelles priment sur ce détail de l'image. Le mode Simplifié possède déjà deux villages par joueur ; conserver aussi les quatre villages du Classique et du tutoriel, sans les supprimer.

## État initial — audit du lot 1

| Élément | Constat dans le code |
| --- | --- |
| Rendu boutique | Décor PNG, marchandises découpées avec masques SVG et hit-test alpha/Path2D ; ce n'est pas une scène 3D. 22 objets visuels, dont six paniers et deux pièges inactifs. |
| Moteur disponible | Three.js local 0.186.0, GLTFLoader, rendu du plateau et WebXR existants. Aucun changement de moteur nécessaire. |
| Transactions | La boutique appelle le contrôleur existant : `buyEquipment`, `buyAnimal`, `buySpecialAnimal`, `buyShopItem`, `sell`. Aucun besoin d'une seconde banque. |
| Or et stocks | Or global par joueur, ressources/équipements/historique d'achats/flotte/animaux par village. |
| Villages | Navigation dynamique à deux ou quatre villages selon le format. L'ouverture n'arrête pas la simulation. |
| Achats uniques | Historique `equipmentPurchases`, six références d'équipement uniques ; barque limitée à une, filet à trois. Disparition actuelle sans pancarte. |
| Progression | Le tier du bâtiment est requis, **pas l'achat du tier d'équipement précédent**. Un Artisanat T3 autorise actuellement l'achat direct du fer. |
| Équipement collectif | Les humains actuels et futurs du village, y compris combattants déployés, reçoivent l'équipement ; légendes et animaux exclus. Remplacement des bonus, pas addition des tiers. |
| Animation | Respirations et petits mouvements de silhouettes CSS, reflets, particules, variations d'or de 1,2 s. Pas de matériaux ou ombres 3D dans la boutique. |
| Verrouillage | Les devis refusent les achats interdits. Le survol et le scintillement devront être strictement limités aux objets disponibles dans le nouveau rendu. |
| Retour d'achat | Déduction d'une variation d'or et d'inventaire avec un achat en attente ; pas d'accusé de transaction identifié. Le nouveau son n'est pas intégré. |
| Village détruit | Les transactions sont refusées, mais la boutique peut encore s'ouvrir et les onglets restent sélectionnables : adapter l'accès. |
| Réseau | Le relais attribue l'identité de l'invité, l'hôte valide/exécute les commandes économiques et republie l'état. Le serveur n'est pas une seconde simulation économique. |
| Quest | Boutique actuelle en panneaux XR utilisant les mêmes commandes ; pas encore la scène d'étal demandée. Aucun test matériel de cette future scène. |

## Règles économiques à réutiliser

Prix ci-dessous relevés dans `js/config.js`, avec les statuts provisoires déjà présents dans le GDD conservés. Ce tableau ne remplace pas la configuration.

| Article | Prix en or | Condition et comportement actuels |
| --- | ---: | --- |
| Chèvre / cochon / vache | 50 / 65 / 90 | Bergerie T1 ; un animal par achat. Enclos vivant compatible choisi aléatoirement, sinon slot libre compatible. Achats répétables. |
| Âne | 150 | Bergerie T2. Attribution automatique dans le village à un agriculteur puis à un berger disponible. L’âne attend à la base si personne ne peut le recevoir. |
| Chien / sanglier | 120 / 180 | Bergerie T3 ; compagnons répétables conservés dans le village avant ordre. |
| Outils bois / bronze / fer | 150 / 250 / 400 | Artisanat T1 / T2 / T3 ; +5 / +10 / +20 dégâts. Bois : +20 % vitesse de production ; bronze/fer : +30 % / +50 % rendement. |
| Armures cuir / maille / fer | 150 / 250 / 400 | Artisanat T1 / T2 / T3 ; +15 / +35 / +50 PV. Filière indépendante des outils. |
| Barque | 100 | Boucherie T1, tous biomes, maximum 1, deux places réutilisables ; embarquement automatique. |
| Filet | 75 | Boucherie T1, Littoral, maximum 3 ; +1 poisson par filet toutes les 30 s, fonctionnement automatique. |
| Voilier | 350 | Boucherie T3, Littoral, maximum 2, quinze places par voilier. Conserver son accès même s'il n'est pas dans l'illustration. |
| Pièges | Non achetables | Chasse au catalogue T2, défensif T3 de Boucherie. Limites futures 10 et 5 déjà configurées. Aucune nouvelle activation. |

Ventes exactes ×10 / ×100 / ×1000 : blé 1, châtaigne 1,5, raisin 1,5, viande 2, poisson 2, lait 1 or/unité. Le meilleur bonus de bâtiment applicable est conservé, +5 % par niveau, sans cumul. Un lot insuffisant est refusé intégralement. Les devis d'achat examinés n'appliquent pas de réduction de prix ; ne pas inventer un rabais en interprétant les bonus de revente comme des remises.

Les devis refusent notamment pause, partie inactive, village détruit, manque d'or et prérequis absents. Certains refusent aussi le terrain brûlé ; conserver les distinctions actuelles, sans uniformisation arbitraire.

### Changements identifiés au lot 1 — maintenant appliqués

1. **Pierre T1 remplace l'appellation et l'apparence Bois T1** dans la nouvelle demande. Conserver prix et bonus du T1 existant, sans ajouter de ressource pierre. Une clé technique historique `bois` peut rester temporairement pour la compatibilité ; harmoniser les libellés, les rendus et le GDD lors du lot Progression.
2. **Achats T1 → T2 → T3 obligatoires**, indépendamment pour outils et armures, en plus des bâtiments requis. Contrôle dans `Equipment.quote/buy`, partagé par PC, XR, IA et commandes de l'invité. Les tests qui achètent directement un tier supérieur devront être adaptés. Conserver les équipements des états déjà existants, sans inventer des achats ni prélever rétroactivement de l'or.
3. Après épuisement du stock, laisser l'emplacement vide avec une trace discrète et la pancarte **VINDUTU**. Ne pas déplacer les autres articles. Filet après le troisième achat, barque après le premier, équipement après achat ; conserver le plafond de deux voiliers.
4. Ajouter le son fourni uniquement après validation de la transaction. Une dépense rejetée ne doit provoquer ni disparition ni son de réussite.
5. Refuser l'ouverture pour un village détruit ; si destruction pendant l'ouverture, invalider immédiatement les actions de ce village et garder Retour/navigation vers un village vivant.

### Règles sans définition à ne pas inventer

- Les pièges restent inactifs selon les confirmations antérieures. Leur placement, leurs consommations et leur activation ne font pas partie de cette refonte ; une future activation demandera une règle explicite.
- Le GDD §36 prévoit une réduction d'achat en Montagne de -10/-20/-30, mais précise que son unité (pourcentage ou valeur fixe) reste à confirmer. Elle n'est pas appliquée par les devis d'achat examinés. Ne pas l'activer dans cette refonte ; demander sa définition avant toute implémentation future.
- Aucun nouvel objet achetable ni nouveau prix pour le décor, les pancartes ou les paniers.
- La barque et le filet sont automatiques aujourd'hui : leur présence éventuelle dans une zone d'équipements doit renseigner leur état, sans imposer un placement manuel supplémentaire.

## Inventaire 3D réutilisable

56 GLB trouvés dans `assets/models`. Les fichiers d'exports dans `eredita3D/exports` ne sont pas de nouveaux modèles distincts à régénérer. Les nombres ci-dessous proviennent de la lecture des primitives GLB, pas d'une estimation Tripo.

| Source | État et réutilisation |
| --- | --- |
| `assets/models/barque.glb` | 5 000 triangles, 1 matériau, ~0,46 Mio. Réutiliser directement avec une pose dédiée à l'étal. |
| `elevage_chevre_petit.glb` | 2 098 triangles pour enclos + chèvre, ~0,19 Mio. Le nœud `livestockRole=animal`, `animalIndex=0` permet d'isoler l'animal. |
| `elevage_cochon_petit.glb` | 2 206 triangles pour enclos + cochon, ~0,21 Mio, même séparation. |
| `elevage_vache_petit.glb` | 2 550 triangles pour enclos + vache, ~0,24 Mio, même séparation. |
| Variantes moyen/grand d'élevages | Déjà disponibles, mais inutiles pour montrer un représentant de chaque espèce. Réutiliser les matériaux et clôtures, ne pas charger les neuf variantes dans la boutique. |
| `js/board3d.js`, `animalModel` | Âne, chien, sanglier procéduraux, parties tête/oreilles/pattes nommées. À extraire en fabrique commune ; la fonction est actuellement privée. Qualité plus simple que l'illustration, mais véritable géométrie réutilisable. |
| `js/board3d.js`, `boatModel` | Voilier procédural disponible. Garder son accès et lui donner une représentation distincte de la barque. |
| `js/board3d.js`, `personModel` et modules de personnages | Outils/armes/armures représentés par des pièces procédurales et changements de matériaux ; pas de six modèles d'exposition autonomes prêts à charger. Réutiliser les matériaux et les formes pertinentes. |
| `ble_petit.glb`, `chataignier_petit.glb`, `vignoble_petit.glb` | Cultures complètes : 1 788 / 3 484 / 3 096 triangles. Éventuelles sources de détails, pas des paniers marchands prêts à l'emploi. |
| `chantier-construction.glb` | Ancienne pancarte de chantier Tripo, 1 425 triangles, ~0,74 Mio. Avec accessoires et socle ; ce n'est pas encore une petite pancarte suspendue VINDUTU. Référence de matériaux, sans l'écraser. |
| Bâtiments et terrains | Références de DA ; bâtiments complets fusionnés, pas des modules d'étal. Éviter de les charger uniquement pour récupérer un petit morceau de mur. |

Les GLB d'élevage inspectés ont **zéro animation**. Une respiration globale peut être procédurale ; les mouvements indépendants de tête/oreilles nécessitent de séparer ou déformer proprement la géométrie, ou un rig ultérieur. Ne pas annoncer un animal animé prêt à importer. Aucun rig payant n'est prévu pour le lot 2.

## Éléments manquants et prompts préparés

Dimensions indicatives de mise en scène, en mètres, à ajuster au cadrage : ce ne sont pas des valeurs de gameplay. GLB pour Three.js, une identité d'interaction par article, pas une boutique fusionnée. Les prompts constituent une liste de préparation, **pas une commande de génération de toute la liste**.

Préfixe artistique commun aux prompts : « Stylized Corsican medieval market prop, warm natural colors, hand-crafted Mediterranean look, readable silhouette, game-ready low-poly mesh, PBR materials, isolated object, no background, no modern elements, no logos, no text. »

| Nom / catégorie | Dimensions relatives / matériaux | Prompt individuel à ajouter au préfixe | Emplacement / animation | Production proposée |
| --- | --- | --- | --- | --- |
| Pancarte VINDUTU / signalétique | 0,40 × 0,18 × 0,025 ; bois patiné, deux cordelettes | Small horizontal weathered chestnut wood hanging sign, gently bevelled irregular edges, two short rope loops, broad flat blank front, no stand, no ground, no lettering. | Emplacement vendu ; léger balancement | **Tripo demandé** ; inscription exacte ajoutée localement sur sa face. GLB. |
| Charpente / décor | Étal env. 6 × 3,2 × 2 ; châtaignier | Modular rustic chestnut timber market-stall frame with thick posts and cross beams, open front, no merchandise. | Fond immobile | Géométrie locale modulaire en priorité ; Tripo optionnel. |
| Mur / décor | 6 × 2,5 × 0,2 ; pierre/enduit ocre | Single warm limestone and ochre plaster wall module, uneven hand-built medieval Corsican masonry, no objects. | Fond immobile | Modules locaux, atlas partagé. |
| Toiture / décor | 6,5 × 1,8 ; terre cuite | Small modular row of warm terracotta curved roof tiles, worn Mediterranean clay, no house. | Haut du cadre | Répétition locale d'un module. |
| Table et étagère / décor | Table 4 × 0,85 × 0,9 ; bois | Rustic medieval merchant wooden counter, plain thick planks, sturdy legs, no merchandise. | Premier plan et droite, fixes | Géométrie locale ; étagère dérivée. |
| Tissu / décor | Bande env. 2 × 0,5 ; lin écru | Loosely draped natural ivory linen canopy strip, soft folds, no poles or background. | Sous toiture ; vent doux | Maillage local subdivisé pour déformation, préférable à un bloc rigide généré. |
| Crochet / décor | 0,08 ; fer noirci | Simple forged iron wall hook with a small mounting plate, medieval hand-forged finish. | Derrière chaque équipement | Géométrie partagée locale. |
| Feuillage / décor | Branche 0,8 ; olivier | Small olive branch with muted green narrow leaves and a few olives, no pot or ground. | Coins du cadre ; vent doux | Instances locales ou extraction d'assets après contrôle visuel. |
| Pierre / outils T1 | ~0,7 ; pierre taillée, manche bois | One primitive stone blade hand tool with a wooden handle and leather bindings, hung vertically, no display stand. | Centre haut ; inclinaison légère au survol | Modèle autonome à créer ; conserver les stats du T1. GLB si Tripo. |
| Bronze / outils T2 | ~0,7 ; bronze, bois/cuir | One simple bronze sword with a wrapped leather grip, broad readable blade, no stand or crossed second object. | Centre haut ; reflet discret | Géométrie existante adaptée ou GLB individuel. |
| Fer / outils T3 | ~0,7 ; fer, bois/cuir | One simple medieval iron sword with a wrapped leather grip, understated cross guard, no stand. | Centre haut ; reflet discret | Géométrie existante adaptée ou GLB individuel. |
| Cuir / armure T1 | 0,55 × 0,65 ; cuir brun | Sleeveless rustic brown leather cuirass, empty wearable torso armor, no human, no mannequin. | Centre bas ; balancement léger | Modèle autonome à créer, GLB si Tripo. |
| Maille / armure T2 | 0,6 × 0,65 ; fer mat | Short sleeved medieval chainmail shirt, empty armor, readable interlocking rings in texture, no human or mannequin. | Centre bas ; balancement léger | Maillage simple + normal map, éviter une géométrie par anneau. |
| Fer / armure T3 | 0,55 × 0,65 ; acier | Simple medieval iron breastplate with small shoulder guards, empty wearable armor, no human or mannequin. | Centre bas ; reflet discret | Modèle autonome à créer, GLB si Tripo. |
| Filet / équipement | ~1,3 × 1,4 ; corde chanvre | Hanging rustic fishing net gathered at two upper corners, thick tan hemp cord, open diamond cells, no wall. | Droite ; léger mouvement | Filet procédural existant trop simple pour la boutique ; nouveau maillage de cordages ou GLB. |
| Piège chasse / catalogue | ~0,45 × 0,35 × 0,3 ; bois | Small wooden cage hunting trap with a slatted frame and simple door, no animal, medieval materials. | Étagère droite ; inactif | Géométrie locale ou GLB, aucune mécanique. |
| Piège défensif / catalogue | Diamètre 0,35 ; fer noirci | Small open forged iron jaw trap with a circular base, worn medieval iron, no blood or prey. | Étagère droite ; inactif | Géométrie locale ou GLB, aucune mécanique. |
| Panier / ressources | Diamètre 0,48, hauteur 0,25 ; osier | Low round handwoven wicker market basket, wide open top, empty interior, no handle. | Six instances devant | Un modèle partagé, six contenus indépendants. |
| Blé / contenu panier | ~0,3 ; grains et paille dorés | Small tied bundle of ripe golden wheat ears with loose wheat grains, no basket. | Premier panier ; faible mouvement des épis | Instances locales ; ne pas réutiliser le champ entier. |
| Châtaignes / contenu panier | ~0,3 ; coques brunes | Small pile of glossy brown chestnuts with one open green burr, no basket. | Deuxième panier ; fixe | Instances locales ou GLB. |
| Raisin / contenu panier | ~0,3 ; violet, feuilles vertes | Small cluster of purple grapes with a green vine leaf, no basket. | Troisième panier ; fixe | Instances locales ou GLB. |
| Viande / contenu panier | ~0,3 ; rouge rosé, tissu | A few neat fresh meat cuts resting on a folded cream linen cloth, no basket, no gore. | Quatrième panier ; fixe | Modèle autonome à créer. |
| Poisson / contenu panier | ~0,3 ; argent | One fresh silver Mediterranean fish lying on its side, intact, no basket, no water. | Cinquième panier ; fixe | Une géométrie répétée. |
| Lait / contenu panier | ~0,25 ; verre/crème, bouchon bois | Small rustic clear glass milk bottle with cream white contents and a wooden stopper, no label or basket. | Sixième panier ; fixe | Géométrie locale répétée ; limiter les transparences en XR. |

Âne, chien, sanglier : commencer avec leurs modèles procéduraux existants. Leur amélioration Tripo est une option ultérieure à comparer au rendu, pas une régénération automatique. Barque, chèvre, cochon, vache : aucun prompt de régénération nécessaire.

### Pancarte Tripo — constat initial et plan préparatoire (historique)

- Le connecteur Tripo expose génération, consultation/attente des tâches, historique et solde. Consultation du solde réussie : **960 crédits**, **0 gelé** au moment de l'analyse. Cela vérifie l'accès au compte, pas une génération ni une identité de titulaire.
- La commande `tripo` est introuvable dans le terminal de cette session. Aucun paquet installé. Le connecteur MCP est néanmoins accessible ; son outil de génération n'expose pas le budget de faces ni le mode dry-run.
- La compétence `tripo-3d` demande CLI ≥ 0.7.0 et prévalidation du plan. Si l'on suit ce parcours CLI pour contrôler précisément le budget, prévoir installation `tripo-cli@0.7.2`, après accord, puis `doctor` et dry-run. Ne jamais lire ou copier une clé API.
- Candidat : **P1**, alias `tripo-p1`, valeur API `P1-20260311` ; une seule opération `text-to-model`, géométrie + textures PBR standard, objectif 1 500 faces, aucun rig, aucune conversion FBX/USDZ. GLB natif suffisant.
- Coût indicatif selon la compétence : **40 crédits** pour cette unique génération texturée ; total **40 crédits**. Aucune dépense faite. Le plan exact devra être vérifié par dry-run avant soumission ; les étapes échouées sont remboursées. Aucun reroll automatique.
- Livrables prévus : source GLB, aperçu PNG et métadonnées de tâche dans `assets/shop/tripo-out/…`, puis modèle vérifié/optimisé dans `assets/models/shop/vindutu-sign.glb`. Ce chemin n'existe pas encore.
- Inscription **VINDUTU** produite localement avec une texture dédiée appliquée au modèle, afin de garantir l'orthographe et la lisibilité ; aucune dépendance à un texte inventé par le générateur. Vérifier devant/dos, UV, silhouette et échelle avant intégration. Ne pas soumettre la capture entière de la boutique pour fabriquer une simple pancarte.

## Interface principale : préserver les commandes avant retrait

Le panneau décrit correspond à `#village-selector` et `#village-inspector` dans `index.html`. `#map-village-popups` est le bandeau supérieur distinct : le conserver sauf demande explicite.

Les clics carte 2D/3D sélectionnent déjà villages, slots et bâtiments ; les constructions/améliorations sont également disponibles dans `#building-panel`. **Cependant, la fiche de carte renvoie encore vers `#slot-options` pour les détails**. L'abattage des élevages et le retrait/remboursement pendant la préparation n'y ont pas encore de remplacement complet.

Ordre proposé au lot 7 :

1. Donner à la fiche de parcelle sur la carte les commandes manquantes de retrait, remboursement et abattage, via les contrôleurs existants ; conserver une navigation clavier compacte et un accès en cas de modèle non chargé.
2. Conserver le tableau Bâtiments, les tâches/habitants et la sélection sur carte, ainsi que les accès XR équivalents.
3. Retirer alors le panneau visible demandé, adapter les bordures redimensionnables et les parcours du tutoriel qui ciblent ses boutons.
4. Sous « Légende », créer une zone de compagnons : ordres individuels du chien (attaque, défense, garde d'enclos, perturbation), attaque/abattage du sanglier, états occupés/PV. Les actions doivent rester celles de `Animals.orderQuote/deploy/slaughter`.
5. Si l'on y montre la flotte ou les filets, les présenter comme réserves automatiques avec quantité/places, sans bouton de placement inventé. Les armures/outils restent des améliorations acquises et les ânes associés à leurs habitants.

## Organisation proposée

| Fichier | Travail prévu après validation |
| --- | --- |
| `js/shop-scene.js` (nouveau) | Scène d'étal indépendante, caméra PC fixe, éclairage, objets, animation, nettoyage des ressources ; réutilisable dans le renderer XR. |
| `js/shop-catalog.js` (nouveau) | Correspondance article ↔ objet ↔ devis ↔ commande, sans prix dupliqués. États disponible/verrouillé/vendu/en attente. |
| `js/shop-assets.js` (nouveau) | Chargement et partage des modèles/matériaux, extraction des animaux, fallback géométrique. |
| `js/illustrated-shop.js`, `js/shop-art.js`, `css/illustrated-shop.css` | Remplacer progressivement la couche SVG par la scène, conserver navigation, focus clavier, stocks et solde utiles. Supprimer l'ancien hit-test seulement quand le raycast est validé. |
| `js/config.js` | Paramètres visuels centralisés, manifeste des assets, séquences des tiers, son d'achat ; conserver valeurs économiques existantes. |
| `js/equipment.js` et rendus de personnages | Prérequis du tier précédent, libellé/apparence Pierre, conservation des bonus et application aux nouveaux habitants. |
| `js/game.js`, `js/network.js`, éventuellement `server.js` | Retour de transaction identifié pour son/visuel fiables, rejet explicite, déduplication des identifiants réseau ; simulation autoritaire inchangée. Un nouveau clic volontaire sur un animal reste un nouvel achat. |
| `js/economy.js`, `js/livestock.js`, `js/animals.js`, `js/transport.js` | Réutiliser devis et mutations ; adapter uniquement si nécessaire au retour de transaction, sans réécrire leurs règles. |
| `index.html`, `js/ui.js`, `js/map-interaction.js`, CSS de disposition | Remplacer panneau demandé après déplacement des fonctions ; zone de compagnons et navigation accessible. |
| `js/board3d.js` | Extraire les fabriques utiles ; exposer l'intégration scène/renderer sans arrêter la simulation ni recréer le plateau. |
| `js/xr.js`, `js/xr-interactions.js`, `js/xr-ui.js` | Même scène et catalogue, rayon contrôleur et activation unique ; gestion des distances/occlusions et retour au plateau. |
| `js/audio.js`, `assets/audio/interface/` | Import du MP3 et lecture confirmée, respect mute/volume et plafond des voix. |
| `js/tutorial.js`, `js/game-layout.js` | Réviser les parcours guidés et les poignées liées au panneau déplacé ; `game-layout.js` référence directement `#village-inspector`. |
| `tests/shop-*.test.js`, tests équipements, carte, layout, audio et XR | Réutiliser et étendre les scénarios existants aux nouvelles contraintes. |
| `GAME_DESIGN.md`, `BOUTIQUE_3D.md` | Mettre à jour sections 55/56/79/94 et suivi après chaque lot validé. |

### Choix de rendu et de synchronisation

- Caméra PC fixe légèrement perspective, composition inspirée de l'image. Dans le casque, scène ancrée dans l'espace et libre mouvement naturel de la tête, sans imposer une caméra fixe à l'utilisateur.
- Chaque article a un groupe indépendant et un raycast sur ses maillages. Le décor peut occlure les articles, mais ne devient jamais achetable. Ombres et contour testés sur les silhouettes réellement visibles.
- Reflets espacés au repos, contour chaud au survol, interpolation progressive du mouvement. Objets verrouillés assombris sans scintillement ; aucun panneau descriptif flottant.
- Faire apparaître VINDUTU et jouer le son sur le résultat autoritaire, pas sur le clic ni sur une simple variation d'or qui pourrait provenir d'une autre action. Un identifiant de transaction permet de rejeter les doublons réseau et les réponses périmées après changement de village.
- Une session XR utilise le renderer XR déjà présent ; aucun second système économique ni seconde simulation. L'ouverture de boutique change la présentation, pas l'horloge.
- Partager géométries et textures ; charger les modèles petit format utiles, pas les 56 GLB. Qualité PC/XR configurable, ombre principale limitée, particules plafonnées, pas de bloom plein écran obligatoire. Mesurer les draw calls et le temps de trame ; ne pas annoncer une fréquence Quest avant test matériel.
- Garder une voie de contrôle au clavier et une solution de repli si WebGL/un asset échoue. Ne pas bloquer le jeu sur un téléchargement d'asset.

## Lots et critères de sortie

| Lot | Statut | Résultat attendu |
| --- | --- | --- |
| 1 — Analyse | **Réalisé** | Présent document, inventaire, règles/écarts, références, vérifications initiales. |
| 2 — Scène | Implémenté PC | Étal 3D, caméra, cadrage, décor et emplacements indépendants ; comparer une capture à la référence, tête de l'âne visible. |
| 3 — Assets | Implémenté, finition artistique possible | Réutiliser barque/animaux, produire la pancarte Tripo suivant plan accepté ; intégrer les modèles indépendants manquants, mesurer poids/triangles. |
| 4 — Interactions | Implémenté PC | Raycast PC, contour de silhouette, mouvement doux, état verrouillé, clavier ; zéro infobulle. |
| 5 — Économie | Implémenté | Devis/actions communs, ventes exactes, état autoritaire, feedback et transactions identifiées. |
| 6 — Progression | Implémenté et testé | Pierre → bronze → fer, cuir → maille → fer ; actuels/futurs, pas de cumul, VINDUTU par village. |
| 7 — Interface | À faire | Déplacement des fonctions de parcelles avant retrait du panneau ; compagnons sous Légende ; accès Voilier et Âne conservés. |
| 8 — Ambiance | Implémenté PC | Son MP3 confirmé, respiration/vent/poussière sobres, réglages son et mouvements réduits. |
| 9 — PC et VR | PC implémenté ; nouvel étal XR à faire | Même scène/catalogue, pointage et gâchette, lisibilité, optimisation ; validation physique Quest distincte des tests simulés. |
| 10 — Régression | Moteur et boutique PC validés ; futurs lots à revalider | Transactions, village détruit pendant achat, double événement, changement de village, multijoueur, économie en arrière-plan, interfaces. |

Les lots peuvent partager de petites fondations, mais chaque livraison reste testable. La génération de tous les assets du tableau n'est ni nécessaire ni autorisée comme dépense automatique par ce plan.

## Vérifications exécutées au lot 1

Commande : `npm run test:shop` sur le code existant, avant toute modification de gameplay.

- `shop-sales.test.js` : réussi — six ressources, lots, bonus, stocks, refus.
- `shop-stock.test.js` : réussi — références uniques, historique/snapshot, barque, filets, indépendance des villages, pièges inactifs.
- `shop-network-commands.test.js` : réussi — commandes de l'invité, protection de l'autre joueur, prérequis, prix et ventes validés par l'hôte. Ce test injecte les commandes dans le moteur ; ce n'est pas une session réelle à deux navigateurs.
- `illustrated-shop-browser.test.js` : **échec** à la ligne 28, l'indicateur temporaire `.shop-wallet .gold-loss` n'était plus présent lors de l'assertion. Les assertions précédentes ont confirmé l'achat du cuir et le débit de 150 or. Cause non établie : vérifier le timing de l'effet de 1,2 s et la latence du navigateur avant de conclure à un défaut de transaction. Le reste du scénario navigateur n'a donc pas été validé dans cette exécution.
- Lecture GLB effectuée pour les 56 modèles et inventaire détaillé des sources utiles ci-dessus. Pas de certification visuelle de chaque modèle.
- Vidéo et audio accessibles, métadonnées lisibles. Connecteur Tripo joignable. Aucun test de génération ni test physique Quest effectué.

## Vérifications de la construction

- `npm test` : réussi après mise à jour du libellé Pierre dans l’attendu du catalogue.
- Tests équipements : progression, paiement unique, remplacements, blessures, exclusions,
  habitants futurs, isolation des villages et snapshots réussis.
- `tests/shop-transactions.test.js` : réussi ; deux contextes moteur distincts hôte/invité,
  refus, son confirmé, commandes dupliquées, journal limité et déduplication persistante.
- `tests/network-server.test.js` : réussi ; le relais WebSocket conserve le commandId.
- `tests/audio-browser.test.js` : réussi ; sons existants, retours sans doublon et sourdine.
  Le nouveau son boutique est contrôlé séparément par la suite 3D et les reçus moteur.
- `tests/illustrated-shop-browser.test.js` : réussi avec la vue de repli explicitement
  choisie. L’ancien contrôle fragile de l’animation d’or utilise maintenant un observateur
  installé avant le clic, pour ne pas rater un effet de 1,2 s entre deux échanges CDP.
- `tests/shop3d-browser.test.js` : réussi après stabilisation du pointage pendant le
  survol et correction des coordonnées du test (pixels entiers, comme les événements
  click du navigateur). Modèles sans erreur, raycast, VINDUTU, son confirmé, progression,
  stocks locaux, trois filets, pièges inactifs, ventes, refus, destruction, chronomètre,
  réouverture, trois dimensions de fenêtre et repli WebGL validés.
- Captures : `eredita3D/previews/shop/boutique-3d.png` et
  `eredita3D/previews/shop/boutique-3d-vindutu.png`, ainsi que les formats 844×390 et 390×844.
  La tête de l’âne et les deux noms de pièges restent visibles.
- La vérification hôte/invité utilise deux contextes moteur et un test du relais
  WebSocket ; aucune partie réelle à deux joueurs ni session matérielle Quest annoncée.

## Suite prévue

1. Lot 7 : rendre toutes les commandes de parcelles accessibles depuis la carte, puis
   retirer le panneau décrit et installer les compagnons sous Légende.
2. Lot 9 : exposer le même étal dans la scène WebXR existante, avec pointage/gâchette,
   navigation et lisibilité adaptées. Conserver les commandes économiques communes.
3. Fin du lot 10 : régression de ces nouveaux accès et vérification physique Quest 3.

L’accord de construction est déjà reçu ; aucune nouvelle validation du lot 1 n’est requise.


## Passe visuelle — 17 novembre 2026

Demande actuelle : améliorer fortement les textures et le décor de la boutique,
retirer le voilier, utiliser Tripo lorsque pertinent.

### Réalisé

- Nouveau module `js/shop-materials.js` : 7 familles PBR avec normales/rugosité,
  textures partagées 512/1024 px, filtrage anisotrope. Cuir/lin/osier réutilisés du
  projet ; bois/pierre/métal/terre cuite générés localement, sans dépendance ajoutée.
- Maçonnerie irrégulière, présentoir central en châtaignier, bois orienté selon
  les pièces, arêtes adoucies, tuiles canal, lanternes et rambardes cloutées.
- Lin plissé et bordures, feuillage affiné, éclairage chaud, réflexion locale
  pour les métaux ; géométrie de décor fusionnée par matériau.
- Cuir grainé, armures cintrées, mailles affinées, collier cousu, paniers tressés,
  blé plus fin, peau des fruits, écailles, veinures de viande et cruches de lait.
- Nouveaux âne/sanglier Tripo indépendants, PBR 1024, 4 698/4 938 triangles.
- Interface brun encre/lin/laiton, onglets sobres, ventes lisibles, contour clavier.
- Voilier retiré du sélecteur, de la scène et du catalogue commun (Gestion/XR compris).
  La barque reste disponible ; les anciens états et leur transport sont lisibles.
- `GAME_DESIGN.md` synchronisé sur ce retrait du catalogue et la présentation.

### Tripo — dépenses réelles

1. `text_to_model` âne — `672760ed-f236-410c-9d7e-eeb4346ebe48` : **40 crédits**.
2. `text_to_model` sanglier — `b8ef5922-5dc4-4265-b133-a6a1a30c568b` : **40 crédits**.

**Total : 80 crédits ; solde après ces tâches : 840 crédits.**
P1 (`P1-20260311`), une génération par animal, aucun nouvel essai ni conversion
payante. Textures optimisées localement avec Blender. Détails dans
`assets/models/shop/README.md`.

### Vérifications et limites

- `npm test` réussi, après adaptation de l’attendu du catalogue sans Voilier.
- Test navigateur illustré réussi : achats souris/clavier, ventes, refus,
  stocks locaux, Gestion sans Voilier et trois formats.
- Tests 3D exécutés sur le navigateur local : import des modèles et textures,
  pointage, achats, VINDUTU, villages, filets, ventes, temps réel et repli WebGL.
- Pas de nouvelle validation physique Quest 3 ; le nouvel étal 3D reste la vue PC.
- Les fonctionnalités des lots 7/9 listées plus haut ne font pas partie de cette
  passe esthétique. Les prix, bonus et conditions d’achat ne changent pas.


## Refonte de tous les modèles et survol vidéo — 17 novembre 2026

### Demande du concepteur

Refaire tous les modèles de la boutique sauf l’âne et la barque ; reproduire
le survol de `IMG_9788.MOV`. Précision ultérieure : le sanglier doit être
uniquement sa tête sur le mur. Budget Tripo de 800 crédits accepté explicitement.
La vidéo est une référence visuelle, pas une source de règles de gameplay.

### Réalisé

- 20 nouveaux modèles PBR indépendants : chien, tête murale de sanglier, vache,
  chèvre, cochon, trois paires d’armes/outils, trois armures, filet, deux pièges
  et six paniers de ressources. Sources/GLB optimisés/reçus conservés.
- L’âne et la barque sont identiques à leurs fichiers précédents (SHA-256 contrôlés).
- Le modèle de secours du sanglier représente lui aussi une tête seule pendant
  le chargement ou si le fichier GLB est indisponible.
- Décor et pancartes reconstruits dans `js/shop-decor.js` : charpente chevillée,
  moellons, trois présentoirs en retrait, couverture, toiles, comptoir, enclos,
  étagères, lanternes et feuilles d’olivier. Pancarte VINDUTU locale, texte exact.
- Survol dans `js/shop-hover.js` : agrandissement, déplacement en profondeur,
  inclinaison X/Y selon le curseur, interpolation à l’entrée/sortie, contour
  ivoire et doré à épaisseur constante en pixels. Aucun déplacement du décor.
- Le pointeur est actualisé au sein du même objet. Le raycast neutralise
  temporairement les transformations de survol pour éviter les cibles fuyantes.
- Le survol concerne chaque article visible, y compris articles verrouillés
  et pièges inactifs ; ils ne deviennent pas achetables. Les paniers réagissent
  également depuis leurs boutons de vente et au clavier. Les objets vendus
  ne peuvent plus être survolés. Le mode mouvements réduits conserve le contour.
- Filet : retrait local du fond gris généré et reconstruction de vraies cordes
  croisées avec des nœuds en volume, pour des mailles ouvertes. 7 762 triangles
  après cette retouche, sans relance Tripo ni autre coût.

### Coût

**800 crédits réels : 20 générations × 40 crédits. Solde restant vérifié : 40.**
Chaque tâche et son montant figurent dans `assets/models/shop/v2/README.md` et
`BOUTIQUE_MODELES_PLAN.md`. Aucun crédit pour la reconstruction locale, le
survol, l’optimisation des textures ou les tests.

### Vérifications — 18 novembre 2026

- `npm test` : réussi, simulation et transactions communes.
- `npm run test:shop` : réussi, ventes, stocks, réseau, interface illustrée et 3D.
- `npm run test:shop3d` : réussi après les dernières retouches ; import des 22
  modèles, achat à la souris, VINDUTU, villages indépendants, filets, ventes,
  refus, simulation continue, affichage mobile, réouverture et repli WebGL.
- `npm run test:shop-hover` : réussi ; les 22 silhouettes, agrandissement,
  profondeur, suivi du curseur, retour au repos, paniers, refus d’achat verrouillé,
  décor fixe et mouvements réduits sont contrôlés. Une exécution a expiré sur
  une commande CDP ; la relance complète a réussi.
- Contrôle visuel des captures `eredita3D/previews/shop/boutique-3d.png`,
  `boutique-hover-cuir.png`, `boutique-3d-vindutu.png` et des formats mobiles.
  Empreintes de l’âne et de la barque vérifiées ; `git diff --check` réussi.
- Les limites XR matérielles décrites plus haut restent applicables : aucune
  validation physique Quest 3 n’a été faite dans cette passe.
