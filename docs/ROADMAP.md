# Roadmap — ALTER EGO DEV

## Situation actuelle

Le cadre des rôles (PR nº 1), le portail privé (PR nº 3), le budget gratuit
(PR nº 4) et le cadrage de Vie parallèle (PR nº 5) sont intégrés à `main`.
Vie parallèle est la première application du portail, avec des modèles
génératifs gratuits sous quotas. Le catalogue est dans [APPLICATIONS.md](APPLICATIONS.md)
et le plan de réalisation dans [VIE_PARALLELE_PLAN.md](apps/VIE_PARALLELE_PLAN.md).
Aucune application n’est construite et aucune infrastructure n’est provisionnée.

Les étapes suivantes expriment un ordre de travail, sans engagement de date.
Seule la préparation documentaire est autorisée dans la demande actuelle.

| Étape | Pilote et contributions | Livrables | Critères de sortie | Statut |
| --- | --- | --- | --- | --- |
| 0. Examiner le dépôt et poser le cadre | ARCHITECT, REVIEWER | Inventaire réel, branche documentaire, quatre documents adaptés. | Dépôt identifié, instructions respectées, diff relu, contrôles disponibles exécutés et résultats consignés. | Terminé : PR nº 1 intégrée ; quatre documents présents sur main. |
| 1. Définir le premier produit | PRODUCT, DESIGN | Problème, utilisateurs, périmètre minimal, parcours Android, critères d’acceptation. | Périmètre et priorités validés par le propriétaire. | Cadrage du portail intégré ; Vie parallèle identifiée comme première application. |
| 2. Décider de l’architecture minimale | ARCHITECT, FRONTEND, BACKEND, DATABASE, SECURITY | Choix web/mobile, composants nécessaires, contrats, données, accès et décisions. | Choix justifiés, risques connus, simplicité et faisabilité vérifiées. | En cours : plan de réalisation proposé ; fournisseurs et accès réels à vérifier. |
| 3. Préparer les moyens de validation | DEVOPS, QA, SECURITY | Commandes reproductibles, CI appropriée, gestion des secrets, procédure de livraison. | Contrôles exécutables, résultats observés, production protégée par une validation humaine. | Après autorisation de mise en œuvre. |
| 4. Construire un premier parcours complet | FRONTEND, BACKEND, DATABASE, DESIGN | Incrément limité couvrant un besoin de bout en bout. | Critères d’acceptation satisfaits, contrôles réussis, revue effectuée, limites documentées. | Hors périmètre actuel. |
| 5. Valider puis livrer | QA, SECURITY, REVIEWER, DEVOPS | Version candidate, preuves, procédure de retour arrière et compte rendu. | Approbation humaine explicite de la version et de la cible avant production ; vérification après livraison. | Hors périmètre actuel. |

## Prochaine action

Examiner le plan de Vie parallèle et vérifier ensuite les accès nécessaires,
les quotas du modèle gratuit, le stockage et l’authentification du propriétaire.
Le développement n’est pas lancé par cette mise à jour documentaire.

Les tests applicatifs sont absents du dépôt examiné ; aucune réussite de test
applicatif n’est revendiquée.

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
