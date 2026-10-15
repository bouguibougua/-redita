# Révélation du logo du menu Eredità

Au chargement, le logo du menu principal apparaît de gauche à droite pendant
1,5 seconde, à sa position et à sa taille habituelles. Le décor reste visible
et animé ; les boutons sont immédiatement utilisables. Il n’y a plus d’écran
d’introduction séparé, de bouton de passage ou d’effets colorés avant le logo.

Le logo reste **`assets/eredita-logo.png`**, 2172 × 724, avec son ratio et son
alpha d’origine. Il n’est ni réécrit ni remplacé par du texte.

## Rendu et comportement

- `js/intro-paint.js` dessine le PNG dans un canvas transparent, avec le même
  masque fibreux de gauche à droite et le même reflet métallique chaud.
- Le canvas est placé dans `#menu-title`, exactement sur l’image `.menu-logo`.
  Les deux partagent les mêmes ombres CSS. L’image conserve son texte alternatif.
- `js/intro.js` gère le chargement, l’horloge, les relances et le redimensionnement.
  À la fin, l’image du menu remplace le canvas sans transition de position ou de taille.
- `css/intro.css` gère cette substitution locale. Aucun élément du menu ne devient
  `inert` et l’animation ne déplace pas le focus ni ne bloque les clics ou touches.
- `Config.intro` centralise la durée, la couleur du reflet, la résolution et la
  cadence. Le ratio de pixels est plafonné à 1,5, le grand côté à 1920 pixels,
  avec une cadence cible de 60 images/s sur ordinateur et 30 sur mobile.

Une page masquée suspend l’horloge. Quitter le menu interrompt la révélation et
restaure son logo. Le retour au menu n’impose pas une nouvelle animation.
Les relances sont refusées en partie, dans un sous-menu ou en VR.

Avec `prefers-reduced-motion: reduce` ou les animations du menu en pause, le logo
est immédiatement statique. Activer ces réglages pendant la révélation la termine.
Sans Canvas 2D, sans JavaScript ou après une erreur de chargement, l’image du menu
sert de repli. Le chargement du logo ne bloque jamais la navigation.

## Relancer et inspecter

- **F9** au menu principal : rejouer la révélation.
- **Échap** : afficher immédiatement le logo complet.
- `/-redita/?intro=0` : logo statique dès l’ouverture.
- `/-redita/?intro=preview&intro-time=0.75` : figer la révélation à mi-parcours.
- Console : `Eredita.Intro.replay()`, `Eredita.Intro.seek(0.75)`,
  `Eredita.Intro.resume()`, `Eredita.Intro.skip()`.
- Diagnostic : `Eredita.Intro.diagnostics`.

Les chemins CSS, JS et PNG restent relatifs, compatibles avec GitHub Pages.
Aucun framework ou étape de compilation n’est ajouté.

## Vérifications

```sh
npm run test:intro
npm run test:menu
```

Le test d’introduction vérifie la révélation transparente dans le menu, le PNG
final, la continuité de position et de taille, la navigation pendant l’animation,
les relances, le focus, le mouvement réduit et les replis Canvas/asset.
Il couvre également le mobile et les chemins `/-redita/`.

La variable `EREDITA_INTRO_PREVIEW_DIR` permet d’enregistrer les captures du test.
