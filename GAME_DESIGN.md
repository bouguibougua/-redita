# EREDITÀ — GAME DESIGN DOCUMENT

> Document de référence principal du projet.
>
> Ce fichier décrit les règles actuellement connues du jeu. Toute IA ou tout développeur travaillant sur le projet doit le lire avant de modifier le code.
>
> Certaines valeurs sont encore provisoires et seront équilibrées après les premiers tests. Lorsqu'une information est indiquée comme `TBD`, elle ne doit pas être inventée arbitrairement comme une règle définitive.

---

# 1. PRÉSENTATION DU PROJET

## 1.1 Concept général

Eredità est le nom de travail d'un jeu vidéo de stratégie en temps réel et de cartes inspiré de la Corse, de son territoire, de son patrimoine, de son matrimoine, de ses pratiques, de ses croyances, de ses légendes et de ses traditions.

Le jeu est développé dans le cadre d'un projet universitaire en BUT MMI.

Il s'agit d'un jeu :

* 1 contre 1 ;
* en temps réel ;
* basé sur des cartes ;
* avec gestion de ressources ;
* avec développement de villages ;
* avec agriculture et élevage ;
* avec différentes régions/biomes ;
* avec combat automatique ;
* avec des éléments issus de la culture corse ;
* avec des cartes mythologiques extrêmement puissantes.

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

Le prototype propose un mode local à deux joueurs sur un même écran, un mode solo contre une IA et un mode réseau à deux ordinateurs. En solo, le joueur humain joue Rouge et l'IA joue Bleu ; elle confirme son tirage initial et utilise les mêmes actions et règles que le joueur humain. Le joueur peut consulter les villages bleus sans les commander. En réseau, le créateur du salon joue Rouge et héberge l'état autoritaire de la simulation ; le joueur qui rejoint avec le code du salon joue Bleu. Chaque joueur ne peut modifier que ses propres territoires. Le serveur relaie les commandes du joueur Bleu et les états du créateur afin de conserver une simulation commune.

TEMP_BALANCE_VALUE : la stratégie de l'IA est provisoire. Elle plante une culture compatible, construit un Artisanat, affecte un habitant à l'agriculture, forme des Guerriers, attaque et défend les lignes menacées avec ses habitants disponibles. Sa cadence de décision, ses réserves et ses limites d'unités sont centralisées dans `config.js`. Elle ne dispose d'aucune ressource ou statistique supplémentaire.

Chaque joueur possède :

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

---

# 4. CONDITION DE VICTOIRE

L'objectif principal est de détruire les 4 villages adverses.

Un joueur qui perd ses 4 villages perd la partie.

Une situation où les deux joueurs perdent leur dernier village simultanément peut provoquer une égalité.

---

# 5. DURÉE NORMALE D'UNE PARTIE

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

Au début d'une partie, chaque joueur reçoit 4 biomes.

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

**2 biomes maximum**

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

Toute personne qui entre dans l'eau sans embarcation meurt immédiatement. Le Sanglier constitue l'unique exception : il nage sans consommer de place, à la moitié de sa vitesse terrestre. Le Chien doit utiliser une embarcation. Dans le prototype, l'embarquement est automatique : une unité utilise une place libre de la flotte de son Littoral d'origine pendant toute sa présence dans l'eau, puis libère cette place dès son retour sur terre. Si toutes les places sont occupées, elle se noie. Une flotte ennemie ne transporte pas l'assaillant. Les trajets économiques terrestres, notamment la chasse, restent bornés hors de l'eau. TEMP_BALANCE_VALUE : dans la colonne logique de 100 unités, les zones d'eau occupent actuellement 38–50 côté Rouge et 50–62 côté Bleu afin de correspondre au rendu du rivage.

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

Le joueur peut choisir ce qu'il souhaite mettre dedans selon les restrictions des cartes.

Il peut donc potentiellement spécialiser entièrement une région.

Par exemple, si les règles des cartes l'autorisent, il peut utiliser plusieurs slots pour le même type d'élevage ou de production.

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

Une culture déjà présente dans un slot libre peut être remplacée directement par une autre culture compatible avec le biome. L’ancienne culture disparaît et la nouvelle repart avec ses PV maximum. Dans le prototype sans coût de placement, ce remplacement est immédiat et sans remboursement à calculer. Une culture ne peut pas être remplacée par elle-même, ni écraser un élevage ou un slot réservé aux animaux.

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

**4 villages par joueur.**

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

Les ressources ne sont PLUS partagées entre les quatre villages.

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

Chaque joueur commence une nouvelle partie avec **5 000 or**, partagés entre ses quatre villages.

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

Un Habitant disponible peut recevoir une mission locale parmi :

