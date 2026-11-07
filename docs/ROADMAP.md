# Roadmap — ALTER EGO

## Première application : suivi calories

- Saisie manuelle par portion, journée et repas.
- Totaux, modification, suppression, objectif facultatif et export.
- Stockage privé persistant, tests de concurrence et de redémarrage.
- Accueil dédié, indépendant du modèle IA.

## Assistant complémentaire conservé

- Organisation des dix rôles et règles Git.
- Interface privée utilisable depuis un navigateur Android.
- Question texte et analyse de photo avec un modèle installé sur le serveur.
- Recherche Wikipédia avec sources réelles, sans API d’IA externe.
- Installation des poids avec vérification SHA-256 et moteur isolable par Docker.
- Tests reproductibles d’accès, de validation des entrées et de limites.

Les essais réels, leurs limites et l’état de la vérification navigateur sont
consignés dans [VALIDATION.md](VALIDATION.md).

## Ensuite

| Priorité | Travail | Condition de fin |
| --- | --- | --- |
| 1 | Essayer le journal et sauvegarder le volume privé. | Saisie des portions claire, reprise des données et export vérifiés sur l’usage réel. |
| 2 | Choisir une machine permanente et préparer HTTPS. | CPU, RAM, coût et disponibilité réellement vérifiés ; secrets configurés hors Git. |
| 3 | Mettre en service après validation humaine. | Version exacte approuvée, authentification vérifiée, modèle non exposé. |
| 4 | Construire le catalogue privé des prochaines applications. | Fiches administrables, recherche et liens réels. |
| 5 | Étendre la recherche à davantage de sources si utile. | Sources fiables, limites et conditions d’accès documentées. |

Aucun hébergement permanent gratuit, connexion de production ou qualité générale
du modèle n’est présumé. Le budget reste sans abonnement d’IA.
