# ALTER EGO — Portail privé d’applications

L’accueil regroupe vos applications : suivi calories sur /calories et petit
assistant local sur /assistant. Le suivi est un module du SaaS, pas le SaaS entier.
Le journal permet de noter les portions et de retrouver ses entrées après redémarrage.

## Démarrage local

Prérequis pour le suivi : Node.js 24. Aucun paquet npm, modèle IA ou compte
externe n’est nécessaire.

```sh
cp .env.example .env.local
# Définir ASSISTANT_PASSWORD dans .env.local (au moins 12 caractères).
npm start
```

Ouvrir http://127.0.0.1:3000. Le même mot de passe protège les deux applications.
Les données du journal sont écrites dans .data/calories.json, hors Git, ou dans
le dossier désigné par CALORIES_DATA_DIR.

## Fonctionnalités

- Journée choisie selon la date locale du téléphone.
- Ajout d’un aliment ou d’un plat, kcal de la portion et repas.
- Totaux quotidiens et par repas, avec une décimale.
- Modification et suppression avec confirmation.
- Objectif quotidien facultatif, saisi par le propriétaire et retirable.
- Export JSON de tout le journal et de l’objectif.
- Sauvegarde serveur, refus d’accès sans session, protection contre les doublons
  après une nouvelle tentative et contre les corrections obsolètes d’un autre onglet.

Les valeurs sont saisies manuellement : pas d’estimation par photo, de base
alimentaire intégrée, de calcul de besoins ou de conseil nutritionnel automatique.
Aucun objectif n’est imposé. Ce journal enregistre ce que le propriétaire saisit.

## Stockage

Le fichier est enregistré par remplacement atomique après synchronisation du
contenu sur disque, avec des permissions privées. Un journal illisible est
signalé et n’est jamais silencieusement remplacé. Le stockage est prévu pour
un seul processus serveur et un seul propriétaire, avec 20 000 entrées maximum.

Le bouton Exporter télécharge un JSON privé. Conserver également une sauvegarde
du volume avant une mise à jour. La restauration/importation depuis l’interface
n’est pas incluse dans cette version. Ne jamais publier le dossier .data ni un
export dans Git.

## Docker et accès Android

Le fichier compose.yaml fournit un volume persistant journal-data. Le modèle IA
est optionnel : le profil assistant l’active, tandis que le suivi fonctionne seul.
L’image crée le dossier de données avec le propriétaire node lors de la copie.

Avant toute mise en production : choisir une machine, configurer HTTPS,
PUBLIC_ORIGIN et le mot de passe par un moyen sécurisé, puis obtenir la validation
humaine de la version et de la cible. Le port est local par défaut.

```sh
# Après configuration et approbation du déploiement :
docker compose --env-file .env.local up -d --build
# Le volume est conservé lors d’un arrêt sans l’option -v.
```

Aucune machine ou adresse de production n’est créée par ce dépôt. Le logiciel
est gratuit ; un hébergement permanent gratuit n’est pas fourni.

## Petit assistant optionnel

L’assistant sur /assistant peut utiliser SmolVLM-256M installé côté serveur pour
texte et photo, avec recherche Wikipédia. Il n’est pas utilisé pour les calculs
du journal. Voir [LOCAL_MODEL.md](docs/LOCAL_MODEL.md) pour les limites du modèle.

```sh
npm run model:install
npm run model:start
# Ou, dans une installation Compose approuvée :
# docker compose --env-file .env.local --profile assistant up -d
```

## Vérification

```sh
npm test
npm run check
git diff --check
```

Pour le parcours navigateur, installer Playwright et Chromium dans un environnement
de test, puis exécuter node scripts/calories-browser-check.mjs. La variable
PLAYWRIGHT_MODULE peut désigner un module installé hors dépôt. Le script crée
un journal temporaire avec des données de test, sans utiliser les données réelles.
Le contrôle de l’assistant reste dans scripts/browser-check.mjs.

- [Suivi calories : périmètre](docs/CALORIES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Résultats de validation](docs/VALIDATION.md)
- [Rôles et règles](AGENTS.md)

## Construction des fonctions nutritionnelles

La [recherche documentée](docs/research/NUTRITION_RESEARCH.md) compare cinq
applications, Open Food Facts/Ciqual/USDA et des travaux scientifiques. Le
[plan technique](docs/research/NUTRITION_DATA_PLAN.md) prépare catalogue, photo
assistée et recherche web sourcée. Ces connecteurs ne sont pas encore implémentés.