* Agriculture, Élevage, Pêche, Chasse ;
* Attaque ou Défense, avec présence physique sur le terrain.

**Nouvelle règle : tâches et métiers sont indépendants.** Chaque habitant peut effectuer toutes les tâches sans formation, avec les valeurs de base. Il garde un métier unique lorsqu'il change de tâche. Les bonus de spécialisation ne s'appliquent que dans le domaine correspondant : Agriculteur/agriculture, Berger/élevage, Pêcheur/pêche, Chasseur/chasse, Guerrier/attaque et défense, Ravageur/attaque. Un métier non adapté n'ajoute aucun bonus à cette tâche. Les cultures, troupeaux et l'accès à l'eau restent nécessaires aux tâches correspondantes.

Les conditions de bâtiments servent à débloquer les métiers, pas les tâches de base :

* Agriculteur et Berger nécessitent une Bergerie ;
* Pêcheur et Guerrier nécessitent un Artisanat.
* Chasseur et Ravageur nécessitent une Boucherie.

TEMP_BALANCE_VALUE : les formations sont gratuites et instantanées. Elles peuvent être changées pour un habitant local, mais pas pour une unité déjà engagée au combat. Une tâche économique doit être libérée avant d'en attribuer une autre ; cela ne supprime pas son métier.

TEMP_BALANCE_VALUE : la chasse rapporte 3 viandes toutes les 30 secondes sans spécialité et 5 avec le métier Chasseur. Le Ravageur utilise provisoirement ses +5 dégâts spécialisés contre les villages/bâtiments. Ces choix ne définissent pas le futur ciblage des élevages.

Les missions Agriculture, Élevage et Pêche restent liées au village et à la région d'origine de l'Habitant.

Un Habitant retiré d'une mission économique redevient disponible dans son village.

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

La quantité de base rapportée à chaque aller-retour est de **1 unité par champ vivant de la même culture dans le village d'origine** : 1 champ de blé → 1 blé, 2 champs de blé → 2 blés. Un vignoble ne compte pas pour le blé, et les cultures des autres villages ne sont pas comptées. La quantité transportée est fixée à la fin de la récolte ; ajouter un champ pendant le retour n'augmente pas une cargaison déjà chargée. Les bonus de vitesse de récolte et de déplacement restent applicables.

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

Le rôle Agriculteur nécessite une :

**Bergerie**

dans la région.

Même si cette association peut sembler inhabituelle, elle est volontaire et doit être conservée.

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

Nécessite :

**Artisanat.**

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

Nécessite :

**Artisanat.**

---

# 34. RAVAGEUR

Bonus actuels :

* +10 PV ;
* +2 attaque ;
* +35 % vitesse.

Condition :

Nécessite :

**Boucherie.**

Bonus :

**+5 attaque contre ses cibles spécialisées.**

Le Ravageur doit notamment servir à attaquer l'économie adverse.

Une ambiguïté existe encore entre :

* attaque des élevages ;
* attaque uniquement des bâtiments.

Cette règle doit être confirmée avant une implémentation définitive de son ciblage.

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

Pendant sa mission, le chasseur est visible et se déplace continuellement vers des positions aléatoires bornées à l’intérieur de sa région d’origine. Un habitant sans métier affecté à la chasse utilise la vitesse normale ; le métier Chasseur applique la vitesse validée de **7,5 unités/s**. Ce déplacement est visuel et ne modifie ni la fréquence ni le rendement de production de viande.

Condition :

Nécessite :

**Boucherie.**

---

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

**Artisanat donne +2 dégâts et +5 PV par personne présente dans la colonne.**

L'interprétation exacte du cumul devra être confirmée avant l'implémentation définitive :

* buff appliqué individuellement à chaque personne ?
* effet selon le niveau du bâtiment ?
* cumul possible avec plusieurs effets ?

Ne pas inventer ces détails.

Déblocages :

## T1

* Barque ;
* équipement en bois.

## T2

* équipement en bronze ;
* piège.

## T3

* piège défensif ;
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

* voilier.

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

Une rivière apparaît seulement lorsqu'une carte ou une mécanique correspondante est utilisée.

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

Lorsqu'elle est :

* achetée ;
* ou directement placée grâce à une carte ;

elle apparaît physiquement sur le bord du Littoral.

Maximum :

**4 Barques par Littoral.**

Position visuelle :

**côté droit.**

Capacité :

**2 personnes.**

La vitesse exacte reste à définir.

TEMP_BALANCE_VALUE : en attendant la définition du prix, une Barque coûte **100 or** dans le magasin du village. Elle est achetable sur un Littoral disposant d'un Artisanat T1 ou d'une Boucherie T1. Ses deux places peuvent être utilisées simultanément.

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

