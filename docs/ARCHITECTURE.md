# Architecture — ALTER EGO DEV

## Statut du cadrage

Dépôt examiné le 5 novembre 2026 : `jajay122/alter-ego-dev`, branche par défaut
`main`, commit de référence `874496733786137b69990e428b3c3a3dcbed4ecc`.
L’arborescence complète ne contient que `README.md` (`# alter-ego-dev`) :
aucune application, instruction AGENTS existante, dépendance, migration, suite
de tests ou configuration CI versionnée. Inspection réalisée par le connecteur
GitHub ; aucun checkout Git exploitable n’était monté dans `/workspace`.

Ce cadrage ajoute quatre fichiers sur la branche `docs/alter-ego-dev` pour revue
avant intégration, en préservant le README. Aucun choix de stack n’est nécessaire
à ce stade. La liste des branches indique `main` non protégée ; les règles
effectives et la protection des futurs déploiements devront être vérifiées avant
leur mise en place.

## Objectif

Permettre au propriétaire de piloter depuis Android la conception, la revue et
la livraison d’applications web et mobiles avec GitHub et Codex dans ChatGPT.
Le téléphone sert d’interface de pilotage ; l’exécution dépend des capacités
réellement disponibles dans l’environnement connecté.

L’abonnement ChatGPT Plus n’établit pas à lui seul la disponibilité d’un terminal,
de tâches simultanées, de services d’hébergement ou de clés API. Vérifier les
accès utiles au moment où ils deviennent nécessaires.

## Organisation du travail

```text
Propriétaire sur Android
        |
        v
ChatGPT / Codex — tâche cadrée et rôle pilote
        |
        v
Dépôt GitHub — branche dédiée et documents versionnés
        |
        v
Contrôles disponibles — revue — pull request
        |
        v
Version candidate — approbation humaine explicite — production
```

Ce schéma décrit une organisation cible, pas des intégrations déjà installées.
Les dix responsabilités et les règles de passage de relais sont définies dans
[AGENTS.md](../AGENTS.md). Les rôles peuvent être exercés successivement.

## Structure documentaire à placer à la racine du dépôt

```text
AGENTS.md
docs/
  ARCHITECTURE.md
  ROADMAP.md
  DECISIONS.md
```

Le README existant est préservé. Aucun dossier
de frontend, backend ou base de données n’est créé à ce stade.

## Principes techniques

- Commencer par le besoin et les contraintes, puis choisir la solution la plus
  simple compatible avec eux. Réutiliser les conventions pertinentes du dépôt.
- Séparer clairement interface, logique métier et accès aux données lorsque ces
  composants deviennent nécessaires, sans imposer plusieurs services.
- Privilégier une expérience utilisable sur petit écran et des validations
  courtes, reproductibles et consultables depuis Android.
- Garder les secrets hors du dépôt et contrôler les autorisations côté serveur
  si une application comporte un serveur.
- Prévoir un environnement de validation et une récupération adaptée avant toute
  livraison en production ; ne rien provisionner pendant ce cadrage.

## Choix encore ouverts

| Sujet | État | Éléments nécessaires pour décider |
| --- | --- | --- |
| Dépôt et branche de référence | Identifiés | `jajay122/alter-ego-dev`, `main` ; README uniquement au commit examiné. |
| Premier produit | Non défini | Utilisateurs, problème, parcours et critères d’acceptation. |
| Web responsive, PWA ou mobile natif | À étudier | Installation, hors-ligne, notifications, matériel et distribution. |
| Langages et frameworks | Non choisis | Existant, besoins, compétences, maintenance et tests. |
| API, stockage et authentification | Selon besoin | Données, permissions, contraintes et intégrations. |
| CI et hébergement | Non configurés par ce cadrage | Outillage existant, budget, accès et validation de production. |

Tout choix structurant sera enregistré dans [DECISIONS.md](DECISIONS.md).
