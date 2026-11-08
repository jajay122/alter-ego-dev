# Architecture — ALTER EGO

## État actuel

La première application est un journal privé de suivi de calories. Le petit
assistant texte, photo et recherche d’encyclopédie reste disponible à côté. Un portail sur / regroupe les deux applications ; les fiches sont statiques,
pas encore administrables. Le périmètre général est décrit dans
[PRODUCT.md](PRODUCT.md). Aucune API d’IA externe ni base distante n’est requise
pour la saisie manuelle ; le connecteur OFF utilise Internet. Aucun déploiement en production effectué.

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
| GET / | Portail des applications. | Aucun journal personnel dans le HTML. |
| GET /calories | Interface de verrouillage du suivi. | Journal lu seulement après authentification. |
| GET /assistant | Interface de l’assistant existant. | Session commune pour les opérations privées. |
| POST /api/nutrition/photo | Propositions de noms par vision locale. | Session, origine, validation image, verrou et quota partagés avec l’assistant. |
| GET /api/nutrition/search?source=...&q=... | OFF en ligne/cache, ou USDA local en lecture seule. | Session obligatoire, entrée bornée, quotas persistants. |
| GET /api/session | État de session sans appel au modèle. | Aucun contenu personnel. |
| GET /api/calories/day et /api/calories/export | Lecture ou export du journal. | Session obligatoire. |
| POST /api/calories/entries, PUT et DELETE /api/calories/entries/:id | Création, correction et suppression. | Session, origine, validation et version d’entrée. |
| PUT /api/calories/goal | Repère quotidien facultatif. | Session et origine. |
| GET /api/status | Configuration publique et état de session. | L’état réel du moteur n’est vérifié qu’après connexion. |
| POST /api/login | Création d’une session d’une heure. | Origine, mot de passe privé et limite de tentatives. |
| POST /api/assist | Texte, photo ou recherche Wikipédia. | Session, origine, taille des entrées, formats, une tâche à la fois. |
| POST /api/logout | Révocation immédiate de la session. | Session et origine. |

Les entrées et les réponses ne sont pas des instructions exécutables. Le texte
est affiché par textContent. Les liens de sources sont construits depuis les identifiants Wikipédia ou les
codes produits OFF ; des liens fixes d’attribution complètent ces sources. Aucun
lien n’est repris tel quel depuis la sortie du modèle.

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

## Extension nutritionnelle proposée

Catalogue public/cache distinct du journal privé, fiches versionnées et sourcées,
recherche par photo avec confirmation des portions, collecte web contrôlée :
[plan proposé](research/NUTRITION_DATA_PLAN.md). Le connecteur OFF et un cache SQLite avec index FTS5 sont désormais livrés,
sans migration du journal. Voir [NUTRITION.md](NUTRITION.md). La [photo assistée](FOOD_PHOTO.md) et le [catalogue USDA local](USDA.md) sont
implémentés. Ciqual, OCR d’étiquette et collecte web générale restent proposés.

## Cache alimentaire

lib/nutrition.mjs utilise node:sqlite (API candidate à stabilisation en Node 24),
avec requêtes préparées, index FTS5 et transactions. Le cache .data/nutrition.sqlite
est distinct de calories.json et limité à 1 000 produits / 200 recherches. Les
instantanés nutritionnels sont des champs optionnels du schéma 1 du journal :
les anciennes entrées restent lisibles sans migration. Une ancienne version du
serveur ne garantit pas la conservation de ces champs lors des corrections ;
conserver code et sauvegarde correspondants pour un retour arrière.

## Photo alimentaire

public/food-photo.js gère le JPEG réduit, l’aperçu temporaire, l’annulation et les
résultats corrigibles. lib/food-photo.mjs fournit la consigne serveur et le filtre
de noms. L’endpoint réutilise askLocalModel et les protections de l’assistant.
Aucune image ni proposition n’est ajoutée automatiquement au journal ou à OFF.

## Référence USDA séparée

lib/usda-import.mjs et scripts/import-usda.mjs construisent explicitement
.data/usda.sqlite depuis deux exports officiels figés et vérifiés par SHA-256,
ZIP/CRC et schéma, puis remplacent atomiquement ce fichier. lib/usda.mjs ne
l’ouvre qu’en lecture seule. Pas de migration de nutrition.sqlite ou calories.json.
Les recherches sont locales avec FTS5 ; les instantanés précisent fournisseur,
version, archive et méthode énergétique. Une ancienne version limitée aux
instantanés OFF peut refuser un journal contenant désormais USDA : conserver
une sauvegarde coordonnée du journal et du code avant un retour arrière.
