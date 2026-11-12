# EREDITÀ — GAME DESIGN DOCUMENT

> Document de référence principal du projet.
>
> Ce fichier décrit les règles actuellement connues du jeu. Toute IA ou tout développeur travaillant sur le projet doit le lire avant de modifier le code.
>
> Certaines valeurs sont encore provisoires et seront équilibrées après les premiers tests. Lorsqu'une information est indiquée comme `TBD`, elle ne doit pas être inventée arbitrairement comme une règle définitive.

---

# 1. PRÉSENTATION DU PROJET

## 1.1 Concept général

Eredità est le nom de travail d'un jeu vidéo de stratégie en temps réel avec renforts mythologiques inspiré de la Corse, de son territoire, de son patrimoine, de son matrimoine, de ses pratiques, de ses croyances, de ses légendes et de ses traditions.

Le jeu est développé dans le cadre d'un projet universitaire en BUT MMI.

Il s'agit d'un jeu :

* 1 contre 1 ;
* en temps réel ;
* avec des renforts mythologiques ;
* avec gestion de ressources ;
* avec développement de villages ;
* avec agriculture et élevage ;
* avec différentes régions/biomes ;
* avec combat automatique ;
* avec des éléments issus de la culture corse ;
* avec des pouvoirs mythologiques extrêmement puissants.

Le prototype doit d'abord être développé sous forme de jeu web 2D.

Technologies prévues pour le prototype :

* HTML ;
* CSS ;
* JavaScript.

Pas de PHP ni de base de données nécessaires pour la première version.

Un premier mode réalité mixte WebXR pour Meta Quest 3 complète désormais ce prototype web (voir section 94), sans remplacer le desktop ni sa simulation.

---

# 2. OBJECTIF CULTUREL DU PROJET

Le projet ne doit pas simplement être un jeu de stratégie sur lequel on ajoute quelques noms corses.

La culture corse doit influencer directement les mécaniques.

Les éléments culturels peuvent venir :

* des légendes ;
* des croyances ;
* des traditions ;
* de l'agriculture ;
* de l'élevage ;
* des paysages ;
* des pratiques anciennes ;
* des métiers ;
* de la transmission ;
* de l'oralité ;
* du patrimoine ;
* du matrimoine.

L'oralité ne signifie pas obligatoirement que le jeu doit utiliser des voix enregistrées.

L'idée importante est également la transmission d'une mémoire, de croyances, d'histoires et de pratiques.

Une mécanique culturelle doit idéalement avoir une justification.

Exemple :

Le sanglier peut avoir une interaction particulière avec le littoral et peut traverser la mer. Cette mécanique est associée à une histoire/tradition selon laquelle des sangliers seraient arrivés en Corse depuis la Sardaigne en traversant la mer.

Cette information devra être correctement sourcée avant d'être utilisée comme justification académique définitive.

Les légendes et éléments culturels utilisés dans le jeu devront être documentés avec :

* leur nom ;
* leur source ;
* leur origine géographique si elle est connue ;
* un résumé de la tradition/légende ;
* ce qui a été conservé ;
* ce qui a été adapté pour le gameplay ;
* pourquoi cette adaptation a été faite.

---

# 3. STRUCTURE GÉNÉRALE D'UNE PARTIE

Le jeu oppose :

* Joueur Rouge ;
* Joueur Bleu.

Le prototype propose un mode local à deux joueurs sur un même écran, un mode solo contre une IA et un mode réseau à deux ordinateurs. En solo, le joueur humain joue Rouge et l'IA joue Bleu ; elle confirme son tirage initial et utilise les mêmes actions et règles que le joueur humain. Le joueur peut consulter les villages bleus sans les commander. En réseau, le créateur du salon joue Rouge et héberge l'état autoritaire de la simulation ; le joueur qui rejoint avec le code du salon joue Bleu. Chaque joueur ne peut modifier que ses propres territoires. Le serveur relaie les commandes du joueur Bleu et les états du créateur afin de conserver une simulation commune. Les propositions de renforts constituent une exception privée : le relais conserve leurs tirages et sélections et ne transmet à chaque connexion que les siens, en suivant l’horloge de combat publiée par l’hôte.

TEMP_BALANCE_VALUE : la stratégie de l'IA est provisoire. Elle plante une culture compatible, construit un Artisanat, affecte un habitant à l'agriculture, forme des Guerriers, attaque et défend les lignes menacées avec ses habitants disponibles. Sa cadence de décision, ses réserves et ses limites d'unités sont centralisées dans `config.js`. Elle ne dispose d'aucune ressource ou statistique supplémentaire.

Dans le format **Classique**, chaque joueur possède :

* 4 régions ;
* 4 villages ;
* 1 village par région.

Il y a donc :

* 8 régions sur la carte ;
* 8 villages au début de la partie.

Les territoires rouges sont d'un côté.

Les territoires bleus sont de l'autre.

Chaque région correspond directement à une région adverse.

On peut considérer les colonnes comme :

R1 ↔ B1
R2 ↔ B2
R3 ↔ B3
R4 ↔ B4

Chaque colonne constitue donc un axe d'affrontement.

## 3.1 Format simplifié — deux régions par joueur

Le format **Simplifié** est proposé sur écran et dans le casque pour l’entraînement et le local ; l’hôte le choisit aussi avant de créer un salon réseau. Le choix présente deux boutons « 2 camps » (Simplifié) et « 4 camps » (Classique), dans cet ordre, avec « 2 camps » sélectionné par défaut. Le nombre indiqué correspond aux camps de chaque joueur. Il possède **deux régions et deux villages par joueur**, donc quatre régions au total et deux lignes d’affrontement. Le format Classique et le tutoriel conservent quatre régions par joueur.

Au tirage initial, chaque joueur reçoit deux biomes différents. L’ensemble des quatre régions contient obligatoirement au moins une Plaine, une Montagne et un Littoral. La répartition et l’ordre des régions sont aléatoires. Chaque joueur peut ensuite conserver son tirage ou échanger **une seule région**, une seule fois avant confirmation. Choisir une autre région déplace la sélection en un clic. Le nouveau biome est aléatoire parmi les autres types, même si le joueur possède déjà ce biome : les contraintes initiales ne sont pas réappliquées après échange.

Le format reste dans l’état autoritaire et les snapshots réseau ; un redémarrage conserve le format choisi. Les coûts, ressources, métiers, tâches, statistiques, minute de préparation, 12:30 de combat, Overtime et règles de génération par nombre de villages vivants restent identiques. La carte 2D/3D, les fiches et la navigation ne montrent que les villages existants. Les unités progressent sur deux lignes et sont redirigées vers l’autre village vivant suivant les règles existantes.

TEMP_BALANCE_VALUE — présentation : en 3D et en réalité mixte, les terrains du format à deux camps sont élargis de 15 % pour équilibrer les proportions du plateau. Le socle, les bordures, le littoral et les positions des éléments suivent cette largeur, sans étirer les modèles. Cette valeur visuelle est centralisée dans `Config.board.simplifiedWidthScale` et ne change pas les distances logiques ou les règles de jeu.

---

# 4. CONDITION DE VICTOIRE

L’objectif principal est de détruire tous les villages adverses : quatre en Classique, deux en Simplifié.

Un joueur qui perd tous ses villages perd la partie.

Une situation où les deux joueurs perdent leur dernier village simultanément peut provoquer une égalité.

---

# 5. DURÉE NORMALE D'UNE PARTIE

## 5.1 Préparation des villages — 1 minute

Après la confirmation des biomes des deux camps et le lancement de la partie, une préparation commune de **60 secondes** permet de sélectionner les villages, construire, acheter, attribuer les tâches et les métiers et définir les préférences des futurs habitants. Les coûts, prérequis et restrictions de contrôle restent identiques.

La musique de combat commence **dès le lancement de cette préparation**, sur ordinateur et dans le casque. L’invité réseau adopte cette musique dès la réception de l’état de préparation de l’hôte. Le passage au combat ne relance pas le morceau.

Les ordres d’attaque et de défense peuvent être donnés pendant cette minute ; les troupes attendent la fin du compte à rebours avant tout déplacement ou combat. Les attributions groupées continuent à leur cadence habituelle de 0,5 seconde. L’IA prépare également ses villages.

Le compte à rebours est visible sur écran et en réalité mixte. À zéro, le combat commence automatiquement. En réseau, seul l’hôte fait avancer ce compte à rebours et l’invité reçoit ses snapshots ; la pause de l’hôte suspend également la préparation. Un nouveau lancement n’est pas possible pendant une partie déjà commencée.

TEMP_BALANCE_VALUE : par défaut, la production attend la fin de la préparation ; ce choix reste à valider et se règle avec `Config.preparation.productionDuringPreparation`. La génération naturelle des habitants commence avec le temps de combat. Le tutoriel scénarisé conserve son organisation guidée et sa durée libre.

## 5.2 Temps de combat

La minute de préparation s’ajoute au temps de combat. Les 12:30 et le seuil d’Overtime sont comptés **à partir de la fin de la préparation**.

La phase normale dure :

**12 minutes 30 secondes.**

Soit :

**750 secondes.**

Après 12:30, si aucun joueur n'a gagné, la partie passe en :

# OVERTIME

L'Overtime sert à empêcher une partie de durer indéfiniment.

Pendant l'Overtime, les bâtiments/villages perdent progressivement des points de vie selon un pourcentage.

La valeur exacte n'est pas encore définie.

Variables à prévoir :

```text
OVERTIME_START = 750 secondes
OVERTIME_DAMAGE_PERCENT = TBD
OVERTIME_DAMAGE_INTERVAL = TBD
```

Le système doit être configurable facilement.

L'Overtime continue jusqu'à ce qu'une victoire ou une égalité soit obtenue.

---

# 6. LES BIOMES

Il existe actuellement 3 grands biomes :

* Montagne ;
* Plaine ;
* Littoral.

Chaque région possède un biome.

---

# 7. GÉNÉRATION DES BIOMES EN DÉBUT DE PARTIE

En format Classique, chaque joueur reçoit 4 biomes. Le tirage du format Simplifié est décrit en section 3.1.

Le premier tirage doit obligatoirement contenir au minimum :

* 1 Montagne ;
* 1 Plaine ;
* 1 Littoral.

Le quatrième biome est aléatoire parmi les biomes disponibles.

Exemple :

* Montagne ;
* Plaine ;
* Littoral ;
* Montagne.

Les positions sont ensuite mélangées.

Les biomes ne doivent donc PAS toujours être placés dans les mêmes colonnes.

---

# 8. ÉCHANGE DES BIOMES AVANT LA PARTIE

Avant le début réel du combat, le joueur peut regarder les 4 biomes qu'il a reçus.

Il peut décider d'en conserver la totalité.

Il peut également sélectionner jusqu'à :

**2 biomes maximum en Classique, 1 seul en Simplifié**

qu'il souhaite remplacer.

Chaque biome sélectionné est remplacé par un biome aléatoire.

Le biome obtenu ne doit pas être exactement le même que celui qui vient d'être retiré.

IMPORTANT :

La règle imposant au moins un biome de chaque type ne s'applique qu'au tirage initial.

Après les échanges, le joueur peut obtenir n'importe quelle combinaison.

Il est donc théoriquement possible d'obtenir :

* 4 Montagnes ;
* 4 Plaines ;
* 4 Littoraux ;
* ou toute autre combinaison.

---

# 9. ORIENTATION DU LITTORAL

Le littoral possède une règle visuelle importante.

La partie contenant l'eau doit TOUJOURS être orientée vers l'adversaire.

L'eau se trouve donc du côté du centre du plateau.

Elle ne doit jamais être placée derrière le village.

Schéma simplifié :

```text
VILLAGE ROUGE
MAQUIS
EAU
----------------
EAU
MAQUIS
VILLAGE BLEU
```

Cette orientation doit rester correcte quelle que soit la colonne dans laquelle apparaît le littoral.

Le rendu utilise deux illustrations littorales complémentaires conçues séparément : une pour le territoire Rouge et une pour le territoire Bleu. L'illustration bleue ne doit pas être une simple rotation à 180° de l'illustration rouge ; rochers, végétation et courbe du rivage ont une composition propre tout en gardant la même direction artistique.

Toute personne qui entre dans l'eau sans embarcation meurt immédiatement. Le Sanglier constitue l'unique exception : il nage sans consommer de place, à la moitié de sa vitesse terrestre. Le Chien doit utiliser une embarcation. Dans le prototype, l'embarquement est automatique : une unité utilise une place libre de la réserve de son village d'origine pendant toute sa présence dans l'eau, puis libère cette place dès son retour sur terre. **Les Barques peuvent être achetées et stockées dans tous les villages, quel que soit leur biome**, pour traverser aussi bien l'eau alliée que l'eau adverse. Chaque achat augmente la réserve locale ; l'embarquement occupe une place sans supprimer la Barque, qui reste réutilisable. Si toutes les places sont occupées, l'unité se noie. La réserve d'un autre village allié ou d'un village ennemi ne transporte pas l'assaillant. Les trajets économiques terrestres, notamment la chasse, restent bornés hors de l'eau. TEMP_BALANCE_VALUE : dans la colonne logique de 100 unités, les zones d'eau occupent actuellement 38–50 côté Rouge et 50–62 côté Bleu afin de correspondre au rendu du rivage.

---

# 10. SYSTÈME DE SLOTS DES BIOMES

Les régions contiennent des slots permettant de placer :

* cultures ;
* élevages ;
* animaux ;
* certains éléments de terrain ;
* autres éléments autorisés.

Tous les slots sont VIDES au début de la partie.

Le joueur décide lui-même comment il développe son territoire.

Il n'y a donc pas automatiquement un champ de blé, un vignoble ou un élevage sur une plaine.

---

# 11. SLOTS DE LA PLAINE

Une Plaine possède :

**4 slots.**

Les 4 slots sont libres.

Le joueur choisit les productions compatibles avec le type de slot.

Il peut donc potentiellement spécialiser entièrement une région.

Il peut utiliser plusieurs slots compatibles pour le même type d’élevage ou de production.

---

# 12. SLOTS DE LA MONTAGNE

Une Montagne possède :

**4 slots.**

Cependant :

* 2 slots sont libres ;
* 2 slots du fond sont réservés aux animaux.

Les deux slots réservés aux animaux ne peuvent pas recevoir n'importe quel type de culture ou de construction.

Ils servent spécifiquement à la présence/gestion d'animaux selon les règles futures du système.

---

# 13. SLOTS DU LITTORAL

Un Littoral possède :

**2 slots.**

Il ne doit PAS avoir 4 ou 5 slots.

Il ne doit PAS avoir un seul slot.

La référence actuelle est :

**2 slots pour le Littoral.**

---

# 14. APPARITION DES CHAMPS ET ÉLEVAGES

Les champs et élevages ne sont pas présents automatiquement.

Ils apparaissent à la suite d'une décision du joueur.

Ils peuvent notamment apparaître :

* grâce à une carte ;
* par placement direct dans un emplacement compatible, même sans Bergerie.

Le fonctionnement exact des différentes méthodes pourra être affiné pendant le développement. La Bergerie reste nécessaire pour acheter des animaux au magasin et pour ses bonus ou déblocages propres ; elle ne conditionne pas le placement direct d'un premier élevage.

## 14.1 Prix et niveaux des cultures

Blé, Châtaignier et Vignoble utilisent les mêmes prix en **or global du joueur** :

| Action | Coût de l’action | Or investi au total | Rendement du champ |
| --- | ---: | ---: | ---: |
| Planter au niveau 1 | 75 or | 75 or | ×1 |
| Améliorer au niveau 2 | 150 or supplémentaires | 225 or | ×2 |
| Améliorer au niveau 3 | 300 or supplémentaires | 525 or | ×3 |

Le niveau 3 est le maximum. Une culture compte comme une, deux ou trois cultures de base au même emplacement pour la récolte. Les améliorations sont disponibles pendant la préparation et pendant le combat, à condition de disposer de l’or nécessaire. Elles ne modifient pas les 200 PV de base et ne soignent pas la culture. Les prix et rendements sont centralisés dans `Config.cropLevels`.

Une culture peut toujours être remplacée directement par une autre culture compatible avec le biome. Cette nouvelle plantation coûte également **75 or**, repart au niveau 1 avec ses PV maximum et ne rembourse pas l’ancienne culture. Une culture ne peut pas être remplacée par elle-même, ni écraser un élevage ou un slot réservé aux animaux.

## 14.2 Correction des placements pendant la préparation

Pendant la minute de préparation des villages (`phase === "running"` et `preparationRemaining > 0`), le joueur peut libérer un slot depuis son bouton **Slot** :

* une culture propose **Vendre le terrain**, à gauche, avec remboursement intégral de l’or réellement investi dans cette culture : 75, 225 ou 525 or selon son niveau ;
* un élevage propose **Retirer l’élevage**, gratuitement et sans produire de viande ;
* la suppression conserve la nature de l’emplacement : libre ou réservé aux animaux.

La culture vendue disparaît et le slot redevient disponible. Un second clic ou une commande répétée ne peut pas rembourser une culture déjà retirée. Une culture issue d’un ancien état sans investissement enregistré ne crée pas d’or lors de son retrait.

Dès que le compteur de préparation atteint zéro, les commandes de retrait sont refusées par la simulation et par l’hôte réseau, même si un client utilise un ancien bouton. Les boutons de vente/retrait disparaissent. **Améliorer** se place alors à gauche dans le panneau de culture. Pour les élevages, l’abattage reste disponible avec une quantité choisie et un bouton **Tout abattre**, permettant de libérer le slot selon les règles de viande existantes.

La pause bloque ces actions comme les autres commandes de gestion. Le placement direct d’un premier élevage conserve son fonctionnement provisoire sans dépense ; son retrait n’est pas une vente d’animaux et ne crédite pas d’or.

---

# 15. SYSTÈME VISUEL PAR TEMPLATES

Pour faciliter le développement, la carte ne doit pas nécessiter une image différente pour toutes les combinaisons possibles.

Le jeu doit utiliser un système de templates/calques.

Exemples de bases :

```text
montagne
montagne + rivière
plaine
plaine + rivière
littoral
```

Puis des éléments peuvent être ajoutés visuellement sur les slots :

```text
champ de blé
châtaignier
vigne
chèvre
cochon
vache
etc.
```

Le jeu doit donc pouvoir superposer des éléments graphiques en fonction des décisions du joueur.

