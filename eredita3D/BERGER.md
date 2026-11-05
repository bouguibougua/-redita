# Berger fourni — Eredità

Source originale : `models/berger-source.glb` (fichier « berger 3d.glb » fourni par le concepteur).
SHA-256 : `289c3ae4ea146bf85c230d42f91560b53a0147abc853493a229de001a73c6d50`.

Le squelette natif de 80 os et les 10 897 triangles sont conservés. La texture est réduite de 4096 à 1024 pixels pour le plateau. Le modèle est normalisé à 1,80 m avant l’échelle du moteur.

Animations locales Blender : Repos (2 s), Marche (1 s), Traite (3 s), Frappe (1 s, adaptée à 0,65 s par le moteur) et Mort (1,8 s, adaptée à la durée visuelle du jeu). La traite fléchit les genoux, maintient les pieds et fait alterner les mains. La cape suit le squelette existant, sans simulation de tissu.

`models/berger.blend` contient le modèle, les textures intégrées et les cinq actions éditables. `scripts/prepare_shepherd.py` reconstruit le GLB et les aperçus avec Blender 5.1 :

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python eredita3D/scripts/prepare_shepherd.py -- --source eredita3D/models/berger-source.glb --output-dir /tmp/eredita-berger
```

Le jeu utilise `assets/models/berger.glb` et `assets/generated/berger-v1.png`. Le contrôleur `js/shepherd-model.js` partage les géométries et textures, clone les squelettes et matériaux, fige les animations en pause et libère les ressources propres aux instances. L’apparence suit le métier Berger ; l’action Traite suit uniquement la phase de travail de la tâche Élevage. Les caractéristiques et rendements ne changent pas.

Validation : `npm run test:shepherd` ; mesures et provenance dans `logs/berger-validation.json`, aperçus dans `previews/berger-*.png`.
