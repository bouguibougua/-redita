# Catalogue des renforts mythologiques

Préparation des données du 20 octobre 2026. Aucun effet supplémentaire n’est
activé et aucune dépendance n’est ajoutée.

## Architecture examinée

| Système existant | Fichiers et rôle |
| --- | --- |
| Joueurs, villages et état | `js/board.js` crée `state.players`, villages, habitants et banques locales |
| Configuration | `js/config.js` centralise les valeurs existantes, dont `cardGame` |
| Unités et équipements | `js/units.js`, `js/equipment.js`, `js/animals.js` |
| Ressources et population | `js/economy.js`, `js/crops.js`, `js/livestock.js`, `js/buildings.js` |
| Combat et horloge | `js/combat.js`, `js/game.js` |
| Catalogue, decks, main | `js/cards.js`, `js/decks.js`, `js/card-game.js` |
| Effets des cartes | `js/card-effects.js` : pouvoirs, vision, malédiction, terrain brûlé et résurrection |
| Interface | `js/ui.js`, `js/card-ui.js`, `js/card-art.js`, `js/game-view.js` |
| Rendu et réseau | `js/board3d.js`, `js/xr*.js`, `js/network.js`, `server.js` |

Les règles de `GAME_DESIGN.md`, sections 59–73, restent la référence. Le catalogue
prépare **16 légendes** ; les decks continuent de sélectionner **3 des 5 cartes
jouables**, avec 2 tirées pour la partie et leurs déblocages existants. Les onze
fiches supplémentaires ne sont pas enregistrées dans `E.Cards` ni dans la main.

## Fichiers créés ou modifiés

| Fichier | Responsabilité |
| --- | --- |
| Nouveau `js/mythology-data.js` | Configuration des 16 fiches dans `Config.mythology` ; identité, visuels et gameplay séparés ; accès via `E.Mythology` ; résolution des palettes du cristal |
| Nouveau `js/mythology-effects.js` | Registre descriptif des cinq effets existants, sans nouvelle méthode d’activation |
| Nouveau `js/mythology-ui.js` | Composants de carte et de paire, aperçu du cristal sur demande, sans commande métier |
| Nouveau `js/mythology-crystal.js` | Rendu Three.js du cristal bicolore, ouverture et particules ; aucune activation de pouvoir |
| Nouveau `css/mythology.css` | Styles isolés ; miroir sur la fenêtre illustrée uniquement |
| Nouveau `tests/mythology.test.js` | Données, fichiers réels, alias, paramètres, absence de mutation et comparaison des effets existants |
| Nouveau `tests/mythology-browser.test.js` | Vrai navigateur, recadrage, miroir, mobile, decks et lancement d’une partie |
| Nouveau `tests/crystal-browser.test.js` | Couleurs, ouverture, pause/relecture, pouvoirs absents, palette incomplète, mouvement réduit, mobile et libération des ressources |
| Nouveau `MYTHOLOGY.md` | Analyse, inventaire, règles d’ajout et vérifications |
| Modifié `index.html` | Chargement des modules après les systèmes de cartes existants et de leur CSS |
| Modifié `package.json` | Commandes de validation du catalogue et du navigateur |

Les fichiers de production des habitants, banques, villages, ressources, unités
et combat ne sont pas modifiés. Les cinq fonctions d’effets existantes ne sont
pas réécrites. Le registre indique la voie `CardGame.play → CardEffects.apply`,
qui conserve ses validations de main, disponibilité, cible et coût.

## Inventaire des images et pouvoirs

Recherche effectuée dans les images du dépôt, le manifeste et les références
de cartes. Les sources trouvées sont dans `assets/cards/fantasy/`.