Concept :

```text
BIOME DE BASE
    +
ÉLÉMENTS DE TERRAIN
    +
SLOTS
    +
CULTURES / ÉLEVAGES
    +
BÂTIMENTS / UNITÉS
```

Cette méthode est volontairement choisie pour réduire la difficulté de développement.

---

# 16. VILLAGES

Chaque joueur possède un village par région.

Donc :

**4 villages par joueur en Classique, 2 en Simplifié.**

Chaque village possède :

* ses propres habitants ;
* ses propres ressources locales ;
* ses bâtiments ;
* ses emplacements de bâtiments ;
* ses points de vie ;
* son niveau.

---

# 17. NIVEAUX DES VILLAGES

Les villages possèdent 3 niveaux.

## Village T1

PV :

**200**

Population maximale :

**15 habitants**

## Village T2

PV :

**400**

Population maximale :

**25 habitants**

## Village T3

PV :

**600**

Population maximale :

**35 habitants**

---

# 18. BÂTIMENTS DU VILLAGE

Chaque village possède :

**3 emplacements de bâtiments.**

Les bâtiments actuellement prévus sont notamment :

* Bergerie ;
* Artisanat ;
* Boucherie.

Chaque bâtiment possède également :

* T1 ;
* T2 ;
* T3.

---

# 19. POINTS DE VIE DES BÂTIMENTS

Un bâtiment ajoute des PV au village.

## Bâtiment T1

+75 PV

## Bâtiment T2

+150 PV

## Bâtiment T3

+225 PV

Un village T3 avec trois bâtiments T3 peut donc atteindre :

```text
600 + 225 + 225 + 225
= 1275 PV
```

Maximum actuel :

**1275 PV.**

---

# 20. COÛT DES BÂTIMENTS

## Construction T1

Construire un bâtiment T1 coûte actuellement :

**200 or.**

Aucune ressource locale n'est nécessaire pour créer le T1.

## Amélioration T1 → T2

Coût :

**100 unités de la ressource correspondante + 200 or.**

## Amélioration T2 → T3

Coût :

**150 unités de la ressource correspondante + 300 or.**

La ressource exacte nécessaire dépendra du bâtiment.

Cette correspondance n'est PAS encore définie.

Dans le prototype, une règle temporaire autorisée permet de choisir une ressource locale pour payer l'amélioration (un seul type par achat). Les quantités de 100/150 et les coûts de 200/300 or restent applicables. La correspondance définitive par bâtiment reste à définir.

Exemple de structure à prévoir dans le code :

```js
buildingUpgradeCosts = {
    T1: {
        gold: 200
    },

    T2: {
        gold: 200,
        resourceAmount: 100,
        resourceType: null
    },

    T3: {
        gold: 300,
        resourceAmount: 150,
        resourceType: null
    }
}
```

---

# 21. ÉCONOMIE : PRINCIPE IMPORTANT

Les ressources ne sont PLUS partagées entre les villages.

Chaque village possède sa propre banque locale.

Exemple :

```text
JOUEUR
│
├── OR GLOBAL
│
├── VILLAGE 1
│   └── ressources locales
│
├── VILLAGE 2
│   └── ressources locales
│
├── VILLAGE 3
│   └── ressources locales
│
└── VILLAGE 4
    └── ressources locales
```

---

# 22. RESSOURCES LOCALES

Lorsqu'un habitant récolte ou rapporte une ressource, celle-ci est déposée dans :

**la banque du village auquel appartient l'habitant.**

Elle ne va pas dans une banque commune.

Les ressources actuellement prévues sont :

* viande ;
* raisin ;
* poisson ;
* blé ;
* lait ;
* châtaigne.

La pierre n'est PAS une ressource du système actuel.

Le bois n'est actuellement PAS confirmé comme ressource économique principale et ne doit pas être ajouté sans confirmation.

---

# 23. OR GLOBAL

L'or fonctionne différemment.

L'or appartient au joueur dans son ensemble.

Il peut donc être dépensé dans n'importe lequel de ses villages.

Exemple :

```text
Village 1 vend du poisson
        ↓
le joueur gagne de l'or
        ↓
cet or peut être dépensé au Village 4
```

L'or est donc :

**GLOBAL**

Chaque joueur commence une nouvelle partie avec **5 000 or**, partagés entre ses villages.

alors que les autres ressources sont :

**LOCALES**

---

# 24. VENTE DES RESSOURCES

Le joueur peut décider de vendre les ressources stockées dans les villages.

Valeurs de base actuelles :

| Ressource | Valeur |
| --------- | -----: |
| Blé       |   1 or |
| Châtaigne | 1,5 or |
| Raisin    | 1,5 or |
| Viande    |   2 or |
| Poisson   |   2 or |
| Lait      |   1 or |

Ces valeurs sont provisoires et pourront être équilibrées.

Les bonus de revente peuvent modifier ces valeurs.

Le bouton rouge « Sell » près de chaque stock vend au maximum 10 unités par clic (ou le reste du stock), contre de l'or global. Quantité et gain sont affichés avant la vente. TEMP_BALANCE_VALUE : seul le meilleur bonus applicable est retenu, sans cumul : Bergerie pour blé/lait, Boucherie pour viande/poisson, Artisanat pour toutes les ressources, +5 % par niveau.

---

# 25. POPULATION

Chaque village possède sa propre population.

Les habitants sont locaux.

Un habitant appartient donc à un village/région précis.

La population économique ne doit pas librement se téléporter d'une région vers une autre.

---

# 26. GÉNÉRATION NATURELLE DES HABITANTS

Lorsque les 4 villages d'un joueur sont encore vivants :

**+1 habitant par village toutes les 45 secondes.**

Si le joueur n'a plus que 3 villages :

**+1 habitant par village toutes les 35 secondes.**

S'il reste 2 villages :

**+1 habitant par village toutes les 25 secondes.**

S'il reste seulement 1 village :

**+1 habitant toutes les 15 secondes.**

Cette accélération sert de mécanique de comeback.

Elle donne davantage de possibilités au joueur qui a perdu plusieurs villages.

La génération doit respecter la population maximale du niveau du village.

---

# 27. ACHAT D'UN HABITANT

Une ancienne règle prévoit également la possibilité d'acheter directement un habitant.

Coût actuellement défini :

**50 unités d'une ressource autorisée + 50 or.**

Exemple :

```text
50 blé + 50 or
```

ou une autre ressource autorisée.

Cette règle doit rester configurable car l'économie générale est encore en phase d'équilibrage.

---

# 28. HABITANT DE BASE

Statistiques actuelles :

* 50 PV ;
* 5 dégâts ;
* vitesse de référence : traverse une colonne complète en 20 secondes.

L'Habitant peut :

* travailler ;
* récolter ;
* recevoir une tâche ;
* participer au combat selon son rôle.

Le joueur doit pouvoir assigner des tâches aux habitants.

## 28.1 MISSIONS DES HABITANTS

Au début et lors de leur génération naturelle, les Habitants sont présents dans leur village d'origine.

Chaque Habitant vivant peut recevoir ou changer individuellement une mission locale parmi :

* Agriculture, Élevage, Pêche, Chasse ;
* Attaque ou Défense, avec présence physique sur le terrain.

**Nouvelle règle : tâches et métiers sont fusionnés.** Choisir Agriculture attribue automatiquement Agriculteur, Élevage attribue Berger, Pêche attribue Pêcheur et Chasse attribue Chasseur, avec les bonus existants. Il n’y a plus de panneau ni de commande séparée de métier dans l’interface. Les légendes gardent leur identité, leurs pouvoirs et leur profession verrouillée.

Seules trois tâches exigent un bâtiment : **Élevage → Bergerie, Pêche → Boucherie, Chasse → Artisanat**, dès T1. Agriculture reste utilisable sans bâtiment, avec une culture vivante ; un troupeau et l’accès à l’eau restent nécessaires pour l’élevage et la pêche. Un ordre bloqué ne change ni la tâche, ni le métier, ni la cargaison. Attaquer et Défendre restent utilisables sans bâtiment.

Un petit menu **Mode de combat** permet de choisir **Guerrier, Ravageur ou Archer**. L’intitulé Archer correspond au rôle Chasseur à l’arc existant. Ce choix est appliqué au prochain ordre Attaquer/Défendre et peut aussi être transmis avec « Tous » ou « Prochains ». Il n’échange pas instantanément le métier d’un combattant déployé : un nouvel ordre peut le rappeler, avec son métier actuel jusqu’à l’arrivée, puis appliquer le nouveau rôle. Ses blessures sont conservées en proportion des PV maximum. Les statistiques et domaines des bonus restent ceux des classes existantes ; le Chasseur conserve sa portée d’arc de **15 unités**. Le Ravageur conserve son bonus de spécialité en attaque.

Les boutons de tâche affichent seulement leur intitulé et, pour les activités
économiques, **une étoile par niveau du bâtiment associé** : aucune sans bâtiment,
★ en T1, ★★ en T2, ★★★ en T3. Agriculture et Élevage sont liés à la Bergerie,
Chasse à l’Artisanat et Pêche à la Boucherie. Ces étoiles indiquent le niveau du
bâtiment, indépendamment du métier courant de l’habitant. Les boutons Agriculture
sont jaunes, Élevage blancs, Chasse verts, Pêche bleus et Rendre disponible marron ;
les commandes Tous/Prochains reprennent cette couleur. Les pictogrammes et petits
descriptifs, y compris la mention de riposte dans Attaquer, sont retirés des boutons.
Les prérequis restent consultables au survol.

Un changement de tâche attribue le métier adapté automatiquement, et « Rendre disponible » rend un habitant ordinaire sans métier après son retour. Les préférences de combat peuvent être conservées pour un prochain ordre. « Tous » continue à affecter seulement les habitants disponibles à 0,5 seconde d’intervalle ; « Prochains » mémorise ensemble tâche et métier pour les naissances et achats, en appliquant les mêmes prérequis. Les légendes ne reçoivent pas de profession ordinaire par ce mécanisme.

TEMP_BALANCE_VALUE : la chasse rapporte toujours 3 viandes sans spécialité et 5 pour un Chasseur ; la tâche fusionnée donne automatiquement la spécialité aux habitants ordinaires. Le Ravageur conserve ses +5 dégâts spécialisés contre les villages/bâtiments.

Les missions Agriculture, Élevage et Pêche restent liées au village et à la région d'origine de l'Habitant.

Un Habitant retiré d'une mission économique redevient disponible dans son village. Une nouvelle tâche locale remplace immédiatement l’ancienne, réinitialise son cycle et annule la cargaison en cours, comme une libération manuelle.

Un Habitant déjà déployé en Attaque ou Défense peut aussi être réaffecté individuellement. Il cesse immédiatement ses attaques, fait demi-tour et revient physiquement dans sa région d’origine avant de commencer sa nouvelle tâche ; une affectation Défense le ramène à son poste défensif. L’ordre « Rendre disponible » le rappelle au village. Il reste visible, vulnérable et soumis aux mêmes règles d’embarcation pendant le trajet. Aucun habitant ni unité n’est dupliqué et aucun déplacement n’est instantané pendant le rappel. Après un changement de ligne, il revient dans son village d’origine, sans migration.

Le joueur peut modifier la tâche demandée pendant le retour ; redonner la mission militaire initiale annule le rappel et reprend cette mission sur place. La liste affiche « Retour → [tâche] » et souligne la tâche demandée. La nouvelle tâche ne produit rien avant l’arrivée. Si son prérequis a disparu à ce moment-là, l’habitant revient disponible. Les équipements et bonus mythologiques sont conservés ; le nouveau métier s’applique à l’arrivée et une libération rend l’habitant ordinaire sans métier. La proportion de PV restante est mémorisée au retour et réappliquée lors d’un nouveau déploiement ; le rappel ne soigne pas le combattant. Une résurrection ou une protection qui restaure les PV efface cette blessure mémorisée. Pause et fin de partie conservent leurs restrictions existantes. Un ordre individuel validé annule les commandes groupées encore en attente pour cet habitant.

Chaque Habitant doit pouvoir être sélectionné individuellement depuis le village afin de recevoir ou quitter une mission.

## 28.2 DÉPLACEMENT DES AGRICULTEURS

L'Agriculteur est représenté physiquement dans sa région.

Son cycle de travail est :

1. départ du village d'origine ;
2. déplacement jusqu'à une culture de la région ;
3. récolte ;
4. retour physique au village ;
5. dépôt de la ressource dans la banque locale de ce village ;
6. courte pause au village avant un nouveau trajet.

La ressource n'est ajoutée à la banque qu'au retour de l'Agriculteur dans son village.

La quantité de base rapportée à chaque aller-retour est la **somme des niveaux des champs vivants de la même culture dans le village d’origine** : un champ de blé N1 → 1 blé, un N2 → 2 blés, un N3 → 3 blés ; un N3 et un N1 → 4 blés. Un vignoble ne compte pas pour le blé, et les cultures des autres villages ne sont pas comptées. La quantité transportée est fixée à la fin de la récolte ; ajouter ou améliorer un champ pendant le retour n’augmente pas une cargaison déjà chargée. Les bonus de vitesse de récolte et de déplacement restent applicables.

## 28.3 LAIT ET EFFECTIFS DES ÉLEVAGES

L'habitant affecté à l'élevage effectue un aller-retour village → élevage laitier → village. La traite dure 30 secondes, puis le lait est transporté et déposé dans la banque locale au retour. Il n'y a plus de versement automatique du lait directement en banque pendant la traite.

La base est **1 lait par animal laitier vivant du village** : 2 chèvres et 1 vache → 3 laits par trajet, avant les bonus de Berger et de Bergerie. Les cochons ne produisent pas de lait. Les bonus de rendement s'appliquent à cette base et peuvent donner une quantité fractionnaire. Chaque travailleur effectue son propre cycle. La cargaison est fixée à la fin de la traite ; les naissances suivantes augmentent les trajets suivants.

Les animaux continuent de se reproduire indépendamment des trajets. Le nombre total et les effectifs par espèce sont visibles dans la rubrique Élevages du village et se mettent à jour à chaque naissance ; chaque slot affiche aussi son effectif. Sans animal laitier, l'habitant affecté à l'élevage conserve son rôle de surveillance et ses éventuels bonus de reproduction, mais ne rapporte pas de lait.

Le joueur peut sélectionner un élevage et choisir précisément le nombre d'animaux à abattre. La viande est immédiatement déposée dans la banque locale du village : **4 par chèvre, 8 par cochon et 8 par vache**. Les animaux abattus sont retirés du troupeau, ses PV sont recalculés et le slot redevient libre si le dernier animal est abattu. La viande se vend ensuite uniquement avec le bouton « Sell » de la banque locale ; l'ancien bloc séparé « Vente de viande » est supprimé. La Boucherie conserve son bonus de prix de vente.

Dans l’interface, la quantité et le bouton **Abattre** sont intégrés directement au bloc **Enclos 1 à 4** de l’espèce présente. Il n’existe plus de liste d’abattage séparée : l’enclos indique son effectif, la quantité choisie et le gain en viande.

Les durées exactes de récolte et de pause restent des valeurs temporaires d'équilibrage centralisées dans `config.js`.

---

# 29. SYSTÈME DE DISTANCE

Le moteur ne doit pas dépendre directement des pixels de l'écran.

Une colonne peut être considérée comme faisant :

**100 unités logiques.**

Un Habitant normal doit la traverser en :

**20 secondes.**

Donc :

```text
100 / 20 = 5 unités/seconde
```

Vitesse de référence :

**5 unités/s.**

Cela permet de modifier la taille graphique de la carte sans casser les vitesses.

---

# 30. AGRICULTEUR

Bonus actuels :

* +20 PV ;
* +1 dégât/sec ;
* +20 % vitesse ;
* +20 % vitesse de récolte par Agriculteur.

Condition :

Le rôle Agriculteur est attribué automatiquement avec la tâche Agriculture. Aucun bâtiment n’est nécessaire ; une culture vivante est requise.

Bonus de Plaine :

Le bonus de récolte passe de :

**20 % → 30 %.**

---

# 31. BERGER

Bonus :

* +10 PV ;
* +2 dégâts/sec ;
* +30 % vitesse.

Effet économique :

* +20 % reproduction du bétail ;
* +20 % production du bétail, notamment le lait.

Condition :

Nécessite une :

**Bergerie.**

Bonus Montagne :

Les bonus de reproduction/production passent de :

**20 % → 30 %.**

---

# 32. PÊCHEUR

Bonus :

* +15 PV ;
* +3 dégâts/sec ;
* +10 % vitesse.

Effet :

**+20 % rendement de pêche.**

Condition :

La tâche Pêche nécessite une **Boucherie T1** et un accès à l’eau. Elle attribue automatiquement le rôle Pêcheur.

Bonus Littoral :

**20 % → 30 %.**

---

# 33. GUERRIER

Bonus :

* +20 PV ;
* +5 dégâts/sec ;
* +10 % vitesse.

Le Guerrier peut prendre une position défensive.

Dans ce mode, il reste sur le territoire et attaque les ennemis qui entrent dans sa zone.

Condition :

Le rôle Guerrier se choisit dans le menu Mode de combat et s’applique avec Attaquer ou Défendre, sans bâtiment requis.

---

# 34. RAVAGEUR

Bonus actuels :

* +10 PV ;
* +2 attaque ;
* +35 % vitesse.

Condition :

Le rôle Ravageur se choisit dans le menu Mode de combat et s’applique avec Attaquer ou Défendre, sans bâtiment requis. Son bonus de spécialité reste réservé à l’attaque.

Bonus :

**+5 attaque contre ses cibles spécialisées.**

Le Ravageur doit notamment servir à attaquer l'économie adverse.

**Priorité validée :** en attaque, le Ravageur se dirige d’abord vers les
cultures ennemies vivantes de sa colonne, même si une troupe ennemie est proche.
Il les frappe à sa cadence habituelle avec son bonus spécialisé de +5 dégâts.
Une fois les cultures détruites, il reprend son ciblage des troupes puis du village.
En défense, il conserve son poste ; les légendes ayant un rôle technique Ravageur,
notamment U Lupu Mannaru, gardent leurs propres règles de ciblage.

---

# 35. CHASSEUR

Statistiques :

* 5 PV ;
* 2 dégâts ;
* vitesse supérieure à celle d'un Habitant.

Dernière règle :

Le Chasseur va :

