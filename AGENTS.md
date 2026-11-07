# ALTER EGO DEV — Consignes de collaboration

## Objectif et périmètre

Organiser la conception d’applications web et mobiles depuis un téléphone Android,
avec GitHub et Codex dans ChatGPT. Le propriétaire a autorisé le 7 novembre 2026
la création d’un petit assistant local, puis d’une première application de
suivi de calories avec saisie manuelle et sauvegarde privée. Le suivi reste un
module du portail ; catalogue nutritionnel, photo et recherche web font désormais
l’objet d’une recherche et d’un plan de construction. Le premier connecteur
Open Food Facts, son cache local et les portions sourcées sont implémentés.
La validation humaine avant tout déploiement en production reste obligatoire.

Ces dix rôles représentent des responsabilités, pas dix agents automatiquement
actifs. Une même session peut prendre plusieurs rôles successivement. La présence
de ce fichier ne garantit aucune capacité de délégation ou d’exécution en parallèle.

Lire ces consignes, les éventuelles instructions locales et les documents de
`docs/` avant de travailler. Les instructions de l’utilisateur et de la plateforme
restent prioritaires. Adapter les commandes à ce qui existe réellement dans le dépôt.

## Rôles spécialisés

| Rôle | Responsabilités | Livrables | Critères de validation |
| --- | --- | --- | --- |
| ARCHITECT | Définir les frontières, dépendances et choix techniques ; préserver la simplicité ; coordonner les interfaces entre rôles. | Architecture à jour, contrats entre composants, décisions dans `docs/DECISIONS.md`. | Choix reliés aux besoins, alternatives et conséquences explicitées, complexité justifiée, aucun choix présenté comme implémenté sans preuve. |
| PRODUCT | Définir utilisateurs, problème, périmètre et priorités ; formuler les critères d’acceptation. | Spécifications, parcours, tâches priorisées et critères observables dans la roadmap ou les tickets. | Chaque fonctionnalité a un objectif, un périmètre et des critères vérifiables ; ambiguïtés signalées ; priorité validée par le porteur du produit. |
| DESIGN | Concevoir interfaces, navigation, UX mobile et accessibilité. | Parcours, maquettes, états chargement/vide/erreur, règles d’accessibilité. | Utilisation tactile Android prévue ; navigation clavier et lecteurs d’écran prises en compte ; contrastes et libellés vérifiables ; contrôles réalisés distingués des objectifs. |
| FRONTEND | Développer les interfaces selon les contrats, maquettes et conventions retenues. | Composants et écrans, intégration API, contrôles adaptés, documentation d’utilisation. | Critères PRODUCT satisfaits ; états d’interface gérés ; affichage mobile vérifié ; aucune donnée sensible embarquée ; contrôles disponibles exécutés. |
| BACKEND | Concevoir API, validation des entrées et logique métier ; faire respecter les autorisations côté serveur. | Contrats API, services, gestion des erreurs, contrôles et documentation. | Contrats respectés ; erreurs et droits vérifiés ; cas limites pertinents couverts ; aucun secret dans le code ou les réponses. |
| DATABASE | Définir schémas, intégrité, requêtes et migrations. | Modèles, migrations versionnées, stratégie de sauvegarde et de retour arrière adaptée. | Contraintes et accès justifiés ; migrations vérifiées sur un environnement isolé ; impacts sur les données et récupération documentés avant application. |
| SECURITY | Évaluer les risques, accès, secrets, dépendances et exposition des données. | Revue de sécurité, matrice des permissions, recommandations et suivi des risques. | Moindre privilège ; autorisations contrôlées au bon niveau ; absence de secrets dans les changements ; risques résiduels et limites des contrôles explicités. |
| QA | Définir et exécuter les vérifications selon les critères d’acceptation. | Plan de validation, résultats traçables, anomalies avec reproduction. | Commandes, contexte, résultats et limites consignés ; échecs signalés ; aucune réussite inventée ; parcours critiques vérifiés quand exécutables. |
| DEVOPS | Préparer automatisation, CI, environnements et procédures de déploiement. | Workflows, configuration sans secrets, procédures de déploiement, surveillance et retour arrière. | Vérifications reproductibles ; séparation des environnements ; secrets externalisés ; production conditionnée à une approbation humaine explicite. |
| REVIEWER | Relire le diff, cohérence, maintenabilité, portée et preuves de validation. | Revue avec constats priorisés, corrections demandées et avis d’intégration motivé. | Exigences couvertes ; aucun problème bloquant connu laissé sans résolution ; tests disponibles exécutés et limites visibles ; avis automatisé distinct d’une approbation humaine. |

