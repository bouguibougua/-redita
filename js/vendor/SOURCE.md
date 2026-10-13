# Three.js

Version **0.186.0**, licence MIT. Les mentions de licence sont conservées dans les fichiers.

Le noyau utilise le [fichier minifié distribué avec Three.js](https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.core.min.js), conservé sous le nom `three.core.js` pour garder les imports existants. Le module de rendu `three.module.min.js` importe ce noyau : ces deux fichiers sont nécessaires.

Avant remplacement, le noyau complet et le module de rendu locaux ont été comparés aux fichiers de cette version, avec normalisation des fins de ligne Windows. Leurs contenus correspondaient exactement. La version complète du noyau est conservée dans la sauvegarde décrite dans `NETTOYAGE.md`.

Dépôt : [mrdoob/three.js](https://github.com/mrdoob/three.js).