**50 % plus vite qu'un Habitant.**

Si l'Habitant est à 5 unités/s :

```text
Chasseur = 7,5 unités/s
```

Temps théorique pour traverser une colonne :

environ **13,33 secondes.**

Production :

Il rapporte :

**4 à 6 viande**

périodiquement.

La fréquence exacte n'est PAS encore définie.

**Combat à l’arc — règle validée :** le métier Chasseur tire à **15 unités** sur les troupes adverses de sa ligne, ainsi que sur le village ennemi. En attaque, il s’arrête dès qu’une cible est à portée ; en défense, il tire depuis sa position de garde. Les troupes ennemies à portée restent prioritaires sur le village. La détection couvre sa portée de tir. Les dégâts et la cadence existants sont conservés ; le projectile est visuel et les dégâts restent appliqués par le moteur de combat. Le village ne riposte qu’à sa portée de contact existante. Un habitant sans métier affecté à la chasse ne reçoit pas cette portée.

Pendant sa mission, le chasseur est visible et se déplace continuellement vers des positions aléatoires bornées à l’intérieur de sa région d’origine. Un habitant sans métier affecté à la chasse utilise la vitesse normale ; le métier Chasseur applique la vitesse validée de **7,5 unités/s**. Ce déplacement est visuel et ne modifie ni la fréquence ni le rendement de production de viande.

Condition :

La tâche Chasse nécessite un **Artisanat T1** et attribue automatiquement le rôle Chasseur. Le rôle Chasseur à l’arc peut aussi se choisir dans le menu Mode de combat pour Attaquer ou Défendre, sans bâtiment requis.

---

# 35.1 CONSTRUCTION DES BÂTIMENTS

Chaque village peut posséder **un seul exemplaire de chaque type** : une Bergerie, un Artisanat et une Boucherie, soit trois bâtiments au maximum. L’achat d’un type déjà présent est refusé sans dépense ni gain de PV, y compris par commande réseau. Les bâtiments possédés peuvent être améliorés jusqu’à T3 ; leur amélioration ne libère pas le droit d’en construire un second. Cette limite est indépendante pour chaque village et chaque joueur.

Les coûts restent ceux du prototype : T1, 200 or ; vers T2, 200 or et 100 unités d’une ressource locale choisie ; vers T3, 300 or et 150 unités de la ressource choisie. Les PV de bâtiment sont respectivement 75, 150 et 225 ; seule la différence est ajoutée lors d’une amélioration.

# 36. BERGERIE

PV :

* T1 : 75 ;
* T2 : 150 ;
* T3 : 225.

La Bergerie augmente :

* la vitesse de récolte ;
* la reproduction du bétail ;
* la production du bétail.

Progression actuelle :

* T1 : +10 % ;
* T2 : +20 % ;
* T3 : +30 %.

Déblocages :

## T1

* Cochon ;
* Chèvre ;
* Vache.

## T2

* Âne.

## T3

* Chien ;
* Sanglier.

Produits pouvant notamment être revendus :

* blé ;
* lait.

Bonus de revente :

* T1 : +5 % ;
* T2 : +10 % ;
* T3 : +15 %.

Un système de réduction d'achat en Montagne est prévu :

* T1 : -10 ;
* T2 : -20 ;
* T3 : -30.

Il reste à confirmer si ces valeurs représentent des pourcentages ou des valeurs fixes.

---

# 37. ARTISANAT

PV :

* T1 : 75 ;
* T2 : 150 ;
* T3 : 225.

L'ancienne règle liée au bétail est supprimée.

Règle actuelle :

**Décision du concepteur : l'Artisanat donne +2 dégâts et +5 PV à chaque habitant allié de sa colonne, sans cumul entre plusieurs Artisanats.** Le bonus ne dépend pas du nombre d'habitants ni du tier du bâtiment. Il s'applique aussi aux passagers humains d'une Charrette ; les animaux et la Charrette elle-même n'en bénéficient pas. Les unités perdent ce bonus lorsqu'elles quittent cette colonne pour une colonne sans Artisanat allié ou lorsque le village qui fournit le bonus est détruit. Les dégâts déjà subis sont conservés lors de la modification des PV maximum, selon la convention des améliorations existantes.

Déblocages :

## T1

* équipement en bois.

## T2

* équipement en bronze.

## T3

* équipement en fer.

Réduction d'achat en Plaine :

* T1 : -5 % ;
* T2 : -10 % ;
* T3 : -15 %.

Bonus de revente :

* T1 : +5 % ;
* T2 : +10 % ;
* T3 : +15 %.

---

# 38. BOUCHERIE

PV :

* T1 : 75 ;
* T2 : 150 ;
* T3 : 225.

Déblocages :

## T1

* filet de pêche ;
* barque.

## T2

* piège de chasse.

## T3

* voilier ;
* piège défensif (entrée de catalogue, mécanique à venir).

Produits pouvant notamment être revendus :

* viande ;
* poisson.

Réduction d'achat en Plaine :

* T1 : -5 % ;
* T2 : -10 % ;
* T3 : -15 %.

Bonus de revente :

* T1 : +5 % ;
* T2 : +10 % ;
* T3 : +15 %.

---

# 39. CHÂTAIGNIER

PV :

**200.**

Peut être placé :

* Montagne ;
* Plaine.

Bonus Montagne :

**+20 % production.**

Le rythme exact de production reste à définir.

---

# 40. CHAMP DE BLÉ

PV :

**200.**

Peut être placé :

* Plaine ;
* Littoral.

Un bonus en Plaine est prévu.

Valeur actuellement notée :

**+20**

mais la signification exacte doit être confirmée avant implémentation définitive.

---

# 41. VIGNOBLE

PV :

**200.**

Peut être placé :

* Montagne ;
* Littoral.

Bonus Littoral actuellement noté :

**+20**

mais la signification exacte reste à préciser.

---

# 42. RIVIÈRE

IMPORTANT :

Les rivières ne sont PAS présentes automatiquement sur la carte.

Une rivière apparaît avec le renfort A Fata ; elle n’est pas générée automatiquement.

La Rivière peut être placée dans :

* Montagne ;
* Plaine.

Elle crée notamment des possibilités de pêche.

Le système graphique doit permettre de passer par exemple de :

```text
montagne.png
```

à une représentation :

```text
montagne + rivière
```

sans recréer toute la carte.

---

# 43. MOULIN

> Historique : mécanique liée aux anciennes cartes, retirée du prototype
> actuel (section 59). Les valeurs ci-dessous restent une référence de conception.

PV :

**250.**

Effet :

**+30 % production agricole.**

Condition :

Le Moulin ne peut être utilisé que si une :

**Rivière**

est présente.

---

# 44. ÂNE

Effets :

* +20 % vitesse de déplacement ;
* +10 % à différents bonus de travail :

  * agriculture ;
  * récolte ;
  * pêche ;
  * chasse.

L'Âne est associé à une personne.

Si la personne associée meurt :

**l'Âne meurt également.**

Dans le prototype, l'Âne s'achète à la **Bergerie T2** et accompagne immédiatement l'habitant sélectionné, hors combat. Un habitant ne peut avoir qu'un âne. Le compagnon reste associé lors des changements de métier, tâche et déploiement ; il ne se reproduit pas et n'occupe pas d'enclos.

TEMP_BALANCE_VALUE : achat **150 or** ; convention de cumul, les déplacements sont multipliés par **1,2** après le bonus de métier et les rendements de travail par **1,1** après les autres bonus (agriculture, récolte de lait, pêche personnelle et chasse). Les trajets restent nécessaires pour déposer les récoltes. Aucun bonus n'est appliqué aux Filets autonomes ni à la reproduction des élevages. L'âne n'ajoute pas une seconde unité militaire et ne peut pas survivre à la mort de son habitant.

---

# 45. CHÈVRE

Effets :

* donne 4 viande à la mort ;
* peut être élevée ;
* peut être traite ;
* peut être abattue.

Reproduction :

**+1 chèvre toutes les 70 secondes.**

Production de lait :

**30 secondes de traite par cycle, puis transport et dépôt au village (voir 28.3).**

Toutes les 2 chèvres présentes dans le troupeau :

**-5 % temps de reproduction.**

Le troupeau gagne :

**+25 PV par chèvre présente.**

Bonus Montagne :

**reproduction +5 % plus rapide.**

---

# 46. COCHON

Donne :

**8 viande à la mort.**

Peut être :

* élevé ;
* abattu.

Reproduction :

**60 secondes.**

Toutes les 2 unités :

**-5 % temps de reproduction.**

Le troupeau gagne :

**+20 PV par cochon.**

Bonus Plaine :

**reproduction +5 % plus rapide.**

---

# 47. VACHE

Peut être :

* élevée ;
* traite ;
* abattue.

Reproduction :

**120 secondes.**

Production de lait :

**30 secondes de traite par cycle, puis transport et dépôt au village (voir 28.3).**

Donne actuellement :

**8 viande à la mort.**

Le troupeau gagne :

**+30 PV par vache.**

Un effet réduisant le temps de reproduction de 5 % existe mais la condition exacte doit encore être clarifiée.

Bonus Littoral :

**reproduction +5 % plus rapide.**

---

# 48. SANGLIER

PV :

**80.**

Dégâts :

**8 dégâts/sec.**

Le Sanglier peut :

* attaquer ;
* être abattu ;
* donner 8 viande à sa mort.

Il donne la priorité aux champs ennemis.

Particularité importante :

**le Sanglier peut traverser la mer.**

Dans l'eau :

**sa vitesse est divisée par 2.**

Cette mécanique possède une justification culturelle liée à une histoire/tradition corse concernant des sangliers venant de Sardaigne en traversant la mer.

La source doit être vérifiée avant utilisation académique définitive.

Le Sanglier s'achète à la **Bergerie T3**. Il attend au village avant de recevoir une mission **Attaquer** ; il est indépendant des habitants et n'utilise pas de place de population ni d'élevage. Sa priorité concerne les cultures ennemies de sa route, jusqu'à leur destruction, puis le combat ordinaire. Une culture détruite libère son emplacement et ne produit plus de récolte. Sur terre la vitesse normale est restaurée après la nage. Un Sanglier disponible au village peut être abattu depuis sa fiche de compagnon ; un animal engagé ne peut pas être abattu à distance.

TEMP_BALANCE_VALUE : achat **180 or**, vitesse terrestre **5 unités/s**. La viande (**8**, fixée par le GDD) de l'abattage ou de la mort est créditée une seule fois à la banque du village d'origine. La mort d'un sanglier ne réduit pas la population humaine.

---

# 49. CHIEN

PV :

**40.**

Dégâts :

**7**

La fréquence exacte d'attaque reste à préciser.

Le Chien peut perturber les élevages ennemis.

Effet :

**-5 % vitesse de reproduction adverse.**

L'effet peut se cumuler :

**maximum 4 fois par élevage.**

Le Chien peut également :

* attaquer les troupes ennemies ;
* prendre une position défensive à la frontière ;
* défendre un élevage lorsqu'il est placé dedans.

Interaction spéciale avec les chèvres :

l'effet passe de :

**5 % → 7 %.**

Le Chien s'achète à la **Bergerie T3**. Depuis sa fiche de compagnon, il peut **attaquer**, **défendre la frontière**, **garder un enclos allié choisi**, ou **perturber un élevage ennemi**. Les chiens sont des unités indépendantes, sans coût de population et sans remplacer le contenu d'un enclos. Un chien de garde combat les troupes à portée de l'enclos.

TEMP_BALANCE_VALUE : achat **120 or**, vitesse **5 unités/s**, **une attaque par seconde** pour ses 7 dégâts. Les positions et portées réutilisent celles du prototype. La perturbation est active tant que les chiens sont vivants, à portée de l'élevage ciblé et en mission de perturbation ; elle cesse lorsqu'ils partent ou meurent. Au plus **4 chiens par enclos** sont comptés, soit **−20 %** de vitesse de reproduction, ou **−28 %** pour les chèvres. Le facteur multiplie la vitesse de reproduction déjà calculée, sans détruire la progression du cycle. Le chien combat aussi les troupes ennemies à portée et doit être transporté pour traverser la mer.

---

# 50. BARQUE

La Barque sert à traverser le Littoral.

Lorsqu’elle est achetée, elle rejoint la réserve de son village. Sur un Littoral, elle apparaît aussi physiquement sur le bord de l'eau.

Maximum :

**4 Barques par village, dans tous les biomes.**

Position visuelle :

**côté droit.**

Capacité :

**2 personnes.**

La vitesse exacte reste à définir.

Une Barque est achetable dans n'importe quel village disposant d'une **Boucherie T1**. La réserve est propre au village et ses deux places peuvent être utilisées simultanément. L'embarquement est automatique à l'entrée dans l'eau, même si le village d'origine est une Plaine ou une Montagne et que l'eau appartient à l'adversaire. Les places sont libérées à la sortie de l'eau ou à la mort de l'unité et peuvent être réutilisées. La quantité de Barques reste indiquée sur leur article de la Boucherie et sur le terrain ; le bloc séparé « Réserve de barques » est retiré de la boutique. Les Voiliers et les Filets restent réservés aux Littoraux.

TEMP_BALANCE_VALUE : en attendant la définition du prix, une Barque coûte **100 or** dans le magasin du village.

---

# 51. VOILIER

Le Voilier sert également à traverser le Littoral.

Il est plus important que la Barque.

Capacité :

**15 personnes.**

Maximum :

**2 Voiliers par Littoral.**

Position visuelle :

**côté gauche.**

La vitesse exacte reste à définir.

TEMP_BALANCE_VALUE : en attendant la définition du prix, un Voilier coûte **350 or** dans le magasin du village. Il est achetable sur un Littoral disposant d'une Boucherie T3. Ses quinze places peuvent être utilisées simultanément.

---

# 52. CHARRETTE

> Historique : mécanique liée aux anciennes cartes, retirée du prototype
> actuel (section 59). Les valeurs ci-dessous restent une référence de conception.

PV :

**150.**

Capacité :

**8 habitants.**

La Charrette avance vers le village ennemi.

Lorsqu'elle arrive :

* elle se détruit ;
* les troupes transportées sortent.

Si l'adversaire détruit la Charrette avant son arrivée :

* les troupes sortent quand même.

En Montagne :

**vitesse réduite de 50 %.**

La valeur exacte de vitesse de base reste à préciser.

---

# 53. FILET DE PÊCHE

Effet :

**+1 poisson toutes les 30 secondes.**

Plusieurs filets peuvent être placés au même endroit.

Condition :

**uniquement dans l'eau.**

Le Filet est acheté depuis le magasin du village Littoral et nécessite une Boucherie T1. TEMP_BALANCE_VALUE : son prix est fixé à **75 or** tant que son coût définitif n'est pas validé. Le nombre de Filets n'est pas limité par le GDD ; chaque Filet produit séparément son poisson.

---

# 54. TOUR GÉNOISE

> Historique : mécanique liée aux anciennes cartes, retirée du prototype
> actuel (section 59). Les valeurs ci-dessous restent une référence de conception.

PV :

**300.**

Ancienne règle : le jeu possédait un système d'informations cachées, retiré dans la version actuelle (section 78).

La Tour génoise permet de révéler :

**1/4 de la colonne adverse.**

Si elle est placée dans un Littoral :

**elle révèle 50 % de la colonne.**

---

# 55. OUTILS

Un Habitant peut recevoir un outil.

Maximum :

**1 outil par Habitant.**

Les outils s’achètent pour le **village sélectionné** dans son Artisanat : bois au T1 pour **150 or**, bronze au T2 pour **250 or**, fer au T3 pour **400 or**. Un seul paiement équipe immédiatement **tous les habitants actuels et futurs de ce village**, hors légendes, y compris les habitants déjà en attaque ou en défense. L’achat est mémorisé dans le village ; naissances, habitants achetés et arrivées ultérieures reçoivent cet outil automatiquement. Les autres villages et les animaux ne sont pas concernés. Changer d’outil remplace le précédent pour le village, sans cumul ni remboursement ; un achat identique à l’équipement actif n’est pas repayé. Changer de métier ou de tâche conserve l’outil. Les bonus de quantité sont multiplicatifs avec les autres bonus de rendement ; le bois accélère le cycle de production personnel, pas le trajet. Les quatre tâches productives en bénéficient.

## Bois

* +5 attaque ;
* +20 % vitesse de production.

## Bronze

* +10 attaque ;
* +30 % production.

## Fer

* +20 attaque ;
* +50 % production.

---

# 56. ARMURES / ÉQUIPEMENTS

Maximum :

**1 armure par Habitant.**

Une armure peut être portée en même temps qu’un outil. Les armures s’achètent pour le **village sélectionné**, à l’Artisanat : cuir au T1 pour **150 or**, maille au T2 pour **250 or**, fer au T3 pour **400 or**. Un achat équipe **tous ses habitants actuels et futurs, hors légendes**, y compris les combattants déjà déployés. Il est payé une fois pour le village, pas par habitant. Le remplacement ne cumule pas les PV et ne rembourse pas l’ancienne armure. Pour les combattants, seule la différence de bonus est ajoutée ou retirée aux PV maximum et courants, en conservant les blessures déjà subies, les bonus d’Artisanat et les effets mythologiques. Les achats mémorisés s’appliquent aussi aux arrivées et résurrections dans ce village ; les légendes restent exclues. Outil et armure demeurent deux achats indépendants.

## Cuir

+15 PV

## Maille

+35 PV

## Fer

+50 PV

---

# 57. SENTIER DE RANDONNÉE

> Historique : mécanique liée aux anciennes cartes, retirée du prototype
> actuel (section 59). Les valeurs ci-dessous restent une référence de conception.

Utilisable :

**uniquement en Montagne.**

Effet actuel :

**+20 % vitesse de déplacement.**

Cette valeur est provisoire car le système de vitesse doit encore être équilibré.

---

# 58. PIÈGE

> Historique : mécanique liée aux anciennes cartes, retirée du prototype
> actuel (section 59). Les valeurs ci-dessous restent une référence de conception.

Dégâts :

**50.**

Lorsqu'un adversaire passe dessus :

**-50 % vitesse pendant 3 secondes.**

---

# 59. RETRAIT DU SYSTÈME DE DECKS

Décision du concepteur : le système de cartes normal est retiré. Il n’y a plus
de constructeur de deck, de présélection mythologique, de main ni de pioche.
La préparation porte uniquement sur les biomes. Les achats, tâches, métiers,
bâtiments et combats conservent leurs voies directes existantes.

