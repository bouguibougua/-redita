# Boutique illustrée Eredità

Les trois PNG ont été produits avec l’outil intégré ImageGen à partir de la composition fournie par le concepteur, adaptée à sa demande à la direction artistique existante. Les prompts exacts sont dans [generation.json](generation.json).

- `art-master.png` : composition complète sans texte ; sert aussi à la clôture fixe.
- `background.png` : décor vidé de ses marchandises.
- `merchandise.png` : calque RGBA transparent, positions conservées.

`js/shop-art.js` définit les silhouettes dans un repère de 1672 × 941. Chaque objet utilise son propre masque SVG et réutilise la même texture. Les zones transparentes sont exclues des clics par une lecture alpha unique au chargement. Aucun rectangle de mur n’est animé. La clôture reste devant les animaux.

`js/illustrated-shop.js` ne possède ni banque ni prix : il consulte les devis existants et appelle le contrôleur, y compris sa validation par l’hôte en réseau. `js/config.js` centralise les lots et paramètres de présentation. Les pièges restent du catalogue inactif. La vue Gestion conserve les anciennes commandes, dont les compagnons et l’abattage.

Vérifications : `npm run test:shop`. Captures optionnelles : `EREDITA_SHOP_PREVIEW_DIR=eredita3D/previews/shop npm run test:shop`. Les captures de test utilisent une partie isolée aux commerces débloqués et aux stocks préparés, sans changer les valeurs initiales du jeu.

L’interface illustrée cible le navigateur desktop et tactile ; le tableau XR existant continue d’employer les mêmes commandes économiques. Cette interface n’a pas fait l’objet d’une validation physique sur Meta Quest.
