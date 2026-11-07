# ALTER EGO — Petit assistant local

Prototype privé pour poser une question simple, lire les informations visibles
d’une photo et rechercher des informations dans Wikipédia. Le modèle
SmolVLM-256M est installé sur la machine du SaaS et exécuté avec llama.cpp.
Aucune API d’IA externe ni abonnement à un modèle n’est utilisé.

## Démarrer sur une machine locale

Prérequis : Node.js 24, Docker, environ 1 Go de disque disponible pour le moteur
et les poids et au moins 2 Go de RAM disponibles pour le modèle. La consommation
réelle dépend de la taille des images et de la machine.

```sh
npm run model:install
npm run model:start
cp .env.example .env.local
# Dans .env.local, définir ASSISTANT_PASSWORD (12 caractères minimum).
npm start
```

L’application écoute sur http://127.0.0.1:3000. Aucun paquet npm n’est nécessaire
pour le produit. Le premier téléchargement nécessite Internet, puis le texte et
les photos sont traités localement, même sans réseau. La recherche Wikipédia,
elle, nécessite Internet. Le téléchargement initial du moteur Docker est distinct
du téléchargement des poids.

Le script model:start démarre uniquement le moteur local, sur 127.0.0.1:8081.
Le modèle est rechargé au redémarrage de Docker grâce à restart unless-stopped.
L’application doit également rester démarrée. Arrêter le modèle :

```sh
npm run model:stop
```

## Accès depuis Android et hébergement

Un accès distant demande une machine allumée, un proxy HTTPS et PUBLIC_ORIGIN
égal à l’URL réelle. Le mot de passe reste côté serveur. Le modèle ne doit
jamais être exposé directement sur Internet. Le fichier compose.yaml prépare
cette séparation : modèle sur un réseau interne, application accessible seulement
sur un port local destiné au proxy HTTPS.

```sh
# Les poids doivent déjà être téléchargés.
# Configurer PUBLIC_ORIGIN et ASSISTANT_PASSWORD par un moyen sécurisé.
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local up -d
```

Ces commandes d’hébergement ne sont à exécuter qu’après validation humaine du
déploiement cible. Aucun serveur de production n’a été créé par cette version.
Le logiciel est gratuit ; un serveur permanent gratuit n’est pas fourni par le
dépôt. Les environnements gratuits de fonctions web ne maintiennent pas ce
moteur en mémoire en continu. Voir [HOSTING.md](docs/HOSTING.md).

## Fonctions et limites

- Texte : petites questions et explications ; aucun outil d’exécution de commandes.
- Photo : JPEG, PNG ou WebP, 3 Mo maximum. Décrire des éléments visibles ; ne pas
  compter sur ce petit modèle pour une transcription précise ou un raisonnement fiable.
- Internet : recherche dans Wikipédia en français, avec liens réels fournis par
  l’API ; ce n’est pas un moteur de recherche généraliste de tout le web.
- Une demande à la fois, réponse bornée à 180 tokens, limite locale de 20 demandes
  par heure pour préserver le processeur. Ce n’est pas un quota d’API payante.
- SmolVLM-256M a surtout été entraîné pour l’anglais. Il peut répondre en anglais,
  se tromper en français et mal interpréter des détails visuels.
- Les résultats ne sont pas sauvegardés sur disque. Les photos sont transmises du
  téléphone au serveur privé, puis au moteur local ; elles ne sont pas envoyées à
  un service d’IA distant. La recherche envoie uniquement la question à Wikipédia.
- Sessions d’une heure en mémoire, cookie HttpOnly et SameSite=Strict, protection
  d’origine, limite de tentatives de connexion. Redémarrer le serveur déconnecte.

## Vérification

```sh
npm test
npm run check
git diff --check
```

Les tests automatisés utilisent un faux fournisseur pour vérifier les accès,
les erreurs et les limites de façon reproductible. Les essais réels du modèle
sont distingués dans [VALIDATION.md](docs/VALIDATION.md).

## Documents

- [Produit](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Modèle installé](docs/LOCAL_MODEL.md)
- [Roadmap](docs/ROADMAP.md)
- [Rôles et règles](AGENTS.md)