Les fichiers, paramètres, styles, illustrations et tests de cet ancien système
sont supprimés. Les fonctions encore actives sont conservées dans les modules
de bâtiments et de renforts mythologiques.
Le menu principal propose désormais **LÉGENDES**, catalogue des dix-sept renforts.
Il les présente dans un grimoire : grande fiche illustrée, galerie en
parallélogrammes et filtres par catégorie. Ce menu de consultation utilise
le catalogue existant, sans effet sur les stocks ou les pouvoirs en partie.
Le fond de bibliothèque historique est réutilisé ; consulter une légende joue
un bruit de page, selon le réglage sonore. Les fiches détaillent les effets
et limites confirmés, sans modifier les règles ni les résumés des choix en jeu.
Le cristal individuel du grimoire reprend la couleur de la légende. Des
particules magiques flottent en permanence ; au survol, des éclairs longent
ses arêtes et font le tour de sa surface. Au clic, il éclate puis se reforme
de l’autre côté de l’illustration : l’image glisse à gauche pour révéler
l’histoire à droite, puis à droite pour retrouver le pouvoir à gauche.
Les récits fournis sont consultables dans le grimoire. Cette bascule
fonctionne aussi au clavier et au toucher, avec un mode de mouvement réduit.
Lorsqu’une vidéo propre à une légende est configurée, le passage à l’histoire
remplace l’illustration par cette animation muette en boucle, avec un léger
flash blanc limité à l’illustration, **vert pour A Strega**. Le retour aux
pouvoirs restaure l’image originale avec le même flash. **A Strega** utilise
son clip fourni **en entier (10 secondes)** ; **A Strega Bianca** conserve les
**3,75 premières secondes** de son clip. Les deux vidéos se lisent dans le sens
normal, puis reprennent directement au début, sans fondu de raccord ni séquence
ajoutée en marche arrière. **U Diavule** utilise une animation de flamme dans sa
main, également disponible en GIF. **L’Orcu** remplace son image au clic sur
son cristal par le clip fourni en entier (**10 secondes**), muet et en boucle
dans le sens normal, avec reprise directe au début.
Les autres légendes restent illustrées par leur image. Le mouvement réduit
conserve les images et supprime le flash et la lecture automatique.

---

# 60. OBTENTION DES RENFORTS

Une proposition est disponible au lancement de la préparation. Une nouvelle
est ajoutée toutes les **120 secondes de combat**, pour chaque joueur.
Préparation, pause et fin de partie ne font pas avancer cette cadence.

Chaque proposition contient deux légendes différentes, tirées dans le catalogue
central parmi les pouvoirs confirmés et implémentés. Le mode de développement
peut inclure des fiches incomplètes, sans rendre leurs pouvoirs activables.

---

# 61. FILE FIFO PRIVÉE

Les propositions s’accumulent sans limite ni remplacement dans une file privée
par joueur. Le cristal affiche uniquement la plus ancienne et un compteur :
0:00 → 1 proposition, 2:00 → 2, 4:00 → 3 si aucun choix n’est fait.

Choisir une légende retire uniquement la tête validée. Un double envoi ne peut
pas consommer la suivante. Les échéances traversées entre deux snapshots sont
toutes ajoutées une seule fois. Une nouvelle partie réinitialise les files,
sélections, activations et effets.

---

# 62. CRISTAL ET SÉLECTION

Le cristal reste centré en haut de l’écran, même inactif, abaissé sous le haut de l’écran pour garder toute la gemme, son compteur et ses éclairs visibles, avec une marge supplémentaire de 16 pixels. Il devient jaune,
avec ses petits éclairs électriques, lorsqu’une proposition attend.
Un clic déclenche les rayons bicolores existants et, après **500 ms**,
le glissement des deux grandes cartes trapézoïdales symétriques.
Leurs couleurs proviennent exclusivement de `mythology-data.js`.

Le chronomètre de partie est placé directement sous le cristal, y compris
pendant la préparation. Il conserve l’horloge existante et ses pauses ; aucune
seconde horloge n’est créée. Il reste sous la gemme entre les deux choix
lorsqu’ils sont ouverts, puis revient sous le petit cristal à leur fermeture.

Aucun choix ne s’ouvre automatiquement. Toute la surface de chaque proposition
est cliquable ; le choix validé reçoit sa bordure dorée, puis les cartes se
ferment. Fermer sans choisir conserve la proposition. La sélection n’est pas
chronométrée et ne déclenche aucun pouvoir.

Si une autre proposition attend, le cristal se réarme immédiatement ; un
nouveau clic est obligatoire. Les animations et la géométrie existantes restent
inchangées. Les illustrations sont normales à gauche et inversées à droite ;
en l’absence d’une variante distincte, seul l’élément image est retourné.

---

# 63. STOCK LÉGENDES ET ACTIVATION

Les renforts obtenus apparaissent immédiatement dans le panneau latéral
**LÉGENDES**, à la place des blocs « Banque locale » et « Réserve de barques ».
Chaque exemplaire est représenté par son illustration normale en
**parallélogramme**, avec son nom lisible, dans l’ordre d’obtention. L’illustration conserve ses proportions d’origine à toutes les tailles de panneau et lorsque la légende est sélectionnée : la bordure change de couleur sans changer la taille de l’image.
Les ressources restent consultables dans les fiches de villages et la boutique ;
les achats et quantités de barques restent dans l’article de la Boucherie, sans bloc de réserve séparé.

Le joueur clique sur l’image obtenue, puis directement sur le terrain :
une région compatible pour un effet régional, une colonne pour un effet de
colonne, ou n’importe quelle région du plateau pour un effet global. Il n’y a
ni liste déroulante de cible ni bouton « Utiliser ». Le premier clic prépare
le pouvoir sans le déclencher. Les cibles possibles sont soulignées en doré
sur le plateau 2D/3D. Échap, le bouton Annuler ou un second clic sur l’image
annulent cette préparation sans consommation.

Chaque exemplaire est utilisable une seule fois. Après validation, son image
disparaît du stock disponible ; l’historique privé reste conservé. Un clic
incompatible ou pendant la pause ne consomme rien. La même validation réseau
et la même protection contre les doubles envois s’appliquent.
Les effets utilisent toujours le temps de combat, jamais un minuteur indépendant.

L’inventaire est une vue des sélections privées, pas un deuxième stockage.
Une sélection passe par `awaiting-activation`, `activation-pending`, puis
`activated` après confirmation. Un identifiant d’activation garantit l’unicité.

---

# 64. AUTORITÉ MULTIJOUEUR

Le relais conserve les files et sélections privées ; le navigateur hôte
conserve la simulation autoritaire existante. Le propriétaire est déterminé par
la connexion. Le relais vérifie le match, l’offre obtenue, son propriétaire,
son état et la forme de la cible avant de réserver une activation.

Seule l’exécution explicitement demandée est envoyée à l’hôte. Celui-ci valide
la cible contre le monde courant, applique une seule fois le pouvoir, publie
ses effets et renvoie le résultat au relais. Un refus remet le renfort à
disposition. Les tirages et stocks adverses ne sont jamais inclus dans les
snapshots publics ; un pouvoir utilisé devient nécessairement connu de l’hôte.

La confidentialité visuelle des habitants utilise le snapshot partagé : elle
ne constitue pas une protection contre l’inspection technique du client.
L’architecture reste un relais et un hôte navigateur, pas un serveur de jeu
entièrement autoritaire.

---

# 65. CATÉGORIES ET CONFIGURATION

Les catégories des renforts sont **invocation**, **enchantement**, **terrain**
et **vision**. Les dix-sept fiches résident dans `mythology-data.js` :
identifiants stables, alias, illustrations, couleurs, descriptions, cibles,
paramètres et état d’implémentation. Les effets restent dans
`mythology-effects.js`, l’interface dans `mythology-ui.js`.

Les valeurs confirmées et provisoires sont centralisées dans
`Config.reinforcementPowers`. TEMP_BALANCE_VALUE : vitesses chiffrées
d’« extrêmement lent », « rapide » et « très rapide », cadence et quantité de
vol des follets, positions d’invocation. Les teintes échantillonnées d’après
la planche restent provisoires, pas des couleurs définitivement validées.

---

# 66. U MAZZERU — VISION

Ancien pouvoir : révélation des humains offensifs adverses. Depuis le retrait du brouillard de guerre (section 78), tous les habitants et unités sont déjà visibles ; ce pouvoir ne donne plus de visibilité supplémentaire.

---

# 67. ENCHANTEMENTS DE PRODUCTION

* **A Strega** : rendement d’une région ennemie divisé par deux, **120 s**.
* **U Stregu** : rendement d’une région alliée multiplié par deux, **120 s**.

Ces effets réutilisent les calculs existants de production.

---

# 68. U DIAVULE — TERRAIN

Brûle les **deux territoires de la colonne**, allié et adverse. Les unités,
cultures et élevages présents sur les terrains reçoivent **10 dégâts dès
l’invocation**, puis **6 dégâts par seconde** pendant les secondes suivantes.
Le feu dure **66 secondes** : 66 impacts au total, à t=0 puis t=1 à t=65,
soit **10 + 65 × 6 = 400 dégâts** pour une cible exposée pendant toute la durée.
Les cibles qui entrent ou sortent du terrain brûlé sont prises en compte à chaque
impact ; aucune destruction immédiate ne remplace les dégâts.
Les habitants à l’intérieur des villages, les remparts et les bâtiments sont
épargnés. Les morts, protections et transformations existantes sont résolues
normalement ; une culture ou un élevage détruit libère son emplacement.

La description affichée lors du choix et de l’utilisation est uniquement :
**« Anéantit le village de votre adversaire. »**
La description mécanique complète reste dans les données.

---

# 69. TERRAIN BRÛLÉ

Les deux régions sont brûlées pendant **66 secondes**, sans nouveaux placements
pendant cette période. Le délai commence à l’invocation, **y compris pendant la
préparation**, et se fige en pause. Un nouvel usage sur la même colonne renouvelle
le feu et son premier impact ; les dégâts périodiques de ces usages ne se cumulent
pas. La répétition réseau d’une même activation n’ajoute ni impact ni apparition.

**U Diavule apparaît du côté du joueur qui le lance**, sur la partie terrestre de
la colonne choisie. Le modèle Tripo fourni (`diabule 3D.zip`) reprend la séquence
de `ScreenRecording_11-08-2026 18.mov` : apparition translucide, flash de feu,
ouverture ample des ailes, élévation avec le bras gauche levé et le coude droit fléchi, puis réception accroupie et reprise d’appui. La compression avant la poussée, les jambes repliées en suspension et le décalage des extrémités des ailes accentuent le mouvement. Le flash blanc-or, le halo, les rubans d’étincelles en volume et l’onde au sol sont synchronisés avec ces poses ; une brève lumière éclaire le modèle et le sol. Le personnage fait face au joueur au début de son apparition, puis conserve cette orientation pendant la séquence.
Le clip `Invocation` dure environ **1,63 seconde**, suivi de `Battement` jusqu’au
retrait visuel à 7 secondes. Le **son original** de la vidéo est extrait dans
`assets/audio/diavule-invocation.wav` et joué une fois par activation, selon le
réglage sonore. Le modèle est préchargé pour être disponible à l’invocation.
Les sources Blender et `eredita3D/scripts/animate_diavule_invocation.py` permettent
de régénérer `assets/models/diavule.glb`.

Flammes, braises et étincelles marquent les deux terrains jusqu’à la fin des
66 secondes. La cour des villages et l’eau restent dégagées. La vue 2D possède
également son effet de feu. L’apparition est visuelle et n’ajoute aucune unité
combattante ; le feu suit les données de l’activation confirmée pour les deux camps.

---

# 70. U DIAVULE ET LES BÂTIMENTS

Clarification du concepteur : villages et bâtiments sont épargnés.
L’ancienne exception de **125 dégâts depuis une Montagne est supprimée**.

---

# 71. ORIGINE DE U DIAVULE

La restriction existante est conservée : le village allié de la colonne
d’origine doit être vivant au moment de l’activation.

---

# 72. RÉSURRECTIONS

**A Squadra d’Arozza** ressuscite les habitants alliés morts dans la
**dernière minute**, sans bonus de fenêtre depuis la Plaine.
La destination existante reste le village d’origine ou, s’il est détruit,
le village vivant le plus proche. TEMP_BALANCE_VALUE conservée : à égalité,
plus petit numéro ; si l’accueil est plein ou brûlé, attente dans la file de
résurrection. Le métier est restauré et la tâche devient disponible. L’équipement acheté dans le village de retour s’applique ; pour une catégorie sans achat collectif, l’ancien équipement est restauré.
Un décès ne peut pas être ressuscité deux fois.

**A Strega Bianca** protège seulement les prochaines morts pendant **60 s**.
Ce délai n’est pas affiché en jeu. Un humain qui devrait mourir est téléporté
au début de son terrain, en pleine vie, avec les mêmes tâche et équipement.
Elle ne ressuscite pas les morts antérieures et ne protège pas les légendes.
La protection utilise une lueur verte et dorée.

---

# 73. AUTRES RENFORTS CONFIRMÉS

| Renfort | Catégorie | Pouvoir |
| --- | --- | --- |
| A Fata | terrain | Place une rivière dans la région choisie ; vitesse de pêche +25 %. |
| L’Orcu | invocation | 200 PV, 30 dégâts, extrêmement lent, dans la région choisie. |
| Le Lion de Roccapina | invocation | 145 PV, 25 dégâts par coup ; regroupe les guerriers, ravageurs et archers alliés déployés dans sa colonne, à avancement identique. |
| U Magu | enchantement | Uniquement le prochain habitant de chaque village allié : statistiques ×2, taille +50 %, aura violette et dorée. |
| U Surpatore | invocation | Sanglier qui, à sa mort, devient un vampire de 40 PV et 11 dégâts, rapide. |
| U Lupu Mannaru | invocation | Transforme un habitant sans tâche ni métier, sinon le prochain nouveau-né ; 60 PV, 20 dégâts, propriétés du Ravageur, structures uniquement. |
| Anima in Pena | invocation | Une âme par mort allié de la colonne ; 1 PV, 1 DPS, tâches possibles, métiers interdits. |
| A Mumma | enchantement | Fait repartir les intrus ennemis présents dans tous les territoires alliés. |
| I Lacramanti | enchantement | Humains alliés présents sur la colonne : +2 PV et +1 dégât par mort allié depuis le début sur cette colonne ; pas les légendes. |
| U Fullettu | invocation | Cinq follets aléatoirement sur les terres alliées, 20 PV, 0 dégât, très rapides ; ressources ennemies transférées directement à la banque locale alliée. |
| Œil de Sainte-Lucie | vision | Révèle toutes les statistiques des villages ennemis jusqu’à la fin de la partie : population, disponibilités, stocks, niveau et bâtiments. |

## Ajout du concepteur — 12 novembre 2026 : Lion de Roccapina

**Le Lion de Roccapina** est une invocation de **145 PV**, infligeant **25 dégâts par coup** à la cadence de combat existante. Il apparaît dans la région choisie. À son placement, **uniquement les troupes de son invocateur** déjà déployées en Guerrier, Ravageur ou Archer sont téléportées dans sa colonne, en conservant leur position longitudinale, leurs PV, leur équipement, leur ordre et leur village d’origine. L’Archer correspond au métier interne `chasseur` en combat. Les travailleurs, animaux, autres légendes et ennemis ne sont pas regroupés. Le regroupement se produit une seule fois à l’invocation ; les futurs déploiements ne sont pas attirés en permanence.

Les redirections en cours sont annulées pour les troupes regroupées. Le retour au village d’origine et les règles de transport/noyade existantes continuent de s’appliquer ; les embarcations ne sont pas déplacées avec les troupes. Sa vitesse, non précisée, reste **temporaire** dans `config.js` (5). Le point d’apparition utilise le réglage provisoire commun des invocations.

Son récit fourni par le concepteur raconte un guerrier corse surnommé « Lion », changé en granit après un amour impossible. Il veille sur les côtes et les amours impossibles ; son rugissement résonnerait à la pleine lune. Source du récit transmise : Pozzo di Borgo. Le modèle `Roccapina 3d.glb` fourni est intégré en `assets/models/lion-roccapina.glb`. Le fichier source ne contient pas de clips ; la version web possède désormais cinq clips créés sur son squelette : repos, marche, frappe droite, revers et mort. L’épée fournie est allégée puis attachée à sa main droite. Sa hauteur visuelle est ramenée à 0,60 unité, proche des autres combattants. La vidéo fournie sert au grimoire ; son illustration est une image extraite de cette vidéo, sans génération d’asset.

Les invocations utilisent les unités et déplacements existants. Les vitesses
non chiffrées par le concepteur restent temporaires dans la configuration.
Les figurines 3D du prototype réutilisent les modèles existants teintés et
redimensionnés, sauf les modèles fournis de L’Orcu, U Fullettu, U Lupu Mannaru
et de la forme vampire d’U Surpatore décrits au
chapitre 79 ; les autres ne constituent pas encore les modèles définitifs.

---

# 74. COMBAT

Le combat doit fonctionner dans l'esprit d'un jeu comme Clash Royale, sans copier ses éléments graphiques.

Lorsqu'une unité de combat est placée :

1. elle apparaît physiquement sur le terrain ;
2. elle avance automatiquement ;
3. elle détecte les ennemis ;
4. elle s'arrête si nécessaire ;
5. elle attaque ;
6. si la cible meurt, elle reprend son déplacement ;
7. elle continue vers le village adverse.

Le combat se déroule :

**EN TEMPS RÉEL.**

L'économie continue également pendant le combat.

**Défense de proximité des habitants :** un habitant local (sans tâche, agriculteur, berger, pêcheur ou chasseur) interrompt temporairement sa tâche lorsqu’une troupe ennemie entre dans sa distance de détection, sur sa ligne. Il conserve son métier, son équipement, sa récolte transportée, son emplacement et sa progression de travail. Il combat avec ses statistiques existantes ; l’ennemi peut lui rendre ses coups. Le travail et sa production sont suspendus pendant cette intervention. La défense est limitée aux environs de la position où l’habitant a été interrompu : il ne poursuit pas une troupe à travers la carte. Quand la menace disparaît ou s’éloigne, il retourne à ce point et reprend sa tâche, sans soin gratuit ni perte de cargaison. Une nouvelle consigne donnée par le joueur reste prioritaire et utilise le rappel existant. La mort retire normalement l’habitant et son affectation. Les légendes conservent leurs comportements propres.