Créer uniquement le code utile au besoin demandé. Distinguer un moteur installé
dans l’environnement de travail d’un service réellement déployé et permanent.

## Règles Git et coordination

1. Examiner d’abord le dépôt : racine, branche, état de travail, instructions,
   arborescence, documentation, manifestes, tests et CI présents. Ne pas écraser
   les changements existants de l’utilisateur.
2. Utiliser une branche distincte par fonctionnalité ou changement cohérent :
   `feat/<sujet>`, `fix/<sujet>` ou `docs/<sujet>`. Ne pas travailler directement
   sur la branche d’intégration ; identifier sa référence réelle avant de créer
   une branche. Pour le suivi de calories : `feat/suivi-calories`.
3. Avant chaque tâche, indiquer le rôle pilote, les fichiers concernés, les
   dépendances et les critères de fin. Préférer des tâches courtes et des PR
   faciles à relire sur téléphone.
4. Un seul responsable écrit sur un fichier à un instant donné. Si plusieurs
   tâches touchent le même fichier, les exécuter successivement avec un passage
   de relais explicite. Des branches distinctes ne suppriment pas les conflits.
5. Garder les changements ciblés ; résoudre les conflits après inspection et
   refaire les vérifications affectées. Ne jamais supprimer du travail tiers
   pour rendre une intégration plus facile.
6. Présenter les changements par pull request avant intégration, avec objectif,
   fichiers modifiés, validations, limites et décisions importantes.

## Tests et preuves

- Repérer les commandes dans les manifestes, la CI et la documentation ; ne pas
  inventer une commande ni supposer un outil installé.
- Exécuter les tests disponibles avant de proposer une intégration. Exécuter aussi
  les contrôles pertinents de format, analyse statique ou compilation disponibles.
- Rapporter pour chaque contrôle la commande exacte, le contexte, le résultat
  observé et les limites. Distinguer « réussi », « échoué », « bloqué », « non
  exécuté » et « absent ». Ne jamais inventer de résultats de tests.
- Si les tests sont absents, le dire. S’ils sont bloqués, indiquer la cause et
  garder la validation en attente ; ne pas déclarer le changement prêt à intégrer.
- Pour une modification documentaire, vérifier les chemins, liens internes,
  cohérence et diff. Ce contrôle ne constitue pas un test d’application.

## Sécurité et maintenabilité

- Ne jamais intégrer de secrets, jetons, mots de passe ou clés privées au dépôt,
  y compris dans les exemples, captures, logs ou historique Git. Utiliser les
  mécanismes de secrets de l’environnement et uniquement des valeurs fictives
  clairement marquées dans les modèles.
- En cas d’exposition, interrompre la publication, informer le propriétaire et
  demander la révocation ou rotation ; retirer le texte ne révoque pas un secret.
- Préserver une architecture simple et maintenable : conventions existantes,
  dépendances minimales, composants lisibles et responsabilités explicites.
  Ne pas introduire de microservices ni d’outillage sans besoin démontré.
- Documenter dans `docs/DECISIONS.md` les choix importants, leurs alternatives,
  conséquences et statut. Mettre l’architecture et la roadmap à jour si nécessaire.

## Production et validation humaine

Tout déploiement en production exige une approbation humaine explicite portant
sur la version précise, l’environnement cible et les vérifications présentées.
Une approbation de PR, un test réussi ou l’avis d’un agent ne vaut pas, à lui seul,
autorisation de déployer. Ne pas déclencher de déploiement automatique en production
avant cette validation ; si un workflow le fait, résoudre ce point avant une
action susceptible de le déclencher.

DEVOPS prépare les preuves, impacts et procédure de retour arrière ; QA et
SECURITY exposent les limites ; la personne habilitée autorise le déploiement.
Les protections effectives de GitHub et de l’hébergeur devront être configurées
et vérifiées : ces consignes ne les activent pas techniquement.

## Documents de référence

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Décisions](docs/DECISIONS.md)
