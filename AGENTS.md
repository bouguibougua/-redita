# AGENTS.md — Eredità

## Règle principale

Avant de créer, supprimer ou modifier une mécanique du jeu, lire :

**GAME_DESIGN.md**

Ce fichier constitue la référence du projet.

---

## Projet

Eredità est un prototype de jeu vidéo universitaire de stratégie 1v1 en temps réel inspiré de la Corse.

Le prototype actuel doit être développé principalement avec :

* HTML ;
* CSS ;
* JavaScript.

Ne pas ajouter de framework ou de technologie complexe sans raison.

L'objectif est d'obtenir rapidement une version jouable et maintenable.

---

## Avant de coder

Toujours vérifier si la règle demandée existe dans `GAME_DESIGN.md`.

Si elle existe :

**la respecter exactement.**

Si elle n'existe pas :

ne pas inventer une règle définitive.

Si une valeur temporaire est absolument nécessaire pour faire fonctionner le prototype, la centraliser dans `config.js` et indiquer clairement qu'il s'agit d'une valeur temporaire.

Exemple :

```js
// TEMP_BALANCE_VALUE — valeur non encore validée
const ATTACK_RANGE = 3;
```

---

## Ne pas modifier silencieusement le game design

Même lorsqu'une règle semble inhabituelle, ne pas la "corriger" automatiquement.

Si une contradiction est détectée :

1. expliquer brièvement la contradiction ;
2. demander confirmation ;
3. attendre la décision avant de modifier la règle définitive.

---

## Architecture

Séparer autant que possible :

* données ;
* règles ;
* rendu ;
* interface.

Les statistiques ne doivent pas être dispersées dans le code.

Utiliser une configuration centrale.

Organisation recommandée :

```text
js/
├── config.js
├── cards.js
├── game.js
├── board.js
├── economy.js
├── combat.js
├── buildings.js
├── units.js
├── biomes.js
└── ui.js
```

---

## Équilibrage

Toutes les valeurs susceptibles de changer doivent être faciles à modifier.

Cela concerne notamment :

* PV ;
* dégâts ;
* coûts ;
* temps ;
* vitesse ;
* production ;
* reproduction ;
* bonus ;
* malus ;
* Overtime.

Ne pas utiliser des nombres magiques dispersés dans le code.

---

## Map

Ne pas fabriquer une image complète différente pour chaque combinaison de terrain.

Le système doit être conçu autour de :

* biome de base ;
* slots ;
* templates ;
* overlays ;
* éléments placés dynamiquement.

Les images de concept ne sont pas toujours exactes.

Les règles écrites dans `GAME_DESIGN.md` sont prioritaires.

---

## Temps réel

Le jeu n'est pas au tour par tour.

Le moteur doit pouvoir gérer simultanément :

* timer ;
* déplacement ;
* combat ;
* agriculture ;
* élevage ;
* pêche ;
* production ;
* génération d'habitants ;
* effets temporaires ;
* cartes ;
* Overtime.

---

## Priorité du prototype

Priorité :

**fonctionnement > graphismes.**

Construire d'abord un prototype complet avec des formes, icônes ou placeholders si nécessaire.

Les assets définitifs pourront remplacer les placeholders plus tard sans réécrire la logique.

---

## Modification du Game Design

Lorsque le concepteur donne une nouvelle règle qui remplace une ancienne règle :

1. considérer la nouvelle comme prioritaire ;
2. modifier le code concerné ;
3. proposer la mise à jour correspondante de `GAME_DESIGN.md`.

Le projet doit toujours conserver une documentation cohérente avec le code.

---

## Important

Ne jamais supposer qu'une ancienne mécanique inspirée de Clash Royale doit être copiée exactement.

La référence à Clash Royale concerne principalement le principe :

**placement → déplacement automatique → détection → combat → progression vers le village.**

Eredità possède ses propres règles.

Ne pas copier :

* assets ;
* interface ;
* personnages ;
* noms ;
* design visuel de Clash Royale.

---

## Quand demander au concepteur

Demander confirmation uniquement lorsqu'une information manquante empêche réellement de coder correctement une mécanique.

Ne pas interrompre constamment le développement pour des détails d'équilibrage qui peuvent être placés temporairement dans `config.js`.

L'objectif est d'avancer rapidement tout en respectant le Game Design.
