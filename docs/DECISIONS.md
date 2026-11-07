# Journal des décisions — ALTER EGO DEV

Ce journal distingue les règles demandées, les choix proposés et les décisions
techniques validées. Une décision documentée ne prouve pas sa mise en œuvre.

## ADR-001 — Limiter la phase actuelle au cadrage

- **Date :** 2026-11-05.
- **Statut :** cadrage initial terminé ; la création du nouvel assistant est autorisée le 2026-11-07.
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
- **Piste initiale :** Vercel Hobby et Supabase ; non retenue pour le moteur
  installé en permanence. Voir [HOSTING.md](HOSTING.md) pour le choix actuel.
- **Alternatives :** offres payantes exclues au démarrage ; autre hébergeur gratuit
  à étudier si l’usage du portail est commercial, même avec un utilisateur unique.
- **Conséquences :** quotas et interruptions possibles ; Supabase peut mettre en
  pause après une semaine d’inactivité et n’inclut pas de sauvegardes automatiques
  sur Free. Prévoir une procédure d’export et restauration avant usage réel.
- **Preuves :** tarifs et limites officiels vérifiés, liens dans
  [HOSTING.md](HOSTING.md). Aucun compte, service ou déploiement créé.

## ADR-007 — Installer un petit assistant multimodal autonome

- **Date :** 2026-11-07.
- **Statut :** demande de création et choix du serveur autorisés par le propriétaire.
- **Décision :** remplacer le premier projet par un petit assistant texte et image,
  installé côté serveur avec SmolVLM-256M et llama.cpp. Aucune API d’IA distante.
- **Alternatives :** une API externe, écartée selon la préférence du propriétaire ;
  exécution dans le navigateur Android, moins adaptée à une disponibilité stable.
- **Conséquences :** poids stockés localement, moteur réutilisable tant que la machine
  fonctionne, fonctions limitées et français imparfait. La recherche Internet
  nécessite une connexion et commence par des sources Wikipédia explicites.
- **Budget :** logiciel et poids gratuits ; l’existence d’un serveur permanent
  gratuit n’est pas garantie. Aucun service payant ni production déployé.
- **Livrables :** code du prototype, installation vérifiée par SHA-256, tests,
  [architecture](ARCHITECTURE.md) et [documentation du modèle](LOCAL_MODEL.md).

## ADR-008 — Commencer par un journal privé de calories indépendant de l’IA

- **Date :** 2026-11-07.
- **Statut :** création demandée par le propriétaire ; prototype implémenté.
- **Décision :** placer le suivi à l’accueil, conserver l’assistant sur /assistant,
  partager l’accès privé et saisir manuellement les kcal de chaque portion.
- **Stockage :** fichier JSON privé sur volume persistant, écritures atomiques
  et sérialisées pour une instance, additions en dixièmes de kcal.
- **Alternatives :** base distante, inutile au premier usage personnel ; estimation
  par petit modèle visuel, non retenue car les valeurs seraient peu fiables.
- **Conséquences :** aucune clé ni modèle requis pour suivre les repas. Objectif
  facultatif sans valeur imposée, export JSON privé, limites explicites pour
  une seule instance serveur. Pas de déploiement en production automatique.
- **Livrables :** [périmètre](CALORIES.md), code et tests de persistance.

## ADR-009 — Portail commun et extension nutritionnelle sourcée

- **Date :** 2026-11-07.
- **Statut :** portail implémenté ; connecteurs nutritionnels proposés, non livrés.
- **Contexte :** le propriétaire précise que le suivi est une application parmi
  les autres et demande grand catalogue, photo, web et recherche scientifique.
- **Décision :** accueil / pour les applications, suivi /calories, assistant
  /assistant ; session commune. Remplace uniquement le choix d’accueil d’ADR-008.
- **Recommandation :** fédérer OFF, Ciqual et USDA avec provenance/version/unités,
  cache/index local et confirmation des portions. L’IA retrouve des candidats,
  elle ne fournit pas seule la vérité nutritionnelle.
- **Alternatives :** catalogue propriétaire copié, modèle donnant des calories
  sans référence et import massif immédiat écartés pour licence, fiabilité et disque.
- **Conséquences :** vérifier disponibilité/licences/quotas avant ingestion,
  dimensionner le stockage, préserver le journal historique. Pas de production.
- **Preuves :** [recherche](research/NUTRITION_RESEARCH.md) et
  [plan](research/NUTRITION_DATA_PLAN.md) ; aucune précision photo revendiquée.

## ADR-010 — Recherche OFF et portions traçables

- **Date :** 2026-11-07.
- **Statut :** implémenté et vérifié ; aucun déploiement.
- **Décision :** requêtes publiques OFF à URL fixe, code-barres via v3.6 et texte
  via l’endpoint historique documenté, faute de plein texte v3. Ce dernier est
  une solution transitoire isolée dans le connecteur, à remplacer lors d’une
  transition vers exports/index complet ou API de recherche actuelle validée.
- **Stockage :** SQLite natif Node 24 et FTS5, au maximum 1 000 produits et
  200 recherches. Les quotas et le cache persistent après redémarrage.
- **Fiabilité :** énergie absente distincte de zéro ; unité g/ml confirmée d’après
  l’étiquette ; calcul serveur et instantané dans le journal. Aucun LLM impliqué.
- **Alternatives :** import complet différé pour le disque et la mise à jour ;
  fichier JSON écarté pour ce cache indexé ; base distante inutile ici.
- **Conséquences :** API node:sqlite encore candidate à stabilisation ; vérifier
  les mises à jour Node. Attribution ODbL visible, pas de copie d’images. Les
  termes recherchés quittent le serveur sauf en mode local, jamais le journal.
- **Preuves :** [fonctionnement](NUTRITION.md), [validation](VALIDATION.md),
  tests unitaires/HTTP, navigateur simulé et deux lectures publiques réelles.

## ADR-011 — Photo pour proposer des noms, confirmation avant recherche

- **Date :** 2026-11-07.
- **Statut :** prototype implémenté, tests et essais réels ponctuels effectués.
- **Décision :** réutiliser SmolVLM local pour proposer des noms corrigibles ;
  aucune énergie ni quantité déduite par IA. Recherche OFF et ajout restent explicites.
- **Traitement :** JPEG de 512 pixels préparé sur téléphone, limites de taille,
  aperçus temporaires révoqués à la fermeture, aucune photo enregistrée par le code.
- **Alternatives :** modèle distant écarté selon la préférence du propriétaire ;
  image originale écartée après dépassement constaté du contexte de 2 048 tokens ;
  estimation automatique écartée pour la fiabilité et l’absence de benchmark.
- **Conséquences :** noms parfois anglais, propositions parfois absentes ou fausses,
  absence d’OCR et de mesure des portions. Le filtre de texte n’est pas un détecteur
  alimentaire fiable. Quota/verrou d’inférence partagés ; saisie manuelle indépendante.
- **Preuves :** [fonctionnement](FOOD_PHOTO.md), [validation](VALIDATION.md),
  photo de banane et image rouge synthétique ; aucun taux de précision annoncé.

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