La détection réutilise la valeur temporaire existante de **4,5 unités**, portée à la portée d’attaque si elle est supérieure (**15 pour le chasseur**). Les distances restent celles du moteur par colonne. Le point logique du pêcheur sur la rive est centralisé temporairement à 23/77 dans `Config.combat.fishingPositionByOwner`. Une troupe en attaque se dirige vers un ennemi détecté à proximité, même situé derrière elle, puis reprend sa progression après le combat. Les dégâts, cadences, tirs à l’arc, priorité du sanglier sur les cultures et riposte des villages restent inchangés.

**PV des cultures :** chaque culture possède une jauge circulaire à son pied, en 3D et en 2D. Le cercle complet correspond aux PV maximum ; l’arc diminue avec les dégâts et passe du vert au jaune puis au rouge. Il se met à jour sans remplacer le modèle et disparaît avec la culture détruite. Les 200 PV et l’absence de soin lors d’une amélioration restent inchangés.

Chaque habitant qui attaque un village adverse vivant subit une riposte de **5 dégâts par seconde** tant qu'il reste en train de l'attaquer, y compris entre ses coups. Chaque assaillant reçoit ces dégâts individuellement. Il n'en subit pas pendant son trajet, sa redirection, une défense ou un combat contre une unité. La riposte s'arrête à la destruction du village. Les dégâts par seconde sont désormais appliqués sous forme d'**un impact toutes les secondes**, et non de petites fractions à chaque image ; la même convention s'applique notamment aux 8 dégâts/sec du Sanglier. Les impacts s'arrêtent en pause, peuvent tuer l'assaillant et retirer cet habitant de sa population d'origine. Les coups et la riposte d'un même instant sont résolus simultanément.

---

# 75. STATISTIQUES DE COMBAT À PRÉVOIR

Chaque unité doit pouvoir posséder :

```text
HP
dégâts
vitesse
vitesse d'attaque
portée
type de cible
priorité de cible
biome favori
bonus de biome
effets spéciaux
```

Ces statistiques doivent être stockées dans des données/configurations plutôt que dispersées dans le code.

---

# 76. REDIRECTION APRÈS DESTRUCTION D'UN VILLAGE

Normalement :

```text
R1 attaque B1
R2 attaque B2
R3 attaque B3
R4 attaque B4
```

Mais lorsqu'un village adverse est détruit, les unités de cette colonne ne doivent pas rester bloquées pour toujours.

Les troupes militaires peuvent être redirigées vers une région adjacente.

Structure :

```text
R1 ↔ R2 ↔ R3 ↔ R4
```

Si la cible directe est détruite :

* aller à gauche ;
* ou aller à droite.

Si les deux directions sont possibles :

le joueur peut choisir.

Si une seule direction permet d'atteindre un village vivant :

elle peut être utilisée automatiquement.

Si aucun village adjacent direct n'est vivant :

l'unité doit pouvoir continuer progressivement vers :

**le village ennemi vivant le plus proche.**

Pas de téléportation.

---

# 77. PERSONNEL ÉCONOMIQUE ET REDIRECTION

Les habitants affectés au fonctionnement économique restent liés à leur village/région.

La redirection entre colonnes concerne principalement :

**les unités militaires en attaque.**

Ne pas permettre arbitrairement à toute la population de migrer d'un village vers un autre.

---

# 78. VISIBILITÉ DU TERRAIN

Le brouillard de guerre et le système de dissimulation du camp adverse sont retirés.
Les deux joueurs voient en permanence tous les terrains, villages, bâtiments,
cultures, élevages, habitants et unités des deux camps, en 2D, en 3D et en XR.
Le bandeau supérieur présente les deux camps : pour chacun, une fiche globale et une fiche par village, soit **six fiches en format simplifié**. L’or global, les PV des villages et leur total, les paliers d’équipement et le nombre de légendes en réserve sont publics. Chaque village possède trois épées (bois : 1, bronze : 2, fer : 3) et trois boucliers (cuir : 1, maille : 2, fer : 3), gris sans équipement et dorés jusqu’au palier acheté. Les paliers V1 et V2 sont distingués dans la fiche globale, car leurs achats sont indépendants. La liste Habitants reprend ces mêmes pictogrammes à côté du nom de chaque habitant : trois épées pour son outil et trois boucliers pour son armure, gris sans achat et allumés jusqu’au palier équipé. Le nom et les icônes reviennent à la ligne si le panneau est étroit. Les changements d’équipement collectif mettent ces indicateurs à jour, y compris pour les habitants déployés et les nouveaux arrivants ; les légendes gardent les indicateurs sans équipement.

Les légendes en réserve sont représentées uniquement par des cristaux de leur couleur du catalogue, sans nom ni illustration. Un cristal et son compteur disparaissent de ce résumé après l’utilisation de la légende. Les propositions encore non choisies sont désormais visibles dans les deux fiches globales, sous forme de cristaux bicolores reprenant les deux couleurs proposées. Après le choix, le cristal bicolore devient celui de la légende choisie. Le nombre et les couleurs des propositions sont publics ; leurs identifiants et le contenu des fiches de choix restent privés. Le compteur de légendes en réserve compte toujours les légendes déjà choisies, et les cristaux en attente sont identifiés séparément.

Les fiches des villages ennemis restent visibles avec leurs **PV** ; population, habitants disponibles et stocks affichent « ? ». L’**Œil de Sainte-Lucie** dévoile toutes leurs statistiques jusqu’à la fin de la partie, quel que soit leur biome, avec une mise à jour en temps réel. Le niveau et les bâtiments sont également consultables en lecture seule. Ce pouvoir ne donne aucune commande de gestion de l’adversaire. En mode local partagé, la confidentialité dépend du camp sélectionné. Une nouvelle partie réinitialise la révélation.

U Mazzeru conserve son ancien pouvoir sans visibilité supplémentaire, puisque tous les personnages sont déjà visibles. La révélation statistique de Sainte-Lucie est indépendante de la visibilité permanente du terrain et des unités.

---

# 79. INTERFACE DES VILLAGES

Le libellé « Villages rouges » au-dessus du terrain est retiré. L’ancien texte « Plateau Eredità en trois dimensions » est remplacé par le libellé accessible court « Carte ».

Le magasin ne doit pas nécessairement être une grande interface indépendante.

Le système d'achat est intégré au village.

La boutique s'ouvre depuis le panneau latéral et permet de naviguer entre les villages du joueur sans la fermer. Elle comporte quatre colonnes sur grand écran : vente des six ressources locales du village sélectionné, Bergerie, Artisanat et Boucherie. L'or gagné par la vente reste global. La première colonne ne contient que la vente des ressources : les blocs « Réserve de barques », « Équipement du village » et « Habitant associé à l’âne » sont retirés. L’équipement collectif reste achetable dans la troisième colonne et consultable dans le bandeau de statistiques. L’âne est associé à l’habitant sélectionné dans le panneau Habitants ; son nom est précisé sur l’article de la Bergerie. Un clic en dehors de la fenêtre ferme la boutique, tout comme le bouton rouge « Retour ». Chaque échoppe exige le bâtiment associé et chaque rayon exige son bon tier. La Bergerie T1 débloque Chèvre, Cochon et Vache, T2 l'Âne, T3 Chien et Sanglier. L'Artisanat T1 débloque l’équipement en bois et cuir, T2 l’équipement en bronze et maille, T3 l’équipement en fer. La Barque, le Piège et le Piège défensif sont retirés de l’Artisanat. La Boucherie T1 débloque Filet de pêche et Barque, T2 Piège de chasse, T3 Voilier et Piège défensif. Barque, Voilier, Filet, chèvres, cochons, vaches, ânes, chiens, sangliers, outils et armures sont achetables et fonctionnels ; les éléments dont la mécanique n'est pas encore implémentée restent visibles mais non achetables. La liste « Compagnons du village » de la Bergerie permet de commander séparément chiens et sangliers et d'en consulter les PV. Le malus de reproduction actif est indiqué directement dans l'enclos touché.

Chaque achat d'animal ajoute **un animal** à un enclos vivant de la même espèce, choisi au hasard **dans le village sélectionné**. S'il n'existe aucun enclos compatible, un emplacement libre autorisant les animaux est choisi au hasard pour en créer un. Aucune culture ni autre espèce n'est remplacée. S'il n'y a pas de place, l'achat est bloqué sans dépense. Les dégâts du troupeau et sa progression de reproduction sont conservés. TEMP_BALANCE_VALUE : achat d'une chèvre **50 or**, d'un cochon **65 or**, d'une vache **90 or**, avec Bergerie T1 minimum. Le placement direct d'un élevage est disponible sans Bergerie dans un emplacement libre compatible, selon les règles provisoires du prototype.

Lorsqu'un village est sélectionné, le joueur doit pouvoir accéder à des actions comme :

```text
Ajouter un bâtiment
Améliorer le village
Acheter / débloquer certains éléments
Gérer les habitants
Vendre les ressources locales
```

Le cristal et son chronomètre sont centrés tout en haut de l’écran, entre les fiches des deux camps. Les six fiches se disposent sur une rangée sur ordinateur et sur trois rangées de part et d’autre du cristal sur téléphone en portrait. La carte s’ouvre dans une vue orientée avec le camp Rouge à gauche et le camp Bleu à droite. Les bordures des panneaux sont redimensionnables à la souris, au toucher et au clavier : largeurs des colonnes, hauteurs du terrain/Métiers et de la gestion du Village, répartition Habitants/Tâches, fiches supérieures et tableau Bâtiments et des emplacements. Les panneaux conservent leur ordre et leurs contenus peuvent défiler à l’intérieur. Les tailles sont mémorisées localement, avec des préférences séparées pour ordinateur/paysage et téléphone en portrait ; aucune commande réseau ni règle de simulation n’en dépend. Les tailles minimales empêchent de masquer complètement un panneau. Échap annule le geste en cours, le double-clic ou la touche Début rétablit une bordure ; le bouton ↺ du panneau Habitants réinitialise la disposition complète. `npm run test:layout` vérifie le responsive et les interactions.

Le message « Préparation : attribuez vos tâches et métiers… » est retiré ; la durée et le chronomètre de préparation sont conservés.

L’écran de jeu occupe une seule hauteur de fenêtre, sans défilement global : carte centrée, habitants et tâches fusionnées à gauche, tableau **3 · Bâtiments** en bas au centre à la place de l’ancien panneau Métiers, gestion du village en bas à droite. Le tableau présente Bergerie, Artisanat et Boucherie avec modèles, rôles, bonus, coûts et améliorations ; les trois fiches sont côte à côte sur grand écran, compactes et défilables sur petit écran. Leurs achats restent uniques par type et par village, avec les mêmes coûts et PV. Sous la boutique, à droite, restent les villages, emplacements et informations utiles. Les panneaux restent redimensionnables et les listes longues défilent à l’intérieur.

Les tâches affichent leur nom, leur couleur et de zéro à trois étoiles selon le niveau du bâtiment associé, comme décrit au §28.1. Le menu Mode de combat propose Guerrier/Ravageur/Archer sans ajouter de série de boutons de métier. Les actions « Tous », « Retirer tous » et « Prochains » portent sur les tâches ; aucune commande groupée séparée de métier n’est affichée. La tâche active est signalée par un contour doré qui conserve sa couleur d’activité. Le choix Prochains est appliqué aux naissances et achats si ses conditions sont toujours réunies.

Chaque personnage blessé (**PV courants inférieurs au maximum**) dispose d’une barre de **PV courants / maximum au-dessus de sa tête**. Cette barre est masquée à pleine santé et disparaît après un soin complet. Chaque personnage conserve son cercle lumineux doux à ses pieds : **bleu pour un allié du joueur qui regarde, rouge pour un ennemi**, quel que soit le camp Rouge/Bleu. Le cercle contient l’icône du métier. Deux petits pictogrammes épée et bouclier indiquent respectivement le tier d’outil et d’armure : **T1 marron, T2 gris, T3 doré** ; sans équipement, l’icône est atténuée. Les légendes gardent leurs règles d’équipement. Les PV se mettent à jour pendant les dégâts, soins, achats d’équipement et changements de rôle ; un marqueur disparaît à la mort. La sélection d’un habitant affiche aussi PV, dégâts et portée dans le panneau Tâches. Ces repères existent en 3D et en 2D, avec des textures de cercle partagées, sans effet sur les règles ni nouvelle divulgation des stocks des villages ennemis.

La carte 2D/3D est interactive : un clic ou un toucher sélectionne un village du joueur, une parcelle, un habitant local ou déployé, un bâtiment ou son chantier. Le tour du village sélectionné brille en jaune ; la parcelle ou le bâtiment choisi reçoit aussi un repère jaune. Le glissement continue à orienter la caméra et ne déclenche pas de sélection. La fiche compacte sur la carte permet de planter ou améliorer une culture, construire ou améliorer un bâtiment, améliorer le feu du village, et accéder aux tâches de l’habitant sélectionné. Les panneaux et boutons de navigation existants restent utilisables. Les clics passent par les mêmes commandes, prix, prérequis et protections réseau ; ils ne donnent pas le contrôle des ennemis. Les pouvoirs mythologiques qui demandent de viser une région gardent la priorité. Chaque type de bâtiment absent est représenté par un petit chantier à son emplacement : un simple panneau en bois portant un pictogramme de foin pour la Bergerie, d’outils pour l’Artisanat ou de four en pierre pour la Boucherie, accompagné de quelques planches et pierres. Il ne représente pas un bâtiment déjà construit. Le chantier est purement visuel, sans délai ni paiement supplémentaire ; il disparaît dès la construction. Le modèle commun `assets/models/chantier-construction.glb` provient de Tripo P1 (tâche `ffc5e5bd-0336-4e6a-9c4e-9f565d888035`, 40 crédits) : 1 425 triangles, un matériau PBR, textures ramenées à 512 px, hauteur 0,44 et emprise inférieure à 0,65 × 0,55. Les trois pictogrammes sont ajoutés en relief, sur les deux faces, par le rendu local. Les panneaux des chantiers s’orientent autour de leur axe vertical pour rester face à la caméra du joueur, y compris lorsque le plateau est tourné à la verticale et en XR ; ils restent ancrés à leur emplacement et conservent leur sélection. Géométrie et textures du chantier sont partagées entre les villages ; chaque exemplaire conserve sa sélection et son remplacement indépendants. Le visuel simple reste disponible pendant le chargement ou si le GLB échoue. `scripts/prepare-construction-site.py` reproduit localement l’orientation et l’optimisation depuis le GLB source dans `eredita3D/exports/chantier-construction-tripo-original.glb`. Le temps restant apparaît en haut au centre de la carte. Dans le panneau latéral, un groupe unique de quatre boutons **Slot 1 à 4** remplace les listes séparées de cultures et d'élevages. Cliquer sur un slot ouvre juste sous ces boutons les cultures compatibles avec son biome et, si le slot l'autorise, les élevages disponibles. Un clic sur un type place directement le contenu et garde son panneau de Slot ouvert. Les cultures affichent leur niveau et le prix de plantation de 75 or. Un slot de culture donne accès aux améliorations N2/N3 et, pendant la préparation, à la vente remboursée à gauche de l’amélioration. Un slot occupé par un élevage donne accès au retrait gratuit pendant la préparation, à l’abattage d’une quantité choisie et à Tout abattre. Le retrait disparaît à la fin de la préparation, et l’action restante se replace à gauche. Le remplacement payant d’une culture est accessible dans le volet Changer de culture. Les slots inexistants sont grisés. Le Littoral ne possède toujours que deux slots.

Les fiches des villages du joueur sont placées tout en haut au centre de l’écran, hors du terrain : deux fiches côte à côte en Simplifié et quatre en Classique (deux colonnes sur téléphone). Chacune affiche les PV, la population, les habitants disponibles et les six stocks locaux. La fiche sélectionnée est mise en évidence. Aucune fiche adverse n’est affichée. En réseau, le joueur Bleu voit uniquement les fiches bleues. Le terrain profite de l’espace libéré par les anciennes superpositions pour être agrandi. Les boutons Pause, Vue 2D/3D et Réalité mixte sont retirés de l’écran de partie. Le tutoriel revient automatiquement en 3D après l’explication des biomes.

Les bâtiments et le village peuvent évoluer jusqu'à T3. L’amélioration du village passe désormais par le bouton **Améliorer le feu** dans la carte **Feu de camp**, à côté de l’achat d’un habitant ; l’ancien bouton d’amélioration du village est remplacé, sans second achat ni niveau indépendant. Cette commande conserve les coûts et effets actuels : 300 puis 450 or, 400 puis 600 PV de base, plafonds de 25 puis 35 habitants. Le feu ne modifie pas la cadence de génération. L'amélioration ajoute uniquement la différence de PV entre niveaux aux PV courants et maximum, conservant les dégâts déjà subis. Le village passe aux plafonds de 25 puis 35 habitants. TEMP_BALANCE_VALUE : son amélioration coûte 300 or vers T2 et 450 or vers T3, sans ressource locale. Les coûts provisoires sont centralisés dans `config.js`.

Le joueur peut aussi acheter immédiatement un nouvel habitant dans le village sélectionné, si la population n'a pas atteint son plafond. TEMP_BALANCE_VALUE : cet achat coûte **50 or global et 50 unités d'une ressource locale au choix**. Le nouvel habitant reçoit la tâche et le métier actuellement choisis pour les nouveaux habitants de ce village ; par défaut, il arrive disponible et sans métier.

Le plateau emploie désormais des illustrations dédiées pour les trois terrains, les cultures, les élevages, les habitants et les bâtiments. Ces visuels servent à identifier plus vite les éléments ; les libellés, états et infobulles restent la référence fonctionnelle.