PV :

**300.**

Le jeu possède un système d'informations cachées.

La Tour génoise permet de révéler :

**1/4 de la colonne adverse.**

Si elle est placée dans un Littoral :

**elle révèle 50 % de la colonne.**

---

# 55. OUTILS

Un Habitant peut recevoir un outil.

Maximum :

**1 outil par Habitant.**

Les outils s'achètent dans l'Artisanat du village sélectionné : bois au T1, bronze au T2, fer au T3. L'achat équipe immédiatement l'habitant sélectionné, s'il n'est pas engagé au combat. Changer d'outil remplace le précédent, sans cumul ni remboursement ; changer de métier ou de tâche conserve l'outil. TEMP_BALANCE_VALUE : prix respectifs **75 / 150 / 250 or**. Les bonus de quantité sont multiplicatifs avec les autres bonus de rendement ; le bois accélère le cycle de production personnel, pas le trajet. Les quatre tâches productives en bénéficient.

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

Une armure peut être portée en même temps qu'un outil. L'achat équipe immédiatement l'habitant sélectionné, hors combat ; les PV supplémentaires sont appliqués lors du déploiement. Le remplacement ne cumule pas les PV et ne rembourse pas l'ancienne armure. TEMP_BALANCE_VALUE : armures achetables à l'Artisanat, cuir au T1 pour **75 or**, maille au T2 pour **150 or**, fer au T3 pour **250 or** ; ces prix et ce rattachement aux tiers restent à valider.

## Cuir

+15 PV

## Maille

+35 PV

## Fer

+50 PV

---

# 57. SENTIER DE RANDONNÉE

Utilisable :

**uniquement en Montagne.**

Effet actuel :

**+20 % vitesse de déplacement.**

Cette valeur est provisoire car le système de vitesse doit encore être équilibré.

---

# 58. PIÈGE

Dégâts :

**50.**

Lorsqu'un adversaire passe dessus :

**-50 % vitesse pendant 3 secondes.**

---

# 59. DECK

Chaque joueur prépare son deck :

**AVANT la partie.**

Deck normal :

**jusqu'à 30 cartes.**

Un deck incomplet est autorisé dans le constructeur actuel et ne bloque pas le lancement d'une partie tant que les cartes ne sont pas utilisées dans le gameplay.

Maximum d'exemplaires d'une même carte :

**4.**

Toutes les cartes normales définies peuvent être ajoutées au deck, quelle que soit leur catégorie. Les cartes Mythologiques sont séparées du deck normal.

Le constructeur propose trois decks indépendants. Dans le prototype actuel, leur contenu reste uniquement dans l'état JavaScript de la session et n'est pas sauvegardé après actualisation.

Chaque deck sélectionne également **3 cartes Mythologiques parmi 5**. Pour une future partie, **2 de ces 3 cartes** seront tirées au sort et deviendront disponibles.

---

# 60. MAIN DE DÉPART

Le joueur commence avec :

**5 cartes.**

Ensuite :

**1 nouvelle carte toutes les 30 secondes.**

La phase normale dure 12:30.

La distribution doit être conçue autour des 30 cartes du deck.

Il faut faire attention au fait qu'une pioche à exactement 12:30 coïncide avec le début de l'Overtime.

Ce comportement devra être défini précisément pendant le développement.

---

# 61. LIMITE DE MAIN

Maximum :

**15 cartes en main simultanément.**

Le comportement lorsqu'une nouvelle carte doit être donnée alors que la main contient déjà 15 cartes n'est PAS encore défini.

Ne pas détruire automatiquement la carte ou inventer une règle sans confirmation.

---

# 62. CARTES MYTHOLOGIQUES

Les cartes Mythologiques sont volontairement extrêmement puissantes.

Le but est que leur existence provoque une tension permanente.

Avant la partie, chaque joueur présélectionne :

**3 cartes Mythologiques parmi les 5 existantes.**

Pour la partie, le jeu tire ensuite au sort :

**2 cartes parmi ces 3.**

Elles sont séparées des 30 cartes normales.

---

# 63. PREMIÈRE MYTHOLOGIQUE

Disponible après :

**5 minutes.**

La première des deux cartes Mythologiques tirées au sort pour la partie devient disponible.

Le tirage parmi les trois cartes présélectionnées et leur utilisation en partie ne sont pas encore implémentés dans le prototype.

---

# 64. DEUXIÈME MYTHOLOGIQUE

Disponible après :

**10 minutes.**

La seconde carte Mythologique tirée au sort pour la partie devient disponible.

---

# 65. CATÉGORIES DE CARTES

Il existe actuellement 4 grandes catégories.

