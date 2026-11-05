# Journal des décisions — ALTER EGO DEV

Ce journal distingue les règles demandées, les choix proposés et les décisions
techniques validées. Une décision documentée ne prouve pas sa mise en œuvre.

## ADR-001 — Limiter la phase actuelle au cadrage

- **Date :** 2026-11-05.
- **Statut :** demandé par le propriétaire ; cadrage préparé sur branche dédiée pour revue.
- **Contexte :** organiser la création future d’applications web et mobiles depuis Android.
- **Décision :** créer les consignes des dix rôles et les documents d’architecture,
  roadmap et décisions. Ne construire aucune application pendant cette phase.
- **Alternative :** initialiser immédiatement une application ; écartée car hors périmètre.
- **Conséquences :** aucun framework, stockage ou hébergeur choisi par défaut ;
  dépôt inspecté (README uniquement), documents adaptés avant proposition d’intégration.

## ADR-002 — Organiser dix responsabilités spécialisées

- **Date :** 2026-11-05.
- **Statut :** rôles demandés ; fonctionnement successif proposé par défaut.
- **Contexte :** répartir les responsabilités sans supposer de capacités multi-agents.
- **Décision :** définir ARCHITECT, PRODUCT, DESIGN, FRONTEND, BACKEND, DATABASE,
  SECURITY, QA, DEVOPS et REVIEWER dans `AGENTS.md`. Autoriser une même session à
  exercer plusieurs rôles successivement ; un seul responsable écrit sur un
  fichier à la fois.
- **Alternatives :** rôle unique sans responsabilités explicites ; dix agents
  simultanés. La première réduit la traçabilité ; la seconde suppose des moyens
  non vérifiés et accroît les conflits.
- **Conséquences :** tâches et passages de relais explicites ; aucune activation
  automatique d’agents par la seule présence de `AGENTS.md`.

## ADR-003 — Encadrer branches, contrôles et sécurité

- **Date :** 2026-11-05.
- **Statut :** règles demandées ; protections techniques non vérifiées.
- **Contexte :** conserver des changements simples, maintenables et vérifiables.
- **Décision :** branches distinctes, absence d’écriture concurrente sur les mêmes
  fichiers, tests disponibles exécutés avant proposition d’intégration, résultats
  fidèles, secrets exclus et décisions structurantes documentées.
- **Alternative :** changements directs sans revue ni preuves ; écartée car
  incompatible avec les règles demandées.
- **Conséquences :** préciser les contrôles absents ou bloqués ; inspecter les
  workflows existants avant toute publication susceptible de les déclencher.

## ADR-004 — Réserver l’autorisation de production à un humain

- **Date :** 2026-11-05.
- **Statut :** exigence du propriétaire ; mécanisme technique à examiner.
- **Contexte :** une intégration Git et un déploiement en production sont deux actions distinctes.
- **Décision :** exiger une approbation humaine explicite de la version et de
  l’environnement cible après présentation des contrôles, risques et moyens de
  retour arrière, avant tout déploiement en production.
- **Alternative :** déploiement automatique après fusion sans approbation dédiée ; écartée.
- **Conséquences :** la CI et l’hébergement devront faire respecter cette exigence ;
  la documentation seule ne crée pas de protection effective.

## ADR-005 — Regrouper les applications dans un portail personnel

- **Date :** 2026-11-05.
- **Statut :** usage privé confirmé par le propriétaire (« que pour moi ») ;
  périmètre et architecture cible proposés pour revue.
- **Contexte :** regrouper toutes les futures applications du propriétaire.
- **Décision :** concevoir un portail privé avec catalogue et liens ; proposer une
  interface web responsive administrable depuis Android.
- **Alternatives :** plateforme commerciale avec clients et facturation, écartée
  pour cette version compte tenu de l’usage confirmé ; fusionner les applications
  dans un logiciel unique, inutile pour ce besoin de catalogue.
- **Conséquences :** pas d’inscription publique ni paiement ; applications
  indépendantes conservant leurs droits. Authentification du propriétaire et
  autorisations côté serveur requises lors de la réalisation. Stack ouverte.
- **Validation :** usage personnel confirmé dans la conversation ; fonctionnalités
  de [PRODUCT.md](PRODUCT.md) à valider avant développement.

## ADR-006 — Démarrer sans frais d’hébergement

- **Date :** 2026-11-05.
- **Statut :** budget gratuit confirmé par le propriétaire ; fournisseurs proposés.
- **Contexte :** portail privé à faible trafic, sans budget d’hébergement initial.
- **Décision :** viser 0 € en restant sur des offres gratuites, sans essai payant,
  domaine acheté, option facturable ni montée de gamme automatique.
- **Piste :** Vercel Hobby pour le site et Supabase Free pour Auth et PostgreSQL,
  sous réserve de l’éligibilité à l’usage personnel non commercial de Hobby.
- **Alternatives :** offres payantes exclues au démarrage ; autre hébergeur gratuit
  à étudier si l’usage du portail est commercial, même avec un utilisateur unique.
- **Conséquences :** quotas et interruptions possibles ; Supabase peut mettre en
  pause après une semaine d’inactivité et n’inclut pas de sauvegardes automatiques
  sur Free. Prévoir une procédure d’export et restauration avant usage réel.
- **Preuves :** tarifs et limites officiels vérifiés, liens dans
  [HOSTING.md](HOSTING.md). Aucun compte, service ou déploiement créé.

## ADR-007 — Vie parallèle, première application à modèles gratuits

- **Date :** 2026-11-05.
- **Statut :** première application et recours aux modèles gratuits confirmés ;
  plan de réalisation proposé.
- **Contexte :** le propriétaire souhaite une simulation de vie inspirée de
  Smallville, accessible depuis son portail privé.
- **Décision :** conserver le portail comme catalogue ; Vie parallèle gère son
  monde, ses personnages et ses sauvegardes. Prévoir des interactions génératives
  avec un modèle éligible au niveau gratuit.
- **Alternatives :** remplacer le portail par la simulation, non retenu ;
  limiter les dialogues à des scripts, incompatible avec le choix génératif confirmé.
- **Conséquences :** quotas et éligibilité à vérifier, pause en cas d’épuisement,
  aucun recours payant automatique, aucune exécution permanente au démarrage.
  Commencer par un parcours à un personnage puis étendre à trois est proposé.
- **Livrables :** [spécification](apps/VIE_PARALLELE.md) et
  [plan avec écrans](apps/VIE_PARALLELE_PLAN.md).
- **Validation :** aucun code ni service lancé ; aucun test de génération effectué.

## Modèle pour les prochaines décisions

```markdown
## ADR-NNN — Titre

- Date : AAAA-MM-JJ.
- Statut : proposé / accepté / remplacé / abandonné.
- Contexte et contraintes :
- Décision :
- Alternatives et motifs :
- Conséquences et risques :
- Validation : personne ou référence de revue, si applicable.
- Preuves de mise en œuvre : fichiers, PR ou contrôles, si disponibles.
- Remplace / remplacé par : référence éventuelle.
```
