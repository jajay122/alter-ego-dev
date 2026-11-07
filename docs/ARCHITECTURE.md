# Architecture — ALTER EGO

## État actuel

La première application est un journal privé de suivi de calories. Le petit
assistant texte, photo et recherche d’encyclopédie reste disponible à côté. Le portail de regroupement reste un objectif, décrit dans
[PRODUCT.md](PRODUCT.md). Aucune API d’IA externe ni base distante n’est requise
pour ce premier parcours. Aucun déploiement en production effectué.

## Composants

```text
Android / navigateur
        │ HTTPS pour un accès distant
        ▼
Application Node.js + HTML/CSS/JavaScript
  ├── session privée, validation, limites, sources
  ├── moteur llama.cpp local → SmolVLM-256M + projecteur visuel
  └── recherche Wikipédia (uniquement en mode Internet)
```

Le serveur utilise les modules natifs de Node.js, sans dépendance de production.
L’interface ne reçoit ni accès direct au moteur ni secret serveur. Le moteur
n’exécute aucun outil, shell, fichier ou action externe. Il produit du texte.

## Routes

| Route | Usage | Protection |
| --- | --- | --- |
| GET / et /calories | Interface de verrouillage du suivi. | Aucun journal personnel retourné dans le HTML. |
| GET /assistant | Interface de l’assistant existant. | Session commune pour les opérations privées. |
| GET /api/session | État de session sans appel au modèle. | Aucun contenu personnel. |
| GET /api/calories/day et /api/calories/export | Lecture ou export du journal. | Session obligatoire. |
| POST /api/calories/entries, PUT et DELETE /api/calories/entries/:id | Création, correction et suppression. | Session, origine, validation et version d’entrée. |
| PUT /api/calories/goal | Repère quotidien facultatif. | Session et origine. |
| GET /api/status | Configuration publique et état de session. | L’état réel du moteur n’est vérifié qu’après connexion. |
| POST /api/login | Création d’une session d’une heure. | Origine, mot de passe privé et limite de tentatives. |
| POST /api/assist | Texte, photo ou recherche Wikipédia. | Session, origine, taille des entrées, formats, une tâche à la fois. |
| POST /api/logout | Révocation immédiate de la session. | Session et origine. |

Les entrées et les réponses ne sont pas des instructions exécutables. Le texte
est affiché par textContent. Les seuls liens externes générés par l’application
sont construits à partir des identifiants d’articles retournés par Wikipédia.

## Installation et disponibilité

Les deux fichiers GGUF sont téléchargés à une révision fixe, vérifiés par SHA-256
et ignorés par Git. Le moteur est figé par un digest d’image Docker et lancé avec
--offline. En Compose, son réseau est interne et son port n’est pas publié.
Le serveur et son moteur doivent rester actifs pour un accès continu depuis Android.
Cela ne garantit pas la durée de vie d’un environnement de développement cloud.

## Maintenance

Changer le modèle demande une vérification de compatibilité, de licence, de
mémoire, de qualité et des tests texte/image. Pas de bascule automatique vers
un service distant. Pas de microservices ni de stockage permanent inutiles au
prototype. Consulter [LOCAL_MODEL.md](LOCAL_MODEL.md).

## Journal persistant

lib/calories.mjs gère un fichier privé .data/calories.json, version de schéma 1.
Les écritures d’une instance sont sérialisées, synchronisées sur disque puis
remplacées atomiquement. Les additions se font en dixièmes de kcal entiers.
Une opération d’ajout identifiée peut être rejouée sans duplication ; les
corrections et suppressions vérifient la version pour éviter les écrasements
entre onglets. Un fichier corrompu n’est pas remplacé silencieusement.

CALORIES_DATA_DIR permet de choisir un volume privé. Compose utilise un volume
nommé persistant et ne démarre pas le modèle sans le profil assistant. La
configuration est prévue pour une seule instance ; pas de verrou interprocessus
ni de base transactionnelle partagée dans ce prototype. L’export JSON complète
les sauvegardes du volume, sans constituer un système de restauration intégré.