Les cartes normales des catégories Action, Équipement et Antique peuvent toutes être présentes dans le deck normal. La catégorie Mythologique conserve sa sélection séparée.

## ACTION

Cartes présentes dans le deck et pouvant également être liées aux possibilités du village.

## ÉQUIPEMENT

Éléments principalement obtenus via les systèmes du village/bâtiments, mais désormais également autorisés dans le deck normal.

## ANTIQUE

Représente une :

**invention physique de l'Homme.**

Ces cartes sont dans le deck.

Elles coûtent des ressources/or selon les règles qui seront définies.

Leur nombre peut être limité.

Exemples :

* Rivière ;
* Moulin ;
* Tour génoise ;
* éléments agricoles ;
* Sentier ;
* etc.

## MYTHOLOGIQUE

Représente une :

**invention morale / imaginaire / croyance de l'Homme.**

Ces cartes viennent notamment des légendes et croyances corses.

Elles sont volontairement très puissantes.

---

# 66. U MAZZERU

Carte Mythologique.

Lorsqu'elle est utilisée :

elle révèle :

* le nombre d'habitants adverses ;
* leurs rôles ;

dans :

**toutes les colonnes adverses.**

Durée :

**120 secondes.**

---

# 67. A STREGHA

Carte Mythologique.

Elle maudit une zone.

Durée :

**2 minutes.**

Pendant la malédiction :

**la production/rendement de la zone est divisée par 2.**

---

# 68. U DIAVULU

Carte Mythologique extrêmement destructrice.

Lorsqu'U Diavulu est utilisé sur une colonne :

dans les DEUX territoires de cette colonne, donc :

* territoire du joueur ;
* territoire adverse ;

tous les éléments suivants meurent instantanément :

* habitants ;
* cultures ;
* élevages/bétail.

Le joueur qui utilise U Diavulu subit donc également les conséquences.

---

# 69. TERRAIN BRÛLÉ DE U DIAVULU

Après son utilisation, les deux régions restent brûlées pendant :

**120 secondes.**

Pendant cette période :

aucun nouvel élément ne peut être placé.

Cela concerne notamment :

* habitants ;
* cultures ;
* élevages ;
* nouveaux bâtiments ;
* autres placements concernés.

Après 120 secondes :

la région redevient utilisable.

---

# 70. U DIAVULU ET LES VILLAGES

Normalement :

**les villages ne subissent pas directement les dégâts de U Diavulu.**

Exception :

si U Diavulu est lancé depuis une :

**Montagne**

il inflige :

**125 dégâts**

aux bâtiments/village adverses de la colonne selon la règle actuelle.

Cette interaction devra être codée comme une exception explicite.

---

# 71. RESTRICTION DE U DIAVULU

U Diavulu ne peut PAS être utilisé depuis une région dont :

**le village a déjà été détruit.**

---

# 72. A SQUADRA D'AROZZA

Carte Mythologique.

Effet :

ressuscite tous les habitants morts pendant les :

**3 dernières minutes.**

Si elle est utilisée depuis une Plaine :

la fenêtre passe à :

**5 minutes.**

Question encore ouverte :

Si le village d'origine d'un Habitant ressuscité a été détruit, il faut déterminer où cet Habitant réapparaît.

Ne pas inventer cette règle avant confirmation.

---

# 73. ŒIL DE SAINTE-LUCIE

Carte Mythologique.

Effet :

révèle entièrement les biomes Littoraux adverses.

Durée :

**jusqu'à la fin de la partie.**

Condition :

la carte ne peut être utilisée que depuis :

**un biome Littoral.**

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

# 78. INFORMATION CACHÉE

Le joueur ne doit pas connaître automatiquement toutes les informations adverses.

Les informations adverses peuvent être cachées.

Certaines cartes/mécaniques servent spécifiquement à obtenir de l'information.

Exemples :

* Tour génoise ;
* U Mazzeru ;
* Œil de Sainte-Lucie.

Le système de visibilité doit donc être prévu dès l'architecture du jeu.

---

# 79. INTERFACE DES VILLAGES

Le magasin ne doit pas nécessairement être une grande interface indépendante.

Le système d'achat est intégré au village.

