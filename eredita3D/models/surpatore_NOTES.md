# U Surpatore — forme vampire fournie

Le fichier source `fantasy vampire 3d model.glb` dans Downloads est uniquement lu, sans modification. Son SHA-256 est `73ad1f83d37afaf31a717a3d0c9a605ed02a6c8e2755207e35451f515c42aabc`.

Le GLB de jeu `../../assets/models/surpatore_vampire.glb` et `../exports/surpatore_vampire.glb` sont identiques : 1 910 776 octets, 8 156 triangles, un mesh, un matériau avec texture JPEG 2 048 px et un squelette. Le modèle est normalisé à 1,80 m de haut et orienté face au déplacement du jeu. La géométrie et les textures sont partagées entre instances ; les squelettes et matériaux sont indépendants.

La bouche est fermée dans le mesh de base. Le script referme la géométrie de la mâchoire originale sur 420 sommets, puis ajoute un os `mixamorig:Jaw` au squelette fourni. Cet os ouvre la bouche pendant le coup de griffe et revient à sa position fermée ensuite. Ce n’est pas une image ni un masque posé sur le visage. La fermeture conserve les UV et la texture d’origine ; les plis des joues restent une approximation de déformation, sans sculpture faciale manuelle.

Les quatre clips sont `Repos` (2 s), `Marche` (1 s), `Griffe` (1 s, lecture visuelle adaptée à 0,9 s en jeu) et `Mort` (1,75 s, adaptée à la durée de mort existante). La griffe droite monte puis descend en travers du torse ; la bouche s’ouvre pendant ce geste. Les animations sont créées par script sur le squelette existant, sans simulation du manteau ni capture de mouvement.

Les règles d’U Surpatore, avec les nouvelles statistiques validées du vampire : il apparaît d’abord en sanglier ; après sa première mort, il devient le vampire fourni avec 40 PV, 11 dégâts et la vitesse existante. Une seconde mort le retire. Le modèle n’est chargé sur la figurine que pour `mythologyForm: vampire`.

Régénération :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python eredita3D/scripts/prepare_surpatore.py
```

Test navigateur : `npm run test:surpatore`.

Aperçus dans `../previews/` : `surpatore_repos.png`, `surpatore_marche.png`, `surpatore_griffe_haute.png`, `surpatore_attaque.png`, `surpatore_mort.png`, `surpatore_bouche_fermee.png`, `surpatore_bouche_ouverte.png`. Le journal de validation est `../logs/surpatore-validation.json`. Les performances sur Quest 3 physique restent à mesurer.