| Légende demandée | Identifiant stable | Image normale trouvée | Pouvoir |
| --- | --- | --- | --- |
| U Mazzeru | `u-mazzeru` | `u-mazzeru.webp` | Vision des habitants, section 66 |
| A Stregha | `a-stregha` | `a-stregha.webp` | Malédiction de production, section 67 |
| U Stregu | `u-stregu` | Manquante | Non configuré |
| A Fata | `a-fata` | Manquante | Non configuré |
| Anima in Pena | `anima-in-pena` | Manquante | Non configuré |
| L’Orcu | `l-orcu` | Manquante | Non configuré |
| U Magu | `u-magu` | Manquante | Non configuré |
| U Surpatore | `u-surpatore` | Manquante | Non configuré |
| U Lupu Mannaru | `u-lupu-mannaru` | Manquante | Non configuré |
| U Diavule | `u-diavulu` | `u-diavulu.webp` | Colonne brûlée, sections 68–71 |
| A Stregha Bianca | `a-stregha-bianca` | Manquante | Non configuré |
| A Squadra d’Arozza | `squadra-arozza` | `squadra-arozza.webp` | Résurrection, section 72 |
| A Mumma | `a-mumma` | Manquante | Non configuré |
| I Lacrimenti | `i-lacrimenti` | Manquante | Non configuré |
| U Fullettu | `u-fullettu` | Manquante | Non configuré |
| Ochju di Santa Lucia | `oeil-sainte-lucie` | `oeil-sainte-lucie.webp` | Vision des Littoraux, section 73 |

**Aucune des 16 variantes inversées n’existe dans le dépôt.** Pour les cinq
images disponibles, la carte de droite réutilise l’illustration normale avec
un miroir CSS. Pour les onze autres, les deux côtés affichent « Illustration
manquante », sans requête vers un fichier supposé.

Les nouveaux noms demandés sont conservés dans le catalogue. Les identifiants
`u-diavulu`, `squadra-arozza` et `oeil-sainte-lucie` restent ceux des commandes
et decks actuels. Les alias `u-diavule`, `a-squadra-d-arozza` et
`ochju-di-santa-lucia`, ainsi que les noms affichés, permettent les recherches.
L’interface de cartes existante conserve ses libellés actuels.

### Recadrage et textes imprimés

Les cinq fichiers trouvés sont des **cartes complètes**, de 172 à 195 pixels
de large et 241 pixels de haut. Ils ne constituent pas des illustrations
séparées en haute définition. Leur titre, description et icône sont imprimés
dans l’image ; certains textes imprimés contredisent les règles écrites.

La fenêtre illustrée utilise un rectangle normalisé : `x = 0,06`, `y = 0,13`,
`largeur = 0,88`, `hauteur = 0,46`. Il se situe sous le titre et au-dessus de la
description. Le ratio réel du recadrage est conservé. Aucune image n’est
réécrite : la découpe visuelle est réalisée avec une fenêtre CSS masquée.

Seule `.mythology-illustration-crop.is-mirrored` reçoit `scaleX(-1)`.
Les textes HTML, statistiques, cadres et icônes sont hors de cette fenêtre.
Une variante inversée fournie plus tard sera utilisée directement, sans miroir
supplémentaire, avec son propre recadrage éventuel.

## Configuration et limites de confirmation

Chaque fiche contient :

- `id`, `name`, `aliases` ;
- `visuals.normal`, `visuals.reversed`, couleurs principale/secondaire ;
- `gameplay.category`, `description`, `parameters`, `status`, source écrite ;
- `implementation.status`, `effectKey`, `cardId`.

Les catégories possibles sont `invocation`, `enchantement`, `terrain` et
`vision`. Les cinq pouvoirs connus sont classés d’après leurs effets existants.
Cette classification documentaire n’ajoute pas d’unité ni de mécanique.

Pour les onze pouvoirs non confirmés, description, paramètres, catégorie et
liaison d’effet sont **`null`**, avec `status: 'unconfigured'`. Le catalogue
n’invente ni invocation, ni PV, dégâts, coût ou temps de recharge. Une catégorie
doit être définie avec le pouvoir ; elle n’est pas déduite du seul nom.