La boutique s'ouvre depuis le panneau latéral et permet de naviguer entre les quatre villages du joueur sans la fermer. Elle comporte quatre colonnes sur grand écran : vente des six ressources locales du village sélectionné, Bergerie, Artisanat et Boucherie. L'or gagné par la vente reste global. Le choix de l'habitant à équiper et son équipement actuel apparaissent sous les ressources à vendre, dans la première colonne ; les articles de l'Artisanat restent dans la troisième colonne. Un clic en dehors de la fenêtre ferme la boutique, tout comme le bouton rouge « Retour ». Chaque échoppe exige le bâtiment associé et chaque rayon exige son bon tier. La Bergerie T1 débloque Chèvre, Cochon et Vache, T2 l'Âne, T3 Chien et Sanglier. L'Artisanat T1 débloque Barque et équipement en bois, T2 équipement en bronze et Piège, T3 Piège défensif et équipement en fer. La Boucherie T1 débloque Filet de pêche et Barque, T2 Piège de chasse, T3 Voilier. Barque, Voilier, Filet, chèvres, cochons, vaches, ânes, chiens, sangliers, outils et armures sont achetables et fonctionnels ; les éléments dont la mécanique n'est pas encore implémentée restent visibles mais non achetables. La liste « Compagnons du village » de la Bergerie permet de commander séparément chiens et sangliers et d'en consulter les PV. Le malus de reproduction actif est indiqué directement dans l'enclos touché.

Chaque achat d'animal ajoute **un animal** à un enclos vivant de la même espèce, choisi au hasard **dans le village sélectionné**. S'il n'existe aucun enclos compatible, un emplacement libre autorisant les animaux est choisi au hasard pour en créer un. Aucune culture ni autre espèce n'est remplacée. S'il n'y a pas de place, l'achat est bloqué sans dépense. Les dégâts du troupeau et sa progression de reproduction sont conservés. TEMP_BALANCE_VALUE : achat d'une chèvre **50 or**, d'un cochon **65 or**, d'une vache **90 or**, avec Bergerie T1 minimum. Le placement direct d'un élevage est disponible sans Bergerie dans un emplacement libre compatible, selon les règles provisoires du prototype.

Lorsqu'un village est sélectionné, le joueur doit pouvoir accéder à des actions comme :

```text
Ajouter un bâtiment
Améliorer le village
Acheter / débloquer certains éléments
Gérer les habitants
Vendre les ressources locales
```

Le panneau élargi et repliable occupe toute la largeur sous le plateau et comporte quatre colonnes : habitants du village et statut de présence/mission ; tâches ; attribution d'un métier ; gestion du village et de ses bâtiments (construction et amélioration). Chaque tâche propose aussi **« Attribuer à tous »** : la commande affecte uniquement les habitants sans tâche, actuellement disponibles dans le village, un par un à **0,5 seconde d'intervalle** ; elle ne remplace jamais une tâche existante. Chaque métier possède la même commande, qui affecte uniquement les habitants sans métier et ne remplace jamais une spécialité existante. **« Retirer les tâches à tous »** libère progressivement tous les habitants affectés aux tâches économiques, sans changer leur métier. **« Retirer les métiers à tous »** retire les spécialités de tous les habitants locaux, y compris ceux qui travaillent, sans changer leur tâche. Ces deux retraits groupés ignorent toujours les habitants engagés en attaque ou en défense. Les métiers dont le bâtiment requis manque restent inaccessibles. À côté des commandes groupées, chaque tâche et chaque métier possède un bouton vert **« Attribuer aux prochain »**. Chaque village mémorise une tâche et un métier pour tous les habitants qui y apparaissent ensuite, par génération naturelle ou achat. Les choix restent actifs jusqu'à ce que le joueur en sélectionne d'autres. Les choix par défaut au début de la partie sont **« Rendre disponible »** et **« Sans métier »**. Le métier est appliqué avant la tâche ; si une condition d'accès manque à l'arrivée, le choix concerné ne s'applique pas et l'habitant conserve son état de base. Un encadré **bleu** et une étoile signalent un bonus de métier. Un encadré **jaune** signale le métier équipé ou la tâche active ; si cette tâche est aussi boostée, un liseré bleu intérieur reste visible. L'habitant sélectionné est entouré d'une lumière jaune dans la liste et sur le plateau 2D/3D. Les pêcheurs affectés ensemble restent visibles individuellement. La vente des ressources locales se fait dans la première colonne de la boutique. Informations, cultures et élevages restent à droite. Sur petit écran, les colonnes de gestion se réorganisent et les informations passent sous le plateau.

La sélection ne se fait plus en cliquant sur le terrain. Les huit boutons Rouge V1 à V4 et Bleu V1 à V4, avec biome, PV et tier, se trouvent sous « Ouvrir la boutique ». La carte 2D/3D sert uniquement à visualiser la partie : ses villages et emplacements ne sont pas des boutons. Le temps restant apparaît en haut au centre de la carte. Dans le panneau latéral, un groupe unique de quatre boutons **Slot 1 à 4** remplace les listes séparées de cultures et d'élevages. Cliquer sur un slot ouvre juste sous ces boutons les cultures compatibles avec son biome et, si le slot l'autorise, les élevages disponibles. Un clic sur un type place directement le contenu ; un slot occupé par un élevage donne accès à l'abattage. Les slots inexistants sont grisés. Le Littoral ne possède toujours que deux slots.