Chaque habitant possède une apparence liée au **métier automatiquement attribué par sa tâche**, avec conservation de l’apparence actuelle pendant un rappel : modèle GLB fourni par le concepteur, en pose de repos (sans métier), modèle GLB du fermier fourni, avec chapeau de paille et animation de récolte accroupie (agriculteur), modèle GLB du berger fourni, avec béret, manteau et cape de fourrure (berger), chapeau et canne (pêcheur), modèle GLB du chasseur fourni et arc en bois avec corde animée (chasseur), guerrier corse à bandeau blanc, chemise de lin, gilet de cuir et épée (modèle 3D du guerrier), modèle GLB du ravageur fourni avec capuche rouge et hache fournie (ravageur). Les modèles 3D combinent cette silhouette avec le matériau de l'outil et l'armure portés ; les portraits et la vue 2D montrent aussi les équipements. Les habitants disponibles et les pêcheurs restent visibles, sans doublonner les unités militaires. Le magasin de l’Artisanat affiche l’équipement collectif du village ; les objets déjà actifs dans ce village sont encadrés en jaune.

Les habitants **sans métier** utilisent le modèle fourni
(`medieval warrior 3d model.glb`), allégé à **15 999 triangles** et trois
textures de **1024 × 1024** pour un GLB d’environ **1,68 Mo**. La pose initiale
à bras tendus est ramenée à une pose de repos. Le même personnage est rendu
dans les portraits et la vue 2D. Le choix du modèle dépend du métier réel,
y compris pendant une tâche économique ou une mission militaire ; attribuer
un métier restaure l’apparence de cette spécialité. Les équipements achetés,
la sélection, les transports et les effets de combat restent visibles.
Le fichier source ne contient pas de squelette ni de clips ; le rendu ajoute désormais un squelette de marche léger à deux jambes, sans modifier le GLB fourni. La tenue du modèle ne donne aucun bonus
supplémentaire aux statistiques.

Le Guerrier 3D utilise le modèle GLB **final** fourni par le concepteur
(`medieval swordsman 3d model.glb`), allégé à **36 000 triangles** et muni
d’un squelette dans Blender. Les textures originales sont conservées.
Son squelette anime le corps et l’épée tenue en main. Chaque
frappe effective alterne entre un **coup droit** et un **revers** ; ces deux
animations sont purement visuelles et suivent le signal de frappe du moteur.
Le personnage possède aussi une pose de garde, une marche pour son déplacement
et une animation de mort jouée une seule fois, jusqu’à sa pose finale au sol.
La pause fige ces animations. La couleur d’équipe, l’équipement, les transports,
les impacts et la mort restent représentés. Le fichier GLB est partagé entre
les instances, avec un squelette et des matériaux propres à chaque guerrier.

Le village et ses bâtiments construits sont visibles directement sur leur région, au bord extérieur du terrain près du village propriétaire. Le village apparaît dès le début de la partie. Bergerie, Artisanat et Boucherie apparaissent immédiatement après leur construction. Chaque famille possède une apparence propre pour T1, T2 et T3 ; son sprite est remplacé dès que le niveau change. Ces éléments visuels ne créent pas de nouveaux slots et ne modifient pas leurs règles de ciblage.

Les fumées des structures attaquées et la brume décorative du plateau sont retirées. Le signal de dégâts reste représenté par la mise en évidence du village ; les deux camps sont désormais visibles en permanence, sans brouillard de guerre (section 78).

