# Jouer à Eredità sur deux ordinateurs

## Sur le même réseau Wi-Fi

1. Installez Node.js sur l'ordinateur qui héberge la partie.
2. Ouvrez un terminal dans le dossier du projet.
3. Lancez `npm start`.
4. Sur l'ordinateur hôte, ouvrez `http://localhost:8765`.
5. Relevez l'adresse IPv4 de l'hôte avec `ipconfig` (par exemple `192.168.1.25`).
6. Sur le second ordinateur, ouvrez `http://192.168.1.25:8765` en remplaçant l'adresse par celle de l'hôte.
7. Le premier joueur choisit **Créer un salon** et transmet le code affiché.
8. Le second saisit ce code puis choisit **Rejoindre**.

Windows peut demander l'autorisation du pare-feu au premier lancement : autorisez Node.js sur les réseaux privés.

## Sur Internet

Le site et le serveur doivent être déployés ensemble sur un hébergeur qui accepte Node.js et les WebSockets. GitHub Pages seul ne peut pas exécuter `server.js`.

### Déploiement du prototype sur Render

1. Mettre **tout le projet** dans un dépôt GitHub, avec `render.yaml`, `package.json`, `server.js`, `index.html`, `js/`, `css/` et `assets/` à la racine.
2. Créer un compte sur Render et connecter ce dépôt GitHub.
3. Dans Render, choisir **New → Blueprint**, sélectionner le dépôt, vérifier que le service `eredita-multijoueur` est sur le plan **Free**, puis choisir **Deploy Blueprint**.
4. Attendre que le service affiche **Live** et ouvrir son adresse publique `https://…onrender.com`.
5. Le premier joueur clique sur **Créer un salon** et transmet le code affiché. Le second ouvre **la même adresse publique**, saisit le code et clique sur **Rejoindre**.

Le serveur utilise automatiquement le port fourni par Render. Il faut ouvrir le site avec l'adresse `https://…onrender.com`, jamais avec `localhost` pour une partie à distance. Le navigateur utilisera alors `wss://` pour la connexion multijoueur.

Sur le plan gratuit, le premier chargement après une période d'inactivité peut prendre environ une minute. Les salons sont conservés en mémoire : un redémarrage ou un nouveau déploiement interrompt les parties en cours.

## Fonctionnement

- le créateur du salon joue Rouge ;
- le joueur qui rejoint joue Bleu ;
- Rouge héberge la simulation officielle ;
- Bleu envoie ses ordres au serveur ;
- le serveur refuse les commandes visant le territoire de l'autre joueur ;
- le mode **Jouer en local** reste disponible.
