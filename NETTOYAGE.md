# Nettoyage du système de cartes — 20 octobre 2026

Le jeu utilise désormais exclusivement les renforts mythologiques. L’ancien
constructeur de decks, la main, la pioche et leurs déblocages n’étaient plus
chargés, mais leurs fichiers et une partie de leur moteur restaient présents.

## Fichiers retirés

57 fichiers obsolètes, soit 2 167 813 octets (environ 2,1 Mo) :

- six modules : `cards.js`, `card-art.js`, `card-effects.js`, `card-game.js`,
  `card-ui.js` et `decks.js` ;
- les deux feuilles de styles des cartes et des decks ;
- sept suites de tests visant ces fonctionnalités supprimées ;
- les 39 illustrations de l’ancien catalogue, leur manifeste et leur documentation.

Les anciens scripts npm et la génération d’images de cartes ont également été
retirés. `assets:prepare` prépare les neuf atlas de terrain et sprites actifs,
sans dépendre d’un manifeste de cartes absent. Les sources PNG restent externes
et se choisissent par argument ou avec `EREDITA_ASSET_SOURCES`.

## Code actif conservé et simplifié

- `mythology-effects.js` porte directement le terrain brûlé, la rivière et la
  vision, sans passerelle vers le moteur supprimé.
- `buildings.js` porte le bonus d’Artisanat : mêmes valeurs, aucun cumul,
  blessures conservées, compatibilité U Magu et snapshots réseau.
- Les branches inaccessibles de moulin, tour, piège, sentier et charrette
  quittent la simulation, les rendus 2D/3D et la configuration.
- Les commandes de vue réutilisent leur liste autorisée au lieu de la recréer
  à chaque action. L’ancien adaptateur de ciblage de cartes est retiré.
- Les sélecteurs CSS et la navigation VR propres aux decks sont retirés.
- Les effets visuels actifs du plateau résident dans `mythology.css`.

Les seize illustrations actuelles, leurs animations, les cristaux, les choix
FIFO et le stock LÉGENDES sont conservés. Le fond `deck-library.webp` est toujours
utilisé par le grimoire : son nom historique n’en fait pas un fichier inutilisé.
Les villages, banques, embarcations, tâches, boutiques et pouvoirs gardent leurs
règles existantes. Aucune dépendance n’a été ajoutée.

## Vérification

```sh
npm test
npm run test:menu
npm run test:xr
npm run test:mythology-browser
npm run test:reinforcements-browser
npm run test:powers-browser
```

Les tests d’Artisanat sont maintenus indépendamment des anciennes cartes dans
`tests/buildings.test.js`. Les assertions historiques du noyau et des équipements
incluent maintenant ce bonus déjà actif dans le jeu complet.
Les tests de navigateur utilisent le chemin `/-redita/`, un téléphone simulé,
le vrai rendu Three.js et deux clients réseau. WebXR reste simulé ; le confort
et les contrôleurs physiques nécessitent un essai sur Quest 3.

Le nettoyage de sources ne constitue pas une mesure de gain de FPS : les modules
historiques déjà non chargés pesaient sur le dépôt, pas sur le rendu en partie.
Aucun commit ni déploiement n’a été effectué.
