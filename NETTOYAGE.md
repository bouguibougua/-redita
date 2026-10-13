# Nettoyage du 13 octobre 2026

Le projet optimisé est le dépôt dans `C:/Users/20241234/Downloads/-redita/-redita`, celui qui contient les 39 cartes jouables. Le dossier parent est un autre checkout, avec son propre historique Git.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Dossier du projet, hors `.git` | 276,6 Mo | 37,1 Mo |
| Fichiers, avec les aperçus de contrôle | 349 | 144 |
| Neuf images de terrain et sprites utilisés | 24,7 Mo | 6,7 Mo |
| Noyau Three.js | 1,5 Mo | 0,4 Mo |

Le dossier actif est environ **87 % plus léger**. Les aperçus dans `output/cards/` représentent environ 5 Mo et sont ignorés par Git. Ces chiffres concernent le dossier actif ; les archives externes et l'historique Git sont comptés séparément.

Le nettoyage comprend :

- l'archivage de l'ancienne copie complète `-redita-main/`, des premiers visuels de cartes, des PNG sources et des métadonnées macOS ;
- l'utilisation des 48 images WebP nécessaires au jeu, avec les dimensions des terrains et sprites conservées ;
- le remplacement du noyau Three.js par sa variante minifiée de la même version, après comparaison des sources et en conservant sa licence ;
- un script commun de préparation des images et un lanceur partagé pour les tests de navigateur ;
- le retrait de deux fonctions jamais appelées, d'une option de configuration inutilisée et d'une requête vers un son de carte absent ;
- la compression gzip des fichiers HTML/CSS/JS, la validation du cache par ETag et le streaming partiel des musiques ;
- des mises à jour de texte uniquement lorsque sa valeur change, et la conservation des modèles de terrain lorsqu'un moulin ou une tour perd simplement des PV.

## Sauvegarde et sources

Les fichiers archivés sont dans :

```text
C:/Users/20241234/Downloads/Eredita-sauvegardes/nettoyage-2026-10-13/
├── ancienne-copie/          ancienne version complète du jeu
├── sources/cards/legacy/   première série d'illustrations
├── sources/cards/fantasy/  planche et PNG des cartes actuelles
├── sources/generated/     PNG des terrains et sprites
├── vendor/                 noyau Three.js complet
├── metadata/               métadonnées macOS
├── retired/                originaux retirés du dossier publié
├── inventaire-avant.json   chemins, tailles et empreintes initiales
└── bilan.json              mesures du nettoyage
```

**213 fichiers archivés** ont été comparés à leur empreinte SHA-256 initiale. Les sources permettent de recréer les WebP sans ajouter les gros PNG au dépôt.

Depuis le dossier du projet, préparer toutes les images avec :

```powershell
npm run assets:prepare -- "C:/Users/20241234/Downloads/Eredita-sauvegardes/nettoyage-2026-10-13/sources"
```

Pour préparer seulement les cartes, utiliser `npm run assets:cards -- "chemin/vers/sources"`. Sans argument, le script lit `EREDITA_ASSET_SOURCES` ou le dossier `.asset-sources/`, ignoré par Git. La préparation utilise Edge sur Windows. Les prompts et recadrages restent dans `assets/cards/fantasy/SOURCE.md` et `manifest.json`.

## Vérification

Les vérifications suivantes ont réussi après le nettoyage : `npm test`, `npm run test:xr`, `npm run test:cards-browser`, `npm run test:decks-browser`, `npm run test:transport-browser`, `npm run test:xr-browser` et `git diff --check`. Elles couvrent le jeu, les cartes, la 3D, le réseau, le cache HTTP, le streaming audio et les interfaces navigateur. Les tests XR utilisent un périphérique simulé.

## Prochain commit

Les fichiers du nettoyage sont modifiés localement. Des changements avaient déjà été indexés avant cette intervention. Pour inclure les nouvelles images, les modifications et les suppressions dans le prochain commit, vérifier les changements puis lancer `git add -A` depuis ce dépôt. Le nettoyage ne crée pas de commit et ne publie pas le site.