Huit fiches compactes restent superposées en permanence à la carte, une par village. Chacune affiche ses points de vie, sa population, le nombre d'habitants disponibles et ses six stocks locaux : blé, châtaigne, raisin, viande, poisson et lait. La fiche du village sélectionné est mise en évidence. Ces fiches sont communes aux vues 2D et 3D et restent purement informatives.

Les bâtiments et le village peuvent évoluer jusqu'à T3. L'amélioration ajoute uniquement la différence de PV entre niveaux aux PV courants et maximum, conservant les dégâts déjà subis. Le village passe aux plafonds de 25 puis 35 habitants. TEMP_BALANCE_VALUE : son amélioration coûte 300 or vers T2 et 450 or vers T3, sans ressource locale. Les coûts provisoires sont centralisés dans `config.js`.

Le joueur peut aussi acheter immédiatement un nouvel habitant dans le village sélectionné, si la population n'a pas atteint son plafond. TEMP_BALANCE_VALUE : cet achat coûte **50 or global et 50 unités d'une ressource locale au choix**. Le nouvel habitant reçoit la tâche et le métier actuellement choisis pour les nouveaux habitants de ce village ; par défaut, il arrive disponible et sans métier.

Le plateau emploie désormais des illustrations dédiées pour les trois terrains, les cultures, les élevages, les habitants et les bâtiments. Ces visuels servent à identifier plus vite les éléments ; les libellés, états et infobulles restent la référence fonctionnelle.

Chaque habitant possède une apparence liée à son **métier réel**, indépendamment de sa tâche : tunique et sac (sans métier), chapeau de paille et fourche (agriculteur), cape et houlette (berger), chapeau et canne (pêcheur), capuche et arc (chasseur), casque à crête et épée/bouclier (guerrier), bandeau et hache (ravageur). Les modèles 3D combinent cette silhouette avec le matériau de l'outil et l'armure portés ; les portraits et la vue 2D montrent aussi les équipements. Les habitants disponibles et les pêcheurs restent visibles, sans doublonner les unités militaires. Le magasin de l'Artisanat affiche l'habitant ciblé et son équipement actuel ; les objets déjà équipés sont encadrés en jaune.

Le village et ses bâtiments construits sont visibles directement sur leur région, au bord extérieur du terrain près du village propriétaire. Le village apparaît dès le début de la partie. Bergerie, Artisanat et Boucherie apparaissent immédiatement après leur construction. Chaque famille possède une apparence propre pour T1, T2 et T3 ; son sprite est remplacé dès que le niveau change. Ces éléments visuels ne créent pas de nouveaux slots et ne modifient pas leurs règles de ciblage.

TEMP_BALANCE_VALUE visuelle : lorsqu’un village reçoit un coup, une fumée animée sort pendant **2,4 secondes** du village et de chaque bâtiment construit dans sa région. Les bâtiments contribuant actuellement à un unique total de PV du village, cet effet représente les dégâts subis par l’ensemble structurel ; il n’ajoute aucun dégât et ne crée pas encore de ciblage individuel des bâtiments.

TEMP_BALANCE_VALUE visuelle : en 3D, une unité bascule légèrement vers l'avant lorsqu'elle porte un coup et clignote une fois en rouge lorsqu'elle reçoit l'impact appliqué chaque seconde. À sa mort, sa figurine reste brièvement visible, prend une teinte rouge à **70 %**, tombe sur le côté, puis sa disparition produit une petite fumée. Les durées, le nombre de particules et les angles sont centralisés dans `config.js`. Ces animations n'affectent ni les dégâts, ni le moment où l'unité est retirée de la simulation.