TEMP_BALANCE_VALUE visuelle : en 3D, une unité bascule légèrement vers l'avant lorsqu'elle porte un coup (le Guerrier joue ses attaques à l'épée) et clignote une fois en rouge lorsqu'elle reçoit l'impact appliqué chaque seconde. À sa mort, sa figurine reste brièvement visible, prend une teinte rouge à **70 %**, tombe sur le côté, puis sa figurine disparaît. Le Guerrier effectue cette chute avec son squelette ; les autres figurines gardent la bascule du modèle entier. Les durées, le nombre de particules et les angles sont centralisés dans `config.js`. Ces animations n'affectent ni les dégâts, ni le moment où l'unité est retirée de la simulation.

### Village entouré de remparts et modèles T1/T2/T3 fournis

Les cinq GLB du concepteur remplacent les apparences T1 de la Bergerie, de l’Artisanat, de la Boucherie et de l’Hôtel du village ; le Feu de camp apparaît dès le début dans chaque village. Les commerces ne sont présents qu’après leur achat, toujours limités à un de chaque par village. Les modèles sont redimensionnés uniformément, avec des versions allégées et des textures au maximum 1024 px. Leurs rendus servent aussi au tableau Bâtiments et à la vue 2D. Les cinq modèles **T2** fournis remplacent également les apparences de la Bergerie, de l’Artisanat, de la Boucherie, de l’Hôtel et du Feu de camp dès leur amélioration propre. Le niveau des commerces reste indépendant du niveau du village : améliorer le feu change seulement le feu, l’hôtel et les remparts. Les illustrations du tableau, de la carte du feu et de la vue 2D suivent aussi le niveau. La Boucherie T2 utilise désormais le fichier dédié `boucherie T2 3d.glb`, qui remplace le visuel provisoire issu de `artisans T2 3d.glb`. L’Artisanat T2 conserve `artisanat T2 3d.glb`. Les cinq modèles **T3** fournis remplacent aussi la Bergerie, l’Artisanat, la Boucherie, l’Hôtel et le Feu de camp au dernier niveau ; les illustrations et la vue 2D suivent ce même niveau. Le T3 ne réutilise plus le feu T2 ni les formes simples de bâtiments. Les coûts, bonus et PV restent ceux des règles existantes.

Chaque village possède une cour clôturée, avec porte côté champ de bataille : palissade en bois au T1, remparts de pierre au T2, remparts clairs crénelés au T3. Tous les habitants **sans tâche**, quel que soit leur métier, sont représentés en cercle autour du feu à l’intérieur de cette cour et tournés vers lui. Une tâche les fait quitter le groupe ; un rappel terminé les y ramène. La foule s’adapte au nombre d’habitants. Les remparts avant sont rapprochés des bâtiments : l’enceinte passe de 2,02 à 1,64 unité de profondeur visuelle (environ 19 % de moins), ce qui libère une bande supplémentaire devant le village. Le feu et le cercle des habitants sont légèrement reculés et resserrés pour rester dans la cour ; les bâtiments gardent leur place et leur taille. Ce placement s’applique aux trois niveaux et aux deux camps, avec une adaptation équivalente en 2D. Les cultures et élevages sont disposés devant la clôture, sans nouveau slot ni changement de compatibilité ; les rochers et buissons décoratifs sont dégagés de la cour.

Les remparts sont **la cible visuelle du village** : les assaillants et les flèches atteignent sa porte. Ils n’ajoutent ni PV, ni collision, ni étape de siège, ni nouvelle condition de victoire. Les PV courants et maximum, bonus de bâtiments, dégâts, riposte et conditions de victoire restent ceux du village existant. À sa destruction, la façade/porte s’effondre visuellement, le feu s’éteint et les habitants locaux ne sont plus affichés. Les déplacements logiques et les distances de combat restent identiques ; seul le repère visuel aux extrémités de la colonne se termine devant la porte. Le milieu de colonne et l’eau conservent leur repère.

Les sources Blender modifiables, le script reproductible `eredita3D/scripts/prepare_village_t1.py` et les empreintes des GLB originaux sont conservés dans `eredita3D`. Les cinq fichiers originaux restent inchangés. Les remparts sont modélisés localement en suivant la référence du concepteur, sans génération payante Tripo.

Le plateau principal possède désormais un rendu **Three.js 3D** qui représente les régions du format choisi, leurs biomes, villages, bâtiments T1/T2/T3, cultures, élevages, habitants et unités. Les chasseurs itinérants restent visibles dans les deux rendus. La caméra peut tourner et zoomer ; la sélection directe du village, des parcelles, des bâtiments et des personnages complète la barre de navigation dans les vues 2D et 3D. La simulation, l'économie, le combat et le multijoueur restent indépendants du rendu : l'état JavaScript actuel demeure la source de vérité. Une vue 2D reste accessible comme solution de repli et pour l'accessibilité. Cette séparation doit permettre d'ajouter WebXR/AR ultérieurement sans réécrire les règles du jeu.

La **Plaine 3D V1** utilise `assets/models/plaine.glb` : prairie corse à faible relief, sentier de terre, granite et maquis bas. Le modèle Blender et son script de génération sont conservés dans `eredita3D`. Il constitue uniquement le fond du terrain : les quatre slots libres, les villages, les productions et les effets mythologiques restent des éléments dynamiques du jeu. Le passage central et les emplacements de construction restent dégagés. Le format Simplifié élargit le sol et écarte les décors sans étirer les rochers ni la végétation. Les décors statiques sont fusionnés en trois lots de rendu par région, avec deux matériaux opaques et des textures 1024 px partagées. Le terrain simple précédent reste disponible pendant le chargement ou si le GLB ne peut pas être chargé. Cette V1 vise WebXR/Quest 3 ; les performances sur casque physique restent à mesurer. La version web utilise également des rendus du même modèle pour le fond de la vue 2D (`terrain-plaine-v1.webp`) et la carte de choix des biomes (`terrain-plaine-card-v1.webp`). Les quatre emplacements, cultures et bâtiments restent superposés dynamiquement. La commande `npm run assets:plaine` régénère ces deux images sans toucher aux autres terrains.

La **Montagne 3D V1** utilise `assets/models/montagne.glb` : crêtes de granite, éboulis, pins et genévriers disposés autour d’une vallée centrale dégagée. La tuile conserve les quatre slots dynamiques de la Montagne : deux libres et deux réservés aux animaux. Villages, productions, troupeaux et rivière éventuelle restent gérés par le jeu ; le relief ne crée aucun obstacle logique. Le chargement commun `js/terrain-model.js` fusionne les volumes en quatre lots par région, partage géométrie et textures et conserve des matériaux propres à chaque région. Les roches restent visibles après un incendie, tandis que la végétation est masquée. Le format Simplifié écarte les décors sans les étirer. Le choix des biomes et la vue 2D utilisent des rendus WebP du même modèle, régénérables avec `npm run assets:montagne`. Les performances sur Quest 3 physique restent à mesurer.

Le **Littoral 3D V1** utilise deux modèles indépendants, `assets/models/littoral_rouge.glb` et `assets/models/littoral_bleu.glb`, avec une plage, du granite côtier, du maquis et une mer turquoise. La mer reste toujours orientée vers le centre du plateau ; le village et les deux slots libres restent sur la terre. Les deux variantes possèdent des tracés de rivage et des décors distincts, également utilisés dans leurs illustrations WebP de sélection et de vue 2D. Les barques, voiliers et filets sont ajoutés dynamiquement par le rendu existant. Les règles maritimes et zones logiques d’eau sont conservées. Chaque région utilise cinq lots de rendu partagés, avec des matériaux opaques ; la mer et son écume sont des éléments 3D statiques. Un incendie conserve la couleur de l’eau tout en masquant la végétation. Les sources Blender et les aperçus sont dans `eredita3D` ; `npm run assets:littoral` régénère les visuels web des deux camps. Les performances sur Quest 3 physique restent à mesurer.

Le **Champ de blé 3D V2** possède trois modèles liés au niveau de chaque culture : **N1 → 3 rangées / 15 pieds**, **N2 → 5 rangées / 35 pieds**, **N3 → 7 rangées / 63 pieds**. La hauteur, la densité et la teinte dorée augmentent à chaque tier. Le choix est centralisé dans `Config.cropModels.ble.variants` et dépend uniquement du niveau du slot concerné. Les améliorations de 150 puis 300 or mettent immédiatement à jour le modèle 3D et le sprite 2D, avec les rendements ×2 puis ×3 existants. Planter, retirer ou remplacer un voisin ne change aucun autre champ ; une nouvelle plantation repart au N1. Les trois modèles gardent la même emprise, les 200 PV et les mêmes biomes autorisés (Plaine / Littoral). Il s’agit de blé mûr statique, sans cycle de croissance ajouté. Les GLB `assets/models/ble_{petit,moyen,grand}.glb` utilisent deux lots opaques partagés, sans textures : 1 788, 4 080 et 7 284 triangles. La vue 2D suit le niveau du champ et le bouton de plantation présente toujours le N1. Le visuel simple reste disponible pendant le chargement ou en cas d’échec du GLB. Sources Blender, aperçus et mesures sont dans `eredita3D` ; `npm run assets:ble` régénère les trois modèles et leurs sprites transparents.

Les **Châtaigneraies 3D V1** disposent de trois compositions associées au niveau de chaque culture : **N1 → petit modèle** (un jeune arbre), **N2 → moyen** (deux arbres), **N3 → grand** (trois arbres). Le choix est centralisé dans `Config.cropModels.chataignier.variants` et dépend du niveau de la culture dans le slot concerné, indépendamment du nombre de plantations dans le village. Les améliorations de 150 puis 300 or mettent à jour le modèle 3D et le sprite 2D du même slot, en même temps que le rendement ×2 puis ×3 défini au chapitre 14. Planter ou retirer une autre châtaigneraie ne change aucun niveau ni modèle voisin. Après vente puis nouvelle plantation, la culture repart au N1 et affiche le petit modèle. Le N3 est également accessible en Montagne, même avec un seul slot occupé. Les emprises, les 200 PV, les règles de biome et les autres cultures conservent leurs règles existantes. Les GLB `assets/models/chataignier_{petit,moyen,grand}.glb` utilisent chacun deux matériaux opaques, sans textures, et respectivement 3 484, 5 512 et 7 540 triangles. Le bouton de plantation présente le modèle N1. Les sources et aperçus sont dans `eredita3D` ; `npm run assets:chataigniers` les régénère. Les performances sur Quest 3 physique restent à mesurer.

L’**Élevage de chèvres 3D V1** utilise trois enclos rustiques avec clôture, mangeoire et abreuvoir, complétés par un abri dans les variantes moyenne et grande. Les seuils visuels provisoires de `Config.livestockModels.chevre` choisissent un petit enclos pour 1–2 chèvres, un moyen pour 3–5, un grand dès 6. Le rendu reproduit exactement l’effectif jusqu’à six chèvres visibles, puis conserve cette limite pour maîtriser le coût graphique ; les compteurs gardent toujours l’effectif réel. Le nombre dépend de chaque slot. Les naissances, achats et abattages mettent à jour les chèvres et la variante ; le dernier animal retiré libère le slot et supprime l’enclos. Les modèles `assets/models/elevage_chevre_{petit,moyen,grand}.glb` fournissent un enclos et un prototype animal réutilisable : deux lots opaques par élevage, avec géométrie partagée, sans texture ni animation, pour 7 128 triangles au maximum. Les sprites 2D proviennent des mêmes modèles. Le placement, le lait, la reproduction et les règles d’abattage existantes sont conservés. Les sources, aperçus et mesures sont dans `eredita3D` ; `npm run assets:chevres` les régénère. Les performances sur Quest 3 physique restent à mesurer.

L’**Élevage de cochons 3D V1** reprend le système visuel des chèvres : petit enclos pour 1–2 cochons, moyen pour 3–5, grand dès 6, selon l’effectif du slot. Les seuils et positions sont centralisés dans `Config.livestockModels.cochon`. Les modèles `assets/models/elevage_cochon_{petit,moyen,grand}.glb` comportent une clôture, une auge, un abreuvoir et un bourbier, avec un abri dans les variantes moyenne et grande. Le chargeur commun reproduit l’effectif jusqu’à six cochons visibles, puis conserve cette limite ; les compteurs restent exacts. Naissances, achats et abattages actualisent l’enclos ; retirer le dernier animal libère le slot. Les sprites 2D proviennent des mêmes modèles. Deux lots opaques avec géométrie partagée sont utilisés par enclos, pour 6 936 triangles au maximum, sans texture ni animation. Les règles de placement, reproduction, achat et abattage existantes sont conservées. Sources, aperçus et mesures sont dans `eredita3D` ; `npm run assets:cochons` les régénère. Les performances sur Quest 3 physique restent à mesurer.

L’**Élevage de vaches 3D V1** complète le système commun aux chèvres et cochons : petit enclos pour 1–2 vaches, moyen pour 3–5, grand dès 6, selon l’effectif du slot. Les seuils visuels et positions sont centralisés dans `Config.livestockModels.vache`. Les modèles `assets/models/elevage_vache_{petit,moyen,grand}.glb` comportent des clôtures, un abreuvoir et un râtelier à foin, ainsi qu’un abri et un seau de traite dans les variantes moyenne et grande. Les vaches sont composées dynamiquement jusqu’à six animaux visibles, avec un compteur toujours exact au-delà. Les naissances, achats et abattages actualisent l’enclos ; le dernier animal retiré libère le slot. Les sprites 2D proviennent des mêmes modèles. Chaque enclos utilise deux lots opaques avec géométrie partagée, pour 10 012 triangles au maximum, sans texture ni animation. La reproduction, les 30 PV par vache, les trajets de traite, les achats et les règles d’abattage existants sont conservés. Sources, aperçus et mesures sont dans `eredita3D` ; `npm run assets:vaches` les régénère. Les performances sur Quest 3 physique restent à mesurer.

Le **Vignoble 3D V1** dispose de trois modèles `assets/models/vignoble_{petit,moyen,grand}.glb` : une rangée au N1, deux au N2 et trois au N3, avec ceps, palissage en bois, feuilles lobées et grappes de raisin en volume. La variante de chaque slot suit uniquement le niveau de sa culture dans `Config.cropModels.vignoble.variants`. Le placement et les améliorations utilisent les prix et rendements du chapitre 14 : 75 or pour planter, puis 150 et 300 or supplémentaires pour les rendements ×2 et ×3. La Montagne et le Littoral conservent leurs slots libres compatibles ; la Plaine et les slots réservés aux animaux restent interdits aux vignes. La vente pendant la préparation et la replantation mettent à jour le modèle ; aucun niveau voisin ne change. Les sprites 2D et le bouton de plantation proviennent des mêmes modèles. Chaque parcelle utilise deux lots opaques avec géométrie partagée, sans textures, pour 3 096, 5 368 ou 7 640 triangles. Les sources, aperçus et mesures sont dans `eredita3D` ; `npm run assets:vignes` les régénère. Cette V1 est statique. Les performances sur Quest 3 physique restent à mesurer.

**L’Orcu 3D** utilise le modèle fourni par le concepteur (`orc barbarian 3d model.glb`), préparé dans `eredita3D` et exporté en `assets/models/orcu.glb`. Le modèle conserve ses 10 501 triangles et sa texture d’origine, réduite à 2048 px pour le plateau. Son squelette permet cinq animations simples ajoutées pour le jeu : repos, marche lente, frappes droite/gauche et mort. Le chargement est propre à `l-orcu` ; les autres légendes et le guerrier gardent leurs modèles. Les invocations partagent géométrie et texture, avec un squelette et des matériaux par instance, un repère d’équipe et les effets de dégâts existants. La pause fige les animations. Les événements visuels de mort conservent l’identité et l’échelle mythologiques, y compris lors d’une réception tardive par un client. Les règles de L’Orcu restent celles du chapitre des renforts : 200 PV, 30 dégâts et déplacement extrêmement lent. Le personnage simple reste disponible pendant le chargement ou si le GLB manque. Les aperçus et mesures sont dans `eredita3D` ; `npm run test:orcu` contrôle l’intégration. Les performances sur Quest 3 physique restent à mesurer.

**Chasseur 3D** : `assets/models/chasseur.glb` reprend le personnage fourni, son carquois et ses textures. L’arc en noyer, sa poignée en cuir, ses bagues, sa corde et la flèche encochée sont modélisés avec le personnage. Le squelette contient `Repos`, `Marche`, `Tir` et `Mort`. `Tir` lève l’arc, tend la corde et décoche ; une flèche visuelle rejoint la position de la cible enregistrée au tir. La pause fige le personnage et ce projectile. Les tirs utilisent les événements du moteur, y compris après synchronisation réseau ; la portée de 15 est définie au chapitre 35 et dans `Config.combat.professionAttackRanges`. Le portrait 2D provient du même modèle. Les équipements, transports, repères d’équipe et effets d’impact restent disponibles. Le modèle compte 10 992 triangles et des textures 1 024 pixels. `npm run test:hunter` vérifie le combat et le rendu.

**Barque 3D** : `assets/models/barque.glb` reprend le fichier `barque 3d.glb` fourni par le concepteur, avec sa coque, ses bancs et sa texture de bois. Le modèle est normalisé à 0,58 unité de long, orienté selon le déplacement, et allégé à 5 000 triangles avec une texture de 1 024 pixels. Il remplace la barque simple dans la réserve du Littoral et pendant les traversées des personnages et animaux utilisant une barque. Son sprite sert également aux barques de la vue 2D. Le voilier conserve son rendu. Géométrie et texture sont partagées, les matériaux restent indépendants pour les impacts. Le rendu simple sert pendant le chargement et en cas d’échec ; les figurines déjà affichées sont actualisées lorsque le modèle est prêt. Les prix, capacités, vitesses et règles d’embarquement sont inchangés. `npm run test:rowboat` vérifie l’intégration ; le script et le fichier Blender éditable sont dans `eredita3D`.

**Ravageur 3D** : `assets/models/ravageur.glb` réunit les fichiers fournis `ravageur 3d.glb` et `hache 3D.glb`. Le personnage conserve son squelette, ses vêtements et sa texture. La hache est un mesh indépendant rigidement attaché à un os enfant de la main droite. Les clips `Repos`, `Marche`, `Coup_Hache` et `Mort` accompagnent les états existants du personnage ; le coup de hache est uniquement visuel et ne crée aucun dégât supplémentaire. Le portrait 2D provient du même modèle équipé. Le modèle comporte 11 599 triangles (9 399 pour le personnage, 2 200 pour la hache), des textures de 1 024 pixels et 81 joints exportés. Géométrie et textures sont partagées, avec matériaux et squelettes indépendants par instance. Les armures, matériaux d’outils, transports, sélections et impacts restent visibles. Seul le métier Ravageur utilise cet asset ; les légendes conservent leur rendu. Les caractéristiques et règles du Ravageur sont inchangées. `npm run test:ravager` vérifie l’intégration ; le fichier Blender et le script sont dans `eredita3D`.

**Berger 3D** : `assets/models/berger.glb` reprend `berger 3d.glb` fourni par le concepteur, avec ses vêtements, son béret et sa cape de fourrure. Le squelette d’origine de 80 os est conservé. Les clips `Repos`, `Marche`, `Traite`, `Frappe` et `Mort` sont ajoutés dans Blender. Pendant la phase `harvesting` d’une tâche Élevage, il fléchit les jambes, se penche et effectue le geste de traite ; il marche pendant les trajets et reprend le repos aux arrêts. Les pieds restent plantés pendant la traite. Le métier, et non la tâche, détermine cette apparence. Le modèle conserve ses 10 897 triangles et ses textures réduites à 1 024 pixels ; son portrait 2D est rendu depuis ce modèle. Les instances partagent géométrie et textures, avec leurs propres squelettes et matériaux. Équipements, âne, embarcations, repères d’équipe, sélection, impacts, pause et retour au village restent compatibles. Les statistiques, vitesses et rendements restent inchangés. Les sources Blender, le script de préparation et les aperçus sont dans `eredita3D` ; `npm run test:shepherd` vérifie l’intégration.

**Agriculteur 3D** : `assets/models/agriculteur.glb` reprend le fermier fourni par le concepteur, avec ses vêtements et textures. Son squelette de 20 os contient `Repos`, `Marche`, `Recolte`, `Frappe` et `Mort`. Pendant la phase économique `harvesting` d’une tâche Agriculture, il s’accroupit, incline le buste et récolte de la main droite ; il marche pendant les trajets et revient au repos lors des pauses. L’apparence reste liée au métier Agriculteur : affecter un sans métier à l’agriculture ne change pas son modèle. La pause fige les animations. Le modèle comporte 18 000 triangles et des textures 1 024 pixels ; géométrie et textures sont partagées, les squelettes et matériaux sont indépendants. Le portrait 2D provient du même modèle. Les cadences, rendements et dépôts restent ceux du moteur économique. `npm run test:farmer` vérifie l’intégration ; les sources Blender et le script de préparation sont dans `eredita3D`.

**U Fullettu 3D** : le personnage et la lanterne fournis sont réunis dans `assets/models/fullettu.glb`. La lanterne reste un mesh indépendant attaché à l’os de la main gauche. Le déplacement utilise de petits bonds ; le geste de récolte tend la main droite vers l’avant puis la passe derrière le dos. Cette animation suit le cycle existant du vol à l’arrivée au village adverse : elle ne crée ni dégâts aux cultures ni transport de ressources et conserve le transfert direct entre banques décrit au chapitre 73. Le GLB contient les clips `Repos`, `Bonds`, `Recolte` et `Mort`, 12 866 triangles et deux matériaux avec textures 2 048/1 024 pixels. Les cinq follets partagent géométrie et textures, mais chaque instance garde son squelette, sa pose et ses matériaux. La pause fige les animations, le personnage simple assure le chargement de secours. Les scripts, fichiers Blender et aperçus sont dans `eredita3D` ; `npm run test:fullettu` vérifie l’intégration. Les performances sur Quest 3 physique restent à mesurer.

**U Lupu Mannaru 3D** : le modèle fourni est utilisé dans `assets/models/lupu_mannaru.glb`, avec un squelette de 22 os créé localement. Le repos est accroupi ; le déplacement utilise les quatre membres, y compris lors d’une redirection latérale. Lors d’une attaque de structure, il se redresse et donne deux coups de griffes diagonaux de haut en bas, en croix. Les clips sont `Repos`, `Quatre_Pattes`, `Griffes_Croisees` et `Mort`. Le GLB conserve les 10 406 triangles et la texture originale réduite à 2 048 pixels. Les deux griffures constituent le geste visuel d’une seule attaque du moteur ; elles n’ajoutent aucun impact. La transformation, les 60 PV, les 20 dégâts et les propriétés du Ravageur restent inchangés. Les déformations des épaules et poignets de ce premier rig peuvent être affinées par peinture des poids. `npm run test:lupu` vérifie le rendu et les règles existantes.

**U Surpatore 3D** : seule sa seconde forme, le vampire, utilise le nouveau fichier `u surpatore 3d.glb` fourni par le concepteur, préparé dans `assets/models/surpatore_vampire.glb`. Le sanglier initial est conservé et ce modèle apparaît dès sa mort. Le squelette fourni est conservé, avec ses os de torsion et ses doigts ; un os de mâchoire ajouté ferme la bouche au repos et l’ouvre pendant le coup de griffe. Les clips sont `Repos`, `Marche`, `Griffe` et `Mort`. Le GLB contient 8 156 triangles, une texture de 2 048 pixels et 81 joints exportés. Le vampire conserve **40 PV et 11 dégâts**, ainsi que sa vitesse existante. La mort du sanglier possède sa figurine distincte afin de ne pas retirer le vampire qui vient d’apparaître. Les événements de mort conservent aussi la forme mythologique pour les clients recevant l’événement tardivement. `npm run test:surpatore` vérifie la provenance du modèle chargé, la transformation, la mâchoire, la marche, l’attaque, la pause et le nettoyage. Les animations sont réalisées dans Blender par script, sans simulation du manteau ; les performances sur Quest 3 physique restent à mesurer.

---

# 80. TEMPS RÉEL

Le jeu ne fonctionne PAS par tours.

Tous les systèmes doivent pouvoir fonctionner simultanément :

* déplacement ;
* combat ;
* production ;
* reproduction ;
* génération des habitants ;
* pêche ;
* effets temporaires ;
* cartes ;
* timers ;
* Overtime.

Le moteur JavaScript doit donc posséder une vraie boucle de jeu.

---

# 81. ARCHITECTURE TECHNIQUE CONSEILLÉE

Structure possible :

```text
Eredita/
│
├── index.html
├── GAME_DESIGN.md
├── AGENTS.md
│
├── css/
│   └── style.css
│
├── js/
│   ├── config.js
│   ├── mythology-data.js
│   ├── mythology-effects.js
│   ├── mythology-match.js
│   ├── mythology-session.js
│   ├── mythology-ui.js
│   ├── game.js
│   ├── board.js
│   ├── economy.js
│   ├── combat.js
│   ├── buildings.js
│   ├── units.js
│   ├── biomes.js
│   └── ui.js
│
└── assets/
    ├── biomes/
    ├── mythology/
    ├── buildings/
    ├── animals/
    ├── units/
    └── ui/
```

Cette structure pourra évoluer.

---

# 82. CONFIGURATION CENTRALE

Toutes les valeurs susceptibles d'être équilibrées doivent être centralisées.

Exemple :

```js
const GAME_CONFIG = {

    normalDuration: 750,

    overtime: {
        damagePercent: null,
        interval: null
    },

    reinforcements: {
        intervalSeconds: 120,
        pendingPolicy: 'fifo'
    },

    village: {
        T1: {
            hp: 200,
            population: 15
        },

        T2: {
            hp: 400,
            population: 25
        },

        T3: {
            hp: 600,
            population: 35
        }
    },

    building: {
        T1: {
            hp: 75,
            gold: 200
        },

        T2: {
            hp: 150,
            gold: 200,
            resource: 100
        },

        T3: {
            hp: 225,
            gold: 300,
            resource: 150
        }
    },

    movement: {
        columnLength: 100,
        inhabitantSpeed: 5
    }
};
```

Ces valeurs ne doivent pas être codées en dur à 15 endroits différents.

---

# 83. PRIORITÉ DE DÉVELOPPEMENT

Le jeu doit être développé progressivement.

## ÉTAPE 1 — Plateau

Créer :

* les deux joueurs ;
* 4 régions chacun ;
* villages ;
* biomes ;
* génération aléatoire ;
* échange de jusqu'à 2 biomes ;
* slots.

## ÉTAPE 2 — Économie

Créer :

* habitants ;
* banques locales ;
* or global ;
* production ;
* vente ;
* population maximale ;
* génération automatique.

## ÉTAPE 3 — Villages

Créer :

* niveaux T1/T2/T3 ;
* 3 slots de bâtiments ;
* construction ;
* amélioration ;
* PV.

## ÉTAPE 4 — Renforts mythologiques

Réutiliser le catalogue, le cristal et ses choix ; ajouter la file FIFO privée
à 0/2/4 minutes puis l’activation manuelle unique des renforts obtenus.

## ÉTAPE 5 — Combat

Créer :

* unités physiques ;
* mouvement ;
* détection ;
* attaque ;
* mort ;
* attaque des villages.

## ÉTAPE 6 — Destruction des villages

Créer :

* village détruit ;
* modification de génération de population ;
* redirection des troupes ;
* condition de victoire.

## ÉTAPE 7 — Agriculture et élevage

Créer :

* slots ;
* cultures ;
* animaux ;
* reproduction ;
* production ;
* bonus de biome.

## ÉTAPE 8 — Bateaux et Littoral

Créer :

* eau ;
* Barques ;
* Voiliers ;
* capacité ;
* traversée.

## ÉTAPE 9 — Équipements

Les équipements sont accessibles directement dans la boutique existante.
Les anciens aménagements accessibles uniquement par cartes sont retirés du prototype.

## ÉTAPE 10 — Pouvoirs mythologiques

Les dix-sept pouvoirs sont définis dans le catalogue central. Les propositions
s’accumulent en FIFO dès le début, puis toutes les deux minutes de combat.
La sélection et l’activation manuelle unique suivent les sections 60 à 73.

## ÉTAPE 11 — Overtime

Créer :

* passage automatique à 12:30 ;
* perte progressive de PV ;
* victoire ;
* égalité.

---

# 84. RÈGLES IMPORTANTES POUR LE CODE

Le projet doit rester relativement simple à développer.

Éviter de créer des systèmes inutilement complexes.

Privilégier :

* données configurables ;
* fonctions réutilisables ;
* composants génériques ;
* templates visuels ;
* systèmes modulaires.

Ne PAS créer manuellement une version différente de la map pour chaque combinaison.

Ne PAS coder chaque unité comme un système complètement indépendant.

Utiliser des modèles génériques.

Exemple :

```text
Unit
├── Habitant
├── Guerrier
├── Chasseur
├── Berger
└── etc.
```

Même principe pour :

```text
Building
Animal
Crop
Card
Biome
Village
```

---

# 85. CE QUI EST VALIDÉ

Les éléments suivants doivent être considérés comme des règles actuelles :

* jeu 1v1 ;
* temps réel ;
* 4 villages par joueur en Classique, 2 en Simplifié ;
* 4 régions par joueur en Classique, 2 en Simplifié ;
* Montagne/Plaine/Littoral ;
* Classique : au moins un biome de chaque par joueur au premier tirage ;
* Simplifié : trois types présents sur les quatre régions initiales, sans doublon chez un joueur ;
* possibilité d’échanger jusqu’à 2 biomes en Classique, 1 en Simplifié ;
* après échange, doublons totalement autorisés ;
* Plaine = 4 slots libres ;
* Montagne = 4 slots dont 2 réservés aux animaux ;
* Littoral = 2 slots ;
* eau du Littoral tournée vers l'adversaire ;
* ressources locales par village ;
* or global ;
* T1 village = 200 PV / 15 habitants ;
* T2 = 400 PV / 25 habitants ;
* T3 = 600 PV / 35 habitants ;
* 3 bâtiments maximum par village, un seul de chaque type ;
* bâtiments = 75/150/225 PV ;
* T1 bâtiment = 200 or ;
* T2 = 100 ressources + 200 or ;
* T3 = 150 ressources + 300 or ;
* génération population 45/35/25/15 secondes ;
* aucun deck, main ni pioche ;
* propositions privées de deux légendes, une au départ puis toutes les 120 secondes de combat ;
* file FIFO sans remplacement, sélection par clic sur le cristal ;
* renfort obtenu activable une seule fois depuis LÉGENDES ;
* préparation des villages = 60 secondes après le choix des biomes ;
* durée normale de combat = 12:30, après cette préparation ;
* ensuite Overtime ;
* combat automatique en temps réel ;
* Habitant = 20 secondes pour une colonne ;
* Chasseur = 50 % plus rapide ;
* redirection militaire après destruction d'un village ;
* victoire après destruction de tous les villages adverses (4 ou 2 selon le format).

---

# 86. ÉLÉMENTS ENCORE À DÉFINIR

NE PAS considérer les points suivants comme définitivement décidés.

Ils devront être demandés au concepteur lorsque leur implémentation devient nécessaire.

### Économie

* quantité d'or de départ ;
* quantité éventuelle de ressources locales de départ ;
* ressource nécessaire pour améliorer chaque bâtiment ;
* confirmation du fonctionnement exact de l'achat d'Habitants ;
* confirmation de l'existence ou non du bois comme ressource économique.

### Renforts

* équilibrage des vitesses qualitatives des invocations et de la récolte des follets ;
* stratégie d’utilisation des renforts par l’IA ;
* modèles 3D définitifs et projection de l’interface dans WebXR.

### Combat

* portée exacte ;
* vitesse d'attaque de certaines unités ;
* distances de détection ;
* certaines priorités de ciblage ;
* ciblage exact du Ravageur.

### Production

* fréquence du Chasseur ;
* production du Châtaignier ;
* signification exacte du +20 du Blé ;
* signification exacte du +20 du Vignoble.

### Bâtiments

* ressource T2/T3 de chaque bâtiment ;
* signification exacte des réductions -10/-20/-30 de la Bergerie.

### Animaux

* règle exacte de réduction de reproduction des Vaches ;
* fréquence d'attaque du Chien.

### Transport

* vitesse Barque ;
* vitesse Voilier.

### Mythologiques

* validation de la file d'attente de résurrection lorsque le village d'accueil est plein ou brûlé.

### Overtime

* pourcentage de dégâts ;
* fréquence des dégâts ;
* détails définitifs de l'égalité.

---

# 87. CONSIGNE AUX IA QUI TRAVAILLENT SUR LE PROJET

Si tu es une IA chargée de développer ce projet :

**NE MODIFIE PAS LES RÈGLES DU GAME DESIGN SANS AUTORISATION.**

Si une mécanique semble étrange, cela ne signifie pas qu'elle est incorrecte.

Exemple :

Agriculteur → Bergerie

est actuellement volontaire.

Ne le remplace pas automatiquement par une autre association.

Si deux règles semblent contradictoires :

1. signaler la contradiction ;
2. demander laquelle est correcte ;
3. ne pas choisir arbitrairement.

Si une valeur manque :

utiliser une constante clairement marquée :

```text
TBD
```

ou demander confirmation.

Pour une valeur temporaire nécessaire au fonctionnement du prototype, elle doit être clairement indiquée comme :

```text
TEMP_BALANCE_VALUE
```

afin de ne pas la confondre avec une règle officielle.

---

# 88. OBJECTIF DU PREMIER PROTOTYPE

Le premier objectif n'est PAS d'obtenir immédiatement un jeu magnifique.

Le premier objectif est d'obtenir :

**UNE PARTIE JOUABLE DE BOUT EN BOUT.**

Le prototype doit permettre progressivement :

* génération de la map ;
* choix des biomes ;
* villages ;
* habitants ;
* ressources ;
* économie ;
* cartes ;
* placement ;
* combat ;
* destruction ;
* Overtime ;
* victoire.

Les graphismes définitifs seront retravaillés ensuite.

---

# 89. DIRECTION ARTISTIQUE PROVISOIRE

La direction artistique n'est PAS encore définitive.

Les images actuellement réalisées servent principalement :

* à comprendre la disposition ;
* à tester l'interface ;
* à visualiser les slots ;
* à imaginer les templates.

Ne pas considérer les anciens mockups comme des références pixel-perfect.

Certaines images de concept comportent des erreurs de slots ou de biomes.

Les règles écrites dans ce document ont priorité sur ces images.

---

# 90. RÈGLE DE PRIORITÉ

En cas de contradiction entre :

* un ancien mockup ;
* une ancienne image ;
* une ancienne version du code ;
* et ce document ;

la règle écrite la plus récente validée par le concepteur doit être utilisée.

Lorsqu'une nouvelle décision est prise pendant le développement :

**mettre à jour GAME_DESIGN.md.**

Ce document doit évoluer avec le jeu.

---

# 91. PHILOSOPHIE GÉNÉRALE

Eredità doit être :

* stratégique ;
* compréhensible ;
* relativement simple à développer ;
* suffisamment profond pour permettre différentes stratégies ;
* fortement lié au territoire corse ;
* culturellement justifiable ;
* rejouable grâce aux biomes aléatoires ;
* asymétrique selon le développement choisi par le joueur ;
* tendu grâce aux Mythologiques ;
* dynamique grâce au temps réel ;
* capable de produire des parties différentes selon les choix économiques et militaires.

Le joueur doit pouvoir décider de spécialiser ses territoires.

Une Plaine peut devenir très agricole.

Une Montagne peut se spécialiser dans l'élevage.

Un Littoral peut devenir essentiel pour la pêche ou le déplacement maritime.

Mais ces spécialisations doivent venir des choix du joueur et non d'une map entièrement préconstruite.

Le territoire constitue donc une base.

**Le joueur construit progressivement son propre territoire au cours de la partie.**

---

# 92. PRINCIPE FONDAMENTAL À CONSERVER

Le jeu repose sur trois niveaux qui doivent fonctionner ensemble :

```text
TERRITOIRE
    ↓
ÉCONOMIE
    ↓
GUERRE
```

Le territoire détermine les opportunités.

L'économie permet de développer les villages et les unités.

Les décisions économiques influencent ensuite les capacités militaires.

Les renforts mythologiques peuvent bouleverser cet équilibre.

Le but est que la Corse ne soit pas seulement le décor du jeu.

**Le territoire, les productions, les pratiques et les croyances corses doivent participer directement aux règles du jeu.**

---

# 93. TUTORIEL SCÉNARISÉ

Le bouton Tutoriel lance une partie guidée distincte des modes normal, local et réseau. La future cinématique reste prévue mais n'est pas encore produite. Un narrateur temporaire guide le joueur au moyen d'une boîte de dialogue pleine largeur en bas de l'écran. Un clic termine instantanément l'affichage progressif d'une phrase sans valider simultanément le dialogue ; un second clic valide les phrases manuelles. Chaque réplique peut recevoir plus tard un fichier `tutoriel_xxxx.mp3` dans `assets/audio/tutorial/`, sans rendre l'audio obligatoire.

Le tutoriel impose le territoire initial Plaine, Littoral, Montagne, Montagne. L'échange demandé transforme ensuite les régions 2 et 3 pour obtenir Plaine, Plaine, Littoral, Montagne. Le joueur doit réellement utiliser les mécaniques existantes : placer quatre champs de blé en Plaine 1, affecter un habitant à l'agriculture, construire une Bergerie, constater le métier Agriculteur et son étoile automatiquement attribués, repousser une attaque, construire un Artisanat, choisir Guerrier dans le menu Mode de combat et lancer une attaque groupée. Les étapes ne demandent plus de cliquer dans un panneau Métiers séparé. Les actions étrangères à l'étape courante sont verrouillées et l'action attendue est entourée d'une animation jaune.

Le village Rouge de la première région commence avec cinq habitants. La génération automatique des habitants rouges est suspendue jusqu'à la destruction du premier village adverse. Le tutoriel n'a ni limite de temps ni Overtime. Après le premier village adverse détruit, toutes les restrictions sont levées, la génération normale reprend et une IA volontairement facile poursuit son économie ; elle attend environ 60 secondes entre ses attaques et ne lance pas plus de trois offensives supplémentaires.

La première sélection ultérieure d'une Montagne ou d'un Littoral déclenche une unique explication en pause avec mise en évidence des deux biomes. À la fin de ces dialogues, le bouton de vue 3D est mis en évidence et la partie reprend lorsque le joueur l'utilise pour repasser en 3D. La destruction des quatre villages adverses termine proprement le tutoriel et propose un retour au menu. Ces restrictions ne doivent jamais s'appliquer aux autres modes de jeu.

---

# 94. RÉALITÉ MIXTE — INTERFACE JOUABLE QUEST 3

À l’ouverture du menu principal, son logo PNG se révèle directement à sa place
de gauche à droite pendant environ 1,5 seconde, sur le décor du menu, sans
modification des lettres ou proportions. Il n’y a plus d’écran d’introduction
séparé ni d’encres colorées ou de particules avant le logo. Le décor et les
boutons du menu restent accessibles pendant la révélation. Le mouvement réduit
affiche immédiatement le logo statique. Cette animation ne modifie pas l’état
de la partie et reste distincte de la future cinématique du tutoriel décrite en
section 93.

L’onglet Jouer se présente comme une armurerie, sur une illustration dédiée.
Format, Multijoueur et Entraînement occupent trois panneaux de même largeur et
de même hauteur, alignés sur ordinateur et empilés sur mobile. Seuls les libellés
et informations de choix utiles sont affichés. Le format reste 2 camps ou
4 camps par joueur. Ces accès conservent leurs destinations :
choix local/salon pour le multijoueur, préparation contre l’IA pour l’entraînement.
L’écran multijoueur s’affiche au-dessus du décor ; Retour ferme un éventuel
salon en cours et rétablit le choix des modes.

Les boutons actifs du menu principal, de l’armurerie et de l’écran multijoueur
jouent le son d’épée fourni par le concepteur à chaque activation, par souris,
clavier ou tactile. Tous les boutons Retour, y compris le retour au menu, la
boutique et les interfaces VR, jouent uniquement ce son d’épée inversé.
Le texte des menus ne peut pas être sélectionné ; les champs de recherche et
de saisie de code restent éditables et sélectionnables.
Le réglage Son coupe à la fois les musiques et les effets.
Les volumes et la limite de sons simultanés sont centralisés dans `Config.audio`.

L’accueil conserve sa composition ; le drapeau reprend la tête noire avec le
bandeau sur les yeux. Le décor avec sol est réservé au mode panorama et utilise
une image distincte inspirée des remparts de Bonifacio : falaises et mer à
gauche, citadelle à droite. Un autel en pierre sert de
support visuel au plateau : sa dalle reste alignée sur le dessous du socle lors
des déplacements, rotations et redimensionnements. L’autel vide est visible
pendant l’exploration panoramique. Il ne crée pas de bâtiment, n’intercepte pas
les commandes et ne modifie aucune règle de jeu ; le passthrough le masque.

La réalité mixte est une représentation supplémentaire de l'état existant, avec Three.js et une session WebXR **immersive-ar**. Le fond reste transparent pendant le placement ou replacement pour voir la vraie table. Dès le lancement de la préparation, un panorama corse et un sol pavé entourent le plateau, avec une apparition progressive. Les paramètres proposent « Voir ma pièce » et « Afficher le décor corse » pour basculer sans quitter la session. Le décor reste indépendant du plateau et ne change ni les unités logiques ni les règles. Si la texture ne peut pas charger, le fond reste transparent. Le sol utilise le repère `local-floor` lorsque disponible ; sa hauteur de repli est un réglage temporaire de présentation centralisé dans `Config.xr.environment`.

Elle conserve les régions et villages du format choisi, les biomes, les emplacements et les littoraux orientés vers l'adversaire. Le menu HTML et les modes entraînement, local et salons sont conservés. Le mode entraînement ou local peut être choisi directement dans le casque ; le code du salon en ligne se saisit dans Quest Browser. La préparation et la partie peuvent ensuite être pilotées avec les contrôleurs sans revenir à l'interface classique. Les commandes XR appellent les mêmes fonctions métier que le desktop ; les règles et la simulation restent communes. Les interfaces web et casque partagent une palette de noir chaud, bronze et or ; Rouge et Bleu restent distinguables.

Le joueur confirme lui-même le placement sur sa table avec la gâchette de l’un des deux contrôleurs ou A. Une surface détectée n'est pas automatiquement identifiée comme une table. Un aperçu transparent et un repère précèdent le placement ; si le hit-test n'est pas disponible, un plan manuel à hauteur réglable permet le même placement. La largeur initiale est d'environ **80 cm**, configurable. Le côté du joueur Rouge ou Bleu est orienté vers sa position initiale. Le socle et tous les éléments suivent un seul groupe de transformation.

Un mode manipulation explicite, ouvert par les réglages, permet déplacement, rotation, taille et recentrage du plateau. En dehors de ce mode, les préhensions et joysticks ne déplacent pas le plateau. Une préhension déplace le plateau ; deux préhensions permettent rotation et redimensionnement. Sur les profils Touch reconnus, les deux gâchettes index et A ont exactement le même rôle : valider le placement, activer le bouton visé ou sélectionner le village visé ; B revient ou annule une saisie, X masque/affiche la gestion et Y ouvre/ferme la boutique. En partie, le joystick gauche vertical parcourt les habitants du village sélectionné (haut : précédent, bas : suivant), le joystick droit horizontal change de village dans le camp actuellement sélectionné (droite et gauche : village dans la direction physique correspondante sur le plateau, en tenant compte de son orientation Rouge/Bleu et de la rotation choisie). Ces raccourcis fonctionnent aussi dans la boutique. Dans les autres menus, les joysticks servent à la navigation. Les commandes système ne sont pas utilisées.

Les quatre fenêtres de gestion sont Habitants en haut à gauche, Tâches en bas à gauche, Bâtiments en haut à droite et Gestion du village en bas à droite. Bâtiments réunit les trois constructions et leurs améliorations. Gestion du village réunit les stocks locaux, le feu de camp, les habitants et les accès aux parcelles, ventes et boutique. Toutes les fenêtres apparaissent par défaut dans un même plan vertical centré au-dessus du plateau, à hauteur du regard, parallèle au joueur. Elles ne sont ni inclinées vers la table, ni orientées en éventail. Les fenêtres de gestion, menus, fiches de village, ors, chronomètre, paramètres, notifications et panneau de placement/manipulation possèdent tous une poignée supérieure saisissable avec la préhension. Les poses personnalisées restent conservées pendant la session. La saisie d’une fenêtre de réglage neutralise la manipulation du plateau pendant le geste. La main déplace et oriente la fenêtre ; pendant la saisie, le joystick vertical ajuste sa distance et l’horizontal sa taille. B annule la pose en cours. Les clics sont neutralisés pendant la saisie et brièvement après relâchement. Les poses restent stables dans l’espace durant la session, sans suivi permanent de la tête. Les paramètres et X maintenu permettent de récupérer les fenêtres devant soi. Dès le menu « Choisir une partie », pendant le choix des biomes, pendant la minute de préparation et en partie, les paramètres proposent « Agrandir les fenêtres », « Réduire les fenêtres » et « Replacer le plateau » sur un seul écran. L’échelle globale agrandit aussi les espacements pour préserver la disposition ; l’ajustement individuel inclut le menu et les paramètres. Réinitialiser restaure la taille et la disposition initiales. Le replacement demande une nouvelle validation ; B restaure la pose précédente. Ces réglages spatiaux n’altèrent pas la préparation ni le temps de combat, qui continuent selon l’état de pause existant. Le thème reprend les couleurs du site : surfaces sombres, accents dorés et cartes de biome colorées.

Un clic à la gâchette directement sur un village ou sa fiche le sélectionne et affiche les quatre fenêtres de gestion, avec les scores et le chronomètre en haut. Les menus XR donnent accès aux missions individuelles et collectives avec métier automatique, au choix du rôle de combat, aux constructions et améliorations, cultures, élevages, ventes, achats et compagnons, sous réserve des mêmes conditions que sur desktop. Après placement, le menu « Choisir une partie » propose de grands boutons centrés et « Quitter le mode VR ». Le menu propose les boutons « 2 camps » et « 4 camps », avec « 2 camps » sélectionné par défaut. L’entraînement ouvre un seul écran de préparation avec deux ou quatre cartes de biome selon le format, « Retour » en bas à gauche et « Lancer la partie » en bas à droite. Lancer confirme le tirage conservé ou applique les échanges sélectionnés, puis démarre lorsque les deux camps sont prêts. Le local prépare chaque joueur successivement ; l’invité réseau confirme son tirage et attend le lancement de l’hôte. Le bouton d’échange permet aussi de consulter le tirage final avant lancement. Ces actions utilisent les commandes existantes et conservent toutes les restrictions de préparation. Les données se mettent à jour depuis la même simulation ou les mêmes snapshots réseau que le desktop. La position et l'orientation spatiales restent propres à chaque casque ; la largeur choisie par l'hôte est communiquée à l'invité sans modifier les unités logiques du jeu. L'invité peut placer localement son plateau mais ne peut pas le redimensionner ni entrer dans sa manipulation.

Une ancre non persistante est utilisée si disponible. Sans ancre, le plateau reste dans le repère de la session ; un changement d'origine impose un nouveau placement. Aucune restauration spatiale entre sessions n'est promise. Les valeurs de confort et les limites provisoires sont centralisées dans `Config.xr` avec la mention `TEMP_BALANCE_VALUE`.

L’ancien accès XR à la main et aux decks a été retiré avec le système de cartes. Les commandes de village et la boutique restent disponibles. Le nouveau cristal et le stock LÉGENDES sont pour l’instant une interface HTML distincte, non projetée dans WebXR. Les tests matériels existants restent détaillés dans `QUEST3.md`.

---

# 95. ILLUSTRATIONS ET LIMITES DU PROTOTYPE

Les seize renforts disposent d’illustrations individuelles dans
`assets/mythology/`, générées avec l’outil intégré image_gen d’après la planche
du concepteur. À sa demande, le traitement privilégie les silhouettes graphiques,
les palettes limitées et les ombres franches, avec moins de réalisme et de détails.
Les prompts et chemins finaux sont dans `assets/mythology/generation.json`.
Ce sont des interprétations de la référence, pas des extractions de son fichier.
Aucune variante inversée distincte n’est fournie ; seul l’art est retourné en CSS
à droite. La planche contient aussi A Mazzera, absente de la liste des seize :
aucun pouvoir pour A Mazzera n’a été inventé. Le dix-septième renfort, le Lion de Roccapina, a ensuite été ajouté sur demande explicite du concepteur, avec sa vidéo et son modèle fournis.

L’ancien moteur de cartes, son constructeur, la main, la pioche et les
déblocages à 5/10 minutes sont supprimés du dépôt, avec leurs styles, paramètres,
illustrations et tests obsolètes. Les données des villages, les achats, les métiers,
l’économie, les banques, la production et le combat existants sont réutilisés ;
les hooks ajoutent uniquement les effets mythologiques explicitement demandés.

Les effets actifs de rivière, de terrain brûlé, de malédiction et de vision
restent disponibles dans les modules mythologiques et les rendus 2D/3D.
Les anciennes branches de moulin, tour, piège, sentier et charrette, sans moyen
de création depuis le retrait des cartes, sont supprimées. Le bonus d’Artisanat
appartient désormais à `buildings.js` ; ses valeurs et son comportement restent
identiques. L’eau et les embarcations conservent leur système de transport.

Le cristal, le choix et le stock LÉGENDES utilisent une interface HTML pour
souris, clavier et tactile. Ils fonctionnent dans la fenêtre 2D de Quest Browser,
mais ne sont pas encore projetés dans les panneaux WebXR immersifs.
Aucun casque physique n’a été utilisé pour cette intégration.
L’IA reçoit ses propositions mais ne choisit ni n’active encore ses renforts ;
le tutoriel scénarisé reste sans tirage supplémentaire.

Les vérifications et le parcours de test réel sont documentés dans
`MYTHOLOGY.md`. Les modes hors ligne restent compatibles avec le chemin
`/-redita/` sur GitHub Pages ; le multijoueur exige le relais WebSocket existant.


## Correction visuelle — orientation et marche, 12 novembre 2026

Toutes les troupes et tous les travailleurs s’orientent selon leur déplacement réel sur le plateau (aller, retour et diagonales), indépendamment du camp. À l’arrêt, un travailleur conserve la direction de son dernier déplacement ; les unités à l’attaque regardent leur cible. Les clips de marche existants restent utilisés. Les habitants sans métier reçoivent un squelette visuel simple pour faire alterner leurs jambes ; les personnages et animaux procéduraux utilisent une marche légère des membres. Les embarcations s’orientent selon le trajet sans faire marcher leurs occupants. La pause fige les animations. Les réglages visuels sont centralisés dans `characterLocomotion` ; les trajets, vitesses, temps de récolte et règles de combat ne changent pas.


## Lion armé — présentation du 12 novembre 2026

L’épée fournie (`épée lion 3dl.glb`) est intégrée au modèle du Lion, après réduction de 1 957 829 à 6 000 triangles et textures de 1 024 pixels maximum. Elle reste attachée à la paume droite pendant toutes les animations. Deux frappes alternées (préparation, coupe, retour en garde) sont déclenchées par les vrais coups du moteur ; aucun dégât supplémentaire ne vient de la lame. La pause fige le personnage et l’arme. Le contrôle caché de l’importeur est exclu du modèle de jeu pour que les pieds reposent au sol et que sa taille soit correcte. Les originaux du personnage et de l’épée restent intacts ; préparation reproductible dans `eredita3D/scripts/prepare_roccapina.py`. Les règles du Lion restent 145 PV, 25 dégâts par coup et regroupement allié initial.