Les palettes sont indicatives et portent `paletteStatus: 'provisional'`.
Les cinq palettes associées à une image s’accordent à celle-ci ; les autres utilisent le bronze
de l’interface. Ce sont des choix visuels, sans bonus ou malus.

Les durées et dégâts déjà configurables sont des références vers
`Config.cardGame` : durée 120 s, fenêtres de résurrection 180/300 s, dégâts
depuis la Montagne 125. `getGameplay()` résout ces références au moment de
la lecture ; aucune copie de ces valeurs n’est utilisée par un nouveau moteur.
Le facteur 0,5 de la malédiction est confirmé par la section 67 et décrit ici
l’effet actuel, sans modifier `CardEffects.productionMultiplier`.

La résurrection reprend la décision existante sur le village d’accueil,
la capacité et la file d’attente. L’ancienne note de `cards.js` disant que le
lieu de retour reste à définir n’est pas reprise : la section 72 fait foi.
La politique temporaire de départage à distances égales est identifiée
comme telle et reste exécutée uniquement par le moteur existant.

## Ajouter une illustration ou compléter une légende

Modifier sa fiche dans `js/mythology-data.js`, puis recharger la page.

1. Ajouter le véritable fichier au projet avant de renseigner son chemin.
2. Renseigner `normal` ou `reversed` avec `{ src, kind, width, height, crop }`.
   Pour une illustration seule, utiliser `kind: 'illustration'` et `crop: null`.
   Pour une carte complète, vérifier un recadrage excluant tout texte et icône.
3. Après validation du pouvoir, renseigner catégorie, description, paramètres
   et source, puis l’option `powerStatus: 'confirmed'` de la fiche. Tant que le
   comportement n’est pas implémenté, conserver `implemented: false` et
   `effectKey: null` : l’état d’implémentation reste `not-implemented`.
4. Lors d’un futur chantier de gameplay autorisé, ajouter la liaison dans le
   registre d’effets, puis `implemented: true`, et passer par le système de commandes existant. Changer
   une fiche ne doit jamais suffire à contourner les règles de jeu.
5. Relancer les validations des données et des images.

Les identifiants sont stables. L’ajout d’un visuel ne nécessite pas de changer
un pouvoir, et l’ajout de métadonnées ne rend pas une carte jouable.

## Consulter et prévisualiser

```js
Eredita.Config.mythology.entries;
Eredita.Mythology.get('U Diavule');
Eredita.Mythology.getGameplay('u-mazzeru');
Eredita.Mythology.getIllustration('u-mazzeru', 'right');
Eredita.Mythology.report();
Eredita.MythologyEffects.getBinding('u-mazzeru');
```

Sans paramètre d’aperçu, les composants n’ajoutent rien aux écrans actuels. Pour les
inspecter depuis la console du menu, sans jouer de pouvoir :

```js
const preview = document.createElement('dialog');
preview.style.cssText = 'max-width:90vw;max-height:90vh;overflow:auto;background:#15140f';
preview.append(Eredita.MythologyUI.createPair('u-mazzeru'));
document.body.append(preview);
preview.showModal();
// Fermer avec Échap, puis preview.remove().
```

## Tester visuellement le cristal

Lancer le serveur avec `npm start`, puis ouvrir :

**http://localhost:8765/?intro=0&crystal=preview&left=u-mazzeru&right=u-diavule**

Sur GitHub Pages, ajouter la même requête après le chemin `/-redita/` :
`/-redita/?intro=0&crystal=preview&left=u-mazzeru&right=u-diavule`.
Tous les modules et assets sont chargés par chemins relatifs.

Les deux listes permettent de choisir parmi les 16 fiches existantes. Le
cristal prend la couleur principale de chaque côté ; les lignes de facettes
reprennent la couleur secondaire lorsqu’elle existe. Il se charge, se sépare
en deux, puis révèle les composants de cartes existants en environ 4,4 secondes.
**Rejouer**, **Pause/Reprendre**, **Fermer** et **Échap** permettent de le tester.
Choisir **U Stregu** et **A Fata** vérifie le fonctionnement sans pouvoir
configuré et sans image : les états manquants restent indiqués sur les cartes.