Le plateau principal possède désormais un rendu **Three.js 3D** qui représente les huit régions, leurs biomes, villages, bâtiments T1/T2/T3, cultures, élevages, habitants et unités. Les chasseurs itinérants et la fumée des structures attaquées sont visibles dans les deux rendus. La caméra peut tourner et zoomer ; la sélection du village passe par la barre de boutons hors carte afin que les vues 2D et 3D partagent exactement la même navigation. La simulation, l'économie, le combat et le multijoueur restent indépendants du rendu : l'état JavaScript actuel demeure la source de vérité. Une vue 2D reste accessible comme solution de repli et pour l'accessibilité. Cette séparation doit permettre d'ajouter WebXR/AR ultérieurement sans réécrire les règles du jeu.

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
│   ├── cards.js
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
    ├── cards/
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

    cards: {
        deckSize: 30,
        startingHand: 5,
        maxHand: 15,
        maxCopies: 4,
        drawInterval: 30,
        firstMythic: 300,
        secondMythic: 600
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

## ÉTAPE 4 — Deck

Créer :

* deck de 30 ;
* maximum 4 exemplaires ;
* 5 cartes initiales ;
* pioche toutes les 30 secondes ;
* main maximum 15.

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

## ÉTAPE 9 — Cartes spéciales

Créer :

* Antiquités ;
* pièges ;
* équipements ;
* Tour génoise ;
* etc.

## ÉTAPE 10 — Mythologiques

Créer :

* choix à 5 min ;
* choix à 10 min ;
* U Mazzeru ;
* A Stregha ;
* U Diavulu ;
* A Squadra d'Arozza ;
* Œil de Sainte-Lucie.

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
* 4 villages par joueur ;
* 4 régions par joueur ;
* Montagne/Plaine/Littoral ;
* au moins un biome de chaque au premier tirage ;
* possibilité d'échanger jusqu'à 2 biomes ;
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
* 3 bâtiments maximum par village ;
* bâtiments = 75/150/225 PV ;
* T1 bâtiment = 200 or ;
* T2 = 100 ressources + 200 or ;
* T3 = 150 ressources + 300 or ;
* génération population 45/35/25/15 secondes ;
* deck normal = 30 cartes ;
* maximum 4 cartes identiques ;
* main initiale = 5 ;
* pioche = 30 secondes ;
* main maximum = 15 ;
* 2 Mythologiques séparées ;
* premier choix Mythologique à 5 min ;
* deuxième à 10 min ;
* 2 cartes proposées parmi les Mythologiques ;
* 1 sélectionnée ;
* durée normale = 12:30 ;
* ensuite Overtime ;
* combat automatique en temps réel ;
* Habitant = 20 secondes pour une colonne ;
* Chasseur = 50 % plus rapide ;
* redirection militaire après destruction d'un village ;
* victoire après destruction des 4 villages.

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

### Deck

* comportement lorsque la main est déjà à 15 cartes ;
* comportement exact de la pioche à 12:30.

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
* fonctionnement exact du buff Artisanat ;
* signification exacte des réductions -10/-20/-30 de la Bergerie.

### Animaux

* règle exacte de réduction de reproduction des Vaches ;
* fréquence d'attaque du Chien.

### Transport

* vitesse Barque ;
* vitesse Voilier ;
* vitesse Charrette.

### Mythologiques

* emplacement de résurrection avec A Squadra d'Arozza si le village d'origine est détruit.

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

Les cartes culturelles et mythologiques peuvent bouleverser cet équilibre.

Le but est que la Corse ne soit pas seulement le décor du jeu.

**Le territoire, les productions, les pratiques et les croyances corses doivent participer directement aux règles du jeu.**

---

# 93. TUTORIEL SCÉNARISÉ

Le bouton Tutoriel lance une partie guidée distincte des modes normal, local et réseau. La future cinématique reste prévue mais n'est pas encore produite. Un narrateur temporaire guide le joueur au moyen d'une boîte de dialogue pleine largeur en bas de l'écran. Un clic termine instantanément l'affichage progressif d'une phrase sans valider simultanément le dialogue ; un second clic valide les phrases manuelles. Chaque réplique peut recevoir plus tard un fichier `tutoriel_xxxx.mp3` dans `assets/audio/tutorial/`, sans rendre l'audio obligatoire.

Le tutoriel impose le deck Plaine et le territoire initial Plaine, Littoral, Montagne, Montagne. L'échange demandé transforme ensuite les régions 2 et 3 pour obtenir Plaine, Plaine, Littoral, Montagne. Le joueur doit réellement utiliser les mécaniques existantes : placer quatre champs de blé en Plaine 1, affecter un habitant à l'agriculture, construire une Bergerie, attribuer le métier Agriculteur, repousser une attaque équilibrée, construire un Artisanat, attribuer Guerrier aux trois habitants encore disponibles et lancer une attaque groupée. Les actions étrangères à l'étape courante sont verrouillées et l'action attendue est entourée d'une animation jaune.

Le village Rouge de la première région commence avec cinq habitants. La génération automatique des habitants rouges est suspendue jusqu'à la destruction du premier village adverse. Le tutoriel n'a ni limite de temps ni Overtime. Après le premier village adverse détruit, toutes les restrictions sont levées, la génération normale reprend et une IA volontairement facile poursuit son économie ; elle attend environ 60 secondes entre ses attaques et ne lance pas plus de trois offensives supplémentaires.

La première sélection ultérieure d'une Montagne ou d'un Littoral déclenche une unique explication en pause avec mise en évidence des deux biomes. À la fin de ces dialogues, le bouton de vue 3D est mis en évidence et la partie reprend lorsque le joueur l'utilise pour repasser en 3D. La destruction des quatre villages adverses termine proprement le tutoriel et propose un retour au menu. Ces restrictions ne doivent jamais s'appliquer aux autres modes de jeu.

---

# 94. RÉALITÉ MIXTE — INTERFACE JOUABLE QUEST 3

La réalité mixte est une représentation supplémentaire de l'état existant, avec Three.js et une session WebXR **immersive-ar** sur fond transparent. Elle conserve les huit régions, les huit villages, les biomes, les emplacements et les littoraux orientés vers l'adversaire. Le menu HTML et les modes entraînement, local et salons sont conservés. Le mode entraînement ou local peut être choisi directement dans le casque ; le code du salon en ligne se saisit dans Quest Browser. La préparation et la partie peuvent ensuite être pilotées avec les contrôleurs sans revenir à l'interface classique. Les commandes XR appellent les mêmes fonctions métier que le desktop ; les règles et la simulation restent communes.

Le joueur confirme lui-même le placement sur sa table avec la gâchette d'un contrôleur. Une surface détectée n'est pas automatiquement identifiée comme une table. Un aperçu transparent et un repère précèdent le placement ; si le hit-test n'est pas disponible, un plan manuel à hauteur réglable permet le même placement. La largeur initiale est d'environ **80 cm**, configurable. Le côté du joueur Rouge ou Bleu est orienté vers sa position initiale. Le socle et tous les éléments suivent un seul groupe de transformation.

Un mode manipulation explicite, ouvert par les réglages, permet déplacement, rotation, taille et recentrage. En dehors de ce mode, les préhensions et joysticks ne déplacent pas le plateau. Une préhension déplace le plateau ; deux préhensions permettent aussi rotation et redimensionnement. Le joystick gauche déplace et le droit pivote. Les boutons 3D proposent également toutes ces opérations à la gâchette. Sur les profils Touch reconnus, les gâchettes index valident, A ouvre/ferme les informations du village sans activer le bouton visé, B revient, X masque ou affiche les panneaux de gestion et Y rappelle l'état des cartes. Le joystick droit parcourt les habitants dans leur contexte ; les autres panneaux proposent une pagination contextuelle. Les commandes système ne sont pas utilisées.

Les cinq fenêtres de gestion (Métiers, Informations, Tâches, Bâtiments, Habitants) sont stables dans l'espace et individuellement saisissables par leur barre supérieure avec la préhension. La main déplace et oriente la fenêtre ; pendant la saisie, le joystick vertical ajuste sa distance et l'horizontal sa taille. B annule la pose en cours. Les clics sont neutralisés pendant cette manipulation et brièvement après relâchement. Les positions personnalisées sont conservées durant la session, sans suivi permanent de la tête et sans transformation du plateau. Les paramètres permettent des ajustements par boutons, un recentrage et une réinitialisation ; maintenir X récupère aussi les fenêtres devant soi. Trois tailles de texte agrandissent réellement les surfaces en mètres. Le thème reprend les couleurs CSS et les listes sont paginées sans compression horizontale des textes. Ces décisions d'interface ne modifient ni les règles économiques ni les commandes du moteur.

Sélectionner un village affiche simultanément scores, chronomètre, métiers, stocks, tâches, bâtiments et habitants. Les menus XR donnent accès aux missions individuelles et collectives, métiers, constructions et améliorations, cultures, élevages, ventes, achats et compagnons, sous réserve des mêmes conditions que sur desktop. La préparation des decks et biomes utilise également les commandes existantes. Les données se mettent à jour depuis la même simulation ou les mêmes snapshots réseau que le desktop. La position et l'orientation spatiales restent propres à chaque casque ; la largeur choisie par l'hôte est communiquée à l'invité sans modifier les unités logiques du jeu. L'invité peut placer localement son plateau mais ne peut pas le redimensionner ni entrer dans sa manipulation.

Une ancre non persistante est utilisée si disponible. Sans ancre, le plateau reste dans le repère de la session ; un changement d'origine impose un nouveau placement. Aucune restauration spatiale entre sessions n'est promise. Les valeurs de confort et les limites provisoires sont centralisées dans `Config.xr` avec la mention `TEMP_BALANCE_VALUE`.

Les futures cartes suivront sélection → carte active → emplacements autorisés → confirmation, via un adaptateur appelant les fonctions métier partagées. Le jeu de cartes complet, ses coûts et ses effets n'existent pas encore sur desktop et ne sont donc pas ajoutés à cette interface ; Y indique cet état. Le tutoriel scénarisé reste dans son interface actuelle. Les tests matériels à effectuer sont détaillés dans `QUEST3.md`.
