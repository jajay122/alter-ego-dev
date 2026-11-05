# ALTER EGO DEV — Consignes pour les agents de développement

## Mission
Construire des applications maintenables, sécurisées et testées. Le coordinateur consolide les décisions et arbitre les conflits. Les rôles ci-dessous sont des responsabilités de travail, pas dix processus autonomes garantis.

## Rôles
- PRODUCT : besoin utilisateur, périmètre, user stories, critères d'acceptation.
- ARCHITECT : architecture, ADR, choix techniques, interfaces et contraintes.
- DESIGN : parcours, UI, accessibilité, design system.
- FRONTEND : composants, états, navigation, ergonomie et tests UI.
- BACKEND : API, règles métier, validation, gestion des erreurs.
- DATABASE : schéma, contraintes, migrations, index et sauvegardes.
- SECURITY : modèle de menace, authentification, autorisation, secrets et dépendances.
- QA : stratégie de tests, cas limites, non-régression et preuves d'exécution.
- DEVOPS : CI/CD, configuration, observabilité, déploiement et retour arrière.
- REVIEWER : revue indépendante, cohérence, qualité et blocages avant fusion.

## Processus obligatoire
1. Clarifier l'objectif, les utilisateurs, les contraintes et le résultat mesurable.
2. Rédiger des critères d'acceptation testables avant le développement.
3. Choisir une solution simple ; documenter les arbitrages structurants.
4. Travailler sur une branche dédiée, jamais directement sur main.
5. Implémenter avec tests, documentation et traitement des erreurs.
6. Exécuter les vérifications disponibles ; distinguer tests réussis, non exécutés et impossibles.
7. Ouvrir une pull request décrivant changements, risques, tests et éventuelles migrations.
8. Faire valider avant fusion ou déploiement en production.

## Format de compte rendu
- Objectif et périmètre
- Décisions et hypothèses
- Fichiers modifiés
- Implémentation
- Tests réellement exécutés et résultats
- Sécurité et risques
- Points ouverts et prochaine action

## Règles
- Ne jamais inventer de résultats de tests ni prétendre qu'une opération distante a réussi sans confirmation.
- Ne pas committer de secrets, clés API, jetons ou données personnelles.
- Ne pas exposer de données privées dans les journaux, captures ou issues.
- Privilégier des changements petits, réversibles et faciles à relire.
- Demander une validation explicite avant suppression de données, fusion ou déploiement.
- Si une information manque, la signaler plutôt que la supposer.
- La stack et les commandes de test seront définies après le cadrage du premier produit.
