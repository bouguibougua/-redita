# Plateau Three.js

Le plateau 3D est la vue principale d'Eredità. Le bouton **Vue 2D** permet de revenir à l'ancien plateau à tout moment.

## Commandes

- glisser avec la souris ou le doigt : tourner autour du plateau ;
- molette : zoomer ou dézoomer ;
- boutons **Rouge V1 à V4** et **Bleu V1 à V4** sous le plateau : sélectionner un village ;
- le plateau lui-même reste visuel et ne contient aucun bouton de sélection ou de placement ;
- bouton **Vue 2D / Vue 3D** : changer de rendu sans modifier la partie.

## Architecture

`js/board3d.js` lit l'état du jeu sans le modifier. Les règles restent dans les modules existants. Three.js r186 est conservé localement dans `js/vendor/three.module.min.js`, sous licence MIT, pour éviter une dépendance à un CDN.

Les modèles actuels sont procéduraux afin de garantir un prototype léger : reliefs, eau, bâtiments, cultures, animaux, personnages, Barques, Voiliers et Filets de pêche sont composés avec des géométries Three.js. Ils pourront ensuite être remplacés progressivement par des fichiers GLB sans changer le moteur de jeu.

Les sept métiers ont chacun leur silhouette : habitant avec sac, agriculteur avec chapeau de paille et fourche, berger avec cape et houlette, pêcheur avec canne, chasseur avec arc, guerrier avec épée et bouclier, ravageur avec hache. Le métier réel détermine le modèle, et non la mission. Les habitants au village et les pêcheurs sont également représentés. Les outils bois/bronze/fer modifient le matériau de l'accessoire ; les armures cuir/maille/fer ajoutent une protection visible. Le modèle se renouvelle lors d'un changement d'équipement, de métier ou d'embarcation, sans créer de doublons.

Pour équiper un personnage : sélectionnez-le dans la liste des habitants, puis achetez l'objet dans l'Artisanat de son village. L'aperçu du magasin et le portrait indiquent l'équipement actif. `npm test` vérifie notamment les 112 combinaisons métier/outil/armure avec le vrai module Three.js, sans navigateur.

Les compagnons achetés à la Bergerie ont aussi leurs modèles : chien avec museau et queue, sanglier avec défenses, âne aux longues oreilles et sacoches. L'âne suit la représentation de son habitant, y compris pendant son travail ou son combat. Les chiens et sangliers sont visibles au village, puis suivent leurs positions de simulation une fois déployés, sans doublons. Le sanglier nage sans bateau ; le chien utilise la flotte disponible. Ces compagnons ne sont pas des troupeaux reproducteurs.

Pendant un combat, la figurine bascule vers sa cible à chaque attaque et clignote une fois en rouge lorsqu'elle subit l'impact appliqué chaque seconde. Une unité morte est retirée immédiatement des règles du jeu, mais son dernier modèle reste affiché pendant une courte animation : teinte rouge à 70 %, chute latérale, puis disparition dans une petite fumée procédurale. Le rendu consomme pour cela des événements visuels bornés et synchronisés dans l'état de partie, ce qui fonctionne aussi pour le joueur invité en ligne.

Les chasseurs se déplacent dans leur région à partir des positions synchronisées par la simulation. Lorsqu’un village subit un coup, des particules de fumée procédurales apparaissent au-dessus du village et de ses bâtiments. Les unités qui traversent l'eau sont visuellement accompagnées de leur Barque ou Voilier ; une unité sans place disponible se noie selon la simulation, indépendamment du rendu. Huit fiches HTML communes aux vues 2D et 3D restent visibles sur le plateau et résument en permanence les PV, la population, les habitants disponibles et les six ressources de chaque village.

## Prochaine étape AR

La scène et le groupe `world` sont séparés du moteur. Une future session WebXR pourra placer ce groupe sur une surface détectée et conserver les mêmes interactions et la même synchronisation multijoueur.
