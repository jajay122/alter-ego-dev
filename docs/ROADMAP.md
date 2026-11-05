# Roadmap — ALTER EGO DEV

## Situation actuelle

Le dépôt `jajay122/alter-ego-dev` a été examiné : sa branche `main` ne contient
que `README.md` au commit de référence décrit dans l’architecture. Le cadrage
ajoute quatre documents sur `docs/alter-ego-dev` pour revue avant intégration.
Aucune application n’est construite et aucune infrastructure n’est provisionnée.

Les étapes suivantes expriment un ordre de travail, sans engagement de date.
Seule la préparation documentaire est autorisée dans la demande actuelle.

| Étape | Pilote et contributions | Livrables | Critères de sortie | Statut |
| --- | --- | --- | --- | --- |
| 0. Examiner le dépôt et poser le cadre | ARCHITECT, REVIEWER | Inventaire réel, branche documentaire, quatre documents adaptés. | Dépôt identifié, instructions respectées, diff relu, contrôles disponibles exécutés et résultats consignés. | Dépôt examiné ; documents contrôlés et préparés pour revue sur branche dédiée. |
| 1. Définir le premier produit | PRODUCT, DESIGN | Problème, utilisateurs, périmètre minimal, parcours Android, critères d’acceptation. | Périmètre et priorités validés par le propriétaire. | À lancer sur demande. |
| 2. Décider de l’architecture minimale | ARCHITECT, FRONTEND, BACKEND, DATABASE, SECURITY | Choix web/mobile, composants nécessaires, contrats, données, accès et décisions. | Choix justifiés, risques connus, simplicité et faisabilité vérifiées. | En attente de l’étape 1. |
| 3. Préparer les moyens de validation | DEVOPS, QA, SECURITY | Commandes reproductibles, CI appropriée, gestion des secrets, procédure de livraison. | Contrôles exécutables, résultats observés, production protégée par une validation humaine. | Après autorisation de mise en œuvre. |
| 4. Construire un premier parcours complet | FRONTEND, BACKEND, DATABASE, DESIGN | Incrément limité couvrant un besoin de bout en bout. | Critères d’acceptation satisfaits, contrôles réussis, revue effectuée, limites documentées. | Hors périmètre actuel. |
| 5. Valider puis livrer | QA, SECURITY, REVIEWER, DEVOPS | Version candidate, preuves, procédure de retour arrière et compte rendu. | Approbation humaine explicite de la version et de la cible avant production ; vérification après livraison. | Hors périmètre actuel. |

## Prochaine action

Relire la pull request documentaire vers `main`, puis intégrer le cadrage si son
contenu convient.
Définir ensuite, sur demande, le premier produit : utilisateurs, problème à
résoudre, parcours prioritaire et critères d’acceptation. Les tests applicatifs
sont absents du dépôt examiné ; aucune réussite de test applicatif n’est revendiquée.

## Format d’une tâche future

- Objectif utilisateur et critères d’acceptation observables.
- Rôle pilote, contributions nécessaires et dépendances.
- Branche, fichiers concernés et responsable d’écriture pour chaque fichier.
- Livrables, contrôles à exécuter et preuves attendues.
- Risques, décisions à consigner et conditions de passage au rôle suivant.

## Rituel de revue depuis Android

Présenter des changements courts avec un résumé lisible, les liens vers les
fichiers, les résultats réels des contrôles et l’action humaine attendue si elle
est nécessaire. Ne pas confondre validation du périmètre, revue de code,
intégration et autorisation de déploiement.
