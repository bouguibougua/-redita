# U Fullettu — intégration du modèle fourni

Le personnage original et sa lanterne sont conservés dans Downloads, sans modification. Leurs empreintes SHA-256 figurent dans `../logs/fullettu-validation.json`.

Le modèle de jeu `../../assets/models/fullettu.glb` et `../exports/fullettu.glb` sont identiques : 2 397 420 octets, 12 866 triangles (personnage 9 405, lanterne 3 461), deux meshes, deux matériaux, un squelette. La texture du personnage est réduite à 2 048 px, celle de la lanterne à 1 024 px. La lanterne garde sa silhouette et ses UV après décimation ; elle est un objet séparé parenté à l’os `mixamorig:LeftHand`.

Quatre animations simples sont créées sur le squelette fourni : `Repos` (2 s), `Bonds` (2/3 s, boucle), `Recolte` (3 s, main droite vers l’avant puis derrière le dos) et `Mort` (1,75 s, adaptée à la durée visuelle existante en jeu). Les clips sont des poses animées par script, sans capture de mouvement ni simulation du tissu. La cape peut masquer la main lorsqu’elle passe derrière le dos ; aucun objet récolté n’est ajouté dans la main.

Le vol garde ses règles existantes : ressources transférées depuis la banque ennemie directement à la banque locale alliée. Le rendu suit son compteur existant ; il ne détruit pas les cultures et ne change ni vitesse, ni cadence, ni statistiques. La géométrie et les textures sont partagées entre follets ; les poses et matériaux restent propres à chaque instance. Les performances en casque Quest 3 physique restent à mesurer.

Régénération avec Blender 5.1.1 installé :

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python eredita3D/scripts/prepare_fullettu.py
```

Vérification navigateur : `npm run test:fullettu`.

Aperçus : `../previews/fullettu_repos.png`, `fullettu_bond.png`, `fullettu_recolte.png`, `fullettu_main_dos.png`, `fullettu_mort.png`, `fullettu_in_game.png`, `fullettu_harvest_in_game.png`.