Les palettes actuelles sont toutes marquées **provisoires** dans le catalogue.
L’aperçu le rappelle ; il n’ajoute aucune couleur de légende. Une couleur
principale absente ou invalide bloque l’animation et affiche le renfort concerné.
Une couleur secondaire absente, facultative, est signalée ; seules les teintes
principales existantes sont alors utilisées. Une valeur fournie mais invalide
est également signalée et bloque l’aperçu. Le résolveur accepte les couleurs
hexadécimales à six chiffres, comme les palettes actuelles du catalogue.

Accès depuis la console du navigateur, sans modifier l’URL :

```js
const preview = Eredita.MythologyUI.openCrystalPreview({
  leftId: 'u-mazzeru', rightId: 'u-diavule'
});
await preview.crystal.ready;
```

Commandes à exécuter séparément, selon l’étape à inspecter :

```js
preview.crystal.pause();
preview.crystal.seek(2.4); // inspecter une étape, en pause
preview.crystal.play();  // rejouer depuis le début
preview.close();
```

`createPair('u-mazzeru', { rightId: 'u-diavule' })` réutilise la même paire
avec deux légendes différentes. L’inversion éventuelle reste limitée à
l’illustration de droite ; aucun texte ou pictogramme n’est retourné.

`Mythology.getCrystalPalette(leftId, rightId)` lit les visuels exclusivement
dans `mythology-data.js`, sans consulter l’état des pouvoirs. Le rendu séparé
`mythology-crystal.js` importe la copie locale de Three.js déjà utilisée par le
projet, uniquement à l’ouverture d’un aperçu. L’interface reste dans
`mythology-ui.js`, les styles dans `mythology.css`, le registre
`mythology-effects.js` reste inchangé. Il n’y a pas de second catalogue.

Les réglages de présentation sont centralisés dans `Config.mythology.crystal` :
durées, 48 particules, définition limitée à 1,5 et cadence de 30 images/s sur
petit écran, 60 sur ordinateur. La boucle s’arrête à la fin et quand l’onglet est
masqué. Le mouvement réduit affiche immédiatement les cartes et un cristal
fixe. La fermeture libère le contexte WebGL, les géométries et les écouteurs.
L’aperçu ne joue aucune carte et ne change ni la main, ni les ressources,
ni les règles. Il ne remplace aucun écran du jeu.

## Vérification

```sh
npm run test:mythology
npm run test:mythology-browser
npm run test:crystal
npm test
```

La suite de données compare notamment l’état complet de la partie après chacun
des cinq effets existants, avec et sans chargement du catalogue. Les résultats
doivent rester identiques. Elle contrôle aussi les chemins WebP et dimensions,
les identifiants, les valeurs non configurées et le recours à une vraie variante
inversée lorsqu’elle est fournie.

La suite navigateur sert le jeu sous `/-redita/`, inspecte les transformations
CSS, les recadrages, les états manquants et l’écran mobile 390 × 844, puis ouvre
les decks existants et lance un entraînement. Les captures peuvent être gardées :

```sh
EREDITA_MYTHOLOGY_PREVIEW_DIR=/tmp/eredita-mythology npm run test:mythology-browser
EREDITA_CRYSTAL_PREVIEW_DIR=/tmp/eredita-crystal npm run test:crystal
```

Validation du 20 octobre 2026 : suite existante du jeu, huit tests du catalogue
et parcours navigateur réussis. Les cinq illustrations ont été inspectées
visuellement, ainsi que la paire gauche/droite et le rendu mobile. Aucun casque
n’est nécessaire pour cette préparation de données et de composants web.
L’aperçu du cristal a également été validé dans Chrome : fin naturelle de
l’animation, pause, relecture, deux pouvoirs non configurés, couleur principale
manquante, mouvement réduit, petit écran simulé et fermeture avec Échap.
