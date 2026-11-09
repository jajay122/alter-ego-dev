# ALTER EGO complet — version hébergée 2

État : version préparée pour le même Site privé ; publication soumise à la
validation humaine de la version exacte. Le lien v1 reste inchangé jusqu’à cette étape.

## Architecture

Cloudflare Worker ESM servi par Sites, identité ChatGPT imposée par la plateforme,
D1 pour les journaux, favoris, objectifs et projets. L’identifiant injecté
`oai-authenticated-user-id` est la clé de propriétaire de chaque opération.
Aucune mutation n’accepte un propriétaire fourni dans le corps. Toutes les requêtes
SQL sont paramétrées et filtrées par propriétaire. Origine exacte et JSON borné
obligatoires pour les écritures. Aucune clé API d’IA ni mot de passe embarqué.

Les pages, CSS, JavaScript et références USDA sont empaquetés dans un Worker ESM.
Le catalogue public reste distinct des données personnelles : pas de seed massif
D1 ni copie des fichiers privés du serveur Node. Les sources OFF, Wikipédia et
recettes sont lues côté Worker, avec taille, délai, quota et domaines contrôlés.
Les sources nutritionnelles sélectionnées sont figées dans chaque entrée.

## Données et migration

- Tables : profiles, entries, favorites, nutrition_sources, request_limits,
  atelier_projects. Clé de propriétaire sur chacune ; révisions pour corrections.
- Entrées idempotentes par UUID ; conflits et capacité contrôlés dans SQLite/D1,
  y compris via triggers pour les lots importés. Favoris et copies gardent la source.
- Le Site garde projet et domaine v1 pour retrouver le localStorage de l’aperçu.
  L’application propose explicitement d’importer le journal trouvé sur cet appareil.
- Import par lots de 100, contrôle des dates réelles, sources et valeurs ; merge
  sans écrasement, conflit explicite pour UUID déjà présent avec un autre contenu.
  Chaque lot est atomique, les étapes précédentes restent enregistrées si un lot
  suivant échoue. Une nouvelle tentative ne duplique pas les entrées.
- La copie locale v1 est conservée ; un export JSON peut servir de sauvegarde.
  Un objectif existant n’est pas écrasé par l’import. Aucun aliment ou objectif fictif.
- Migrations initiales générées avec Drizzle dans hosted/migrations, schema-only.
  Triggers ajoutés avant toute application. Après publication, ces fichiers seront
  immuables : les changements suivants nécessitent une nouvelle migration.

## Interface et calories

Nouvelle interface crème/charbon/lime, navigation mobile inférieure, sidebar
bureau et trois modules : Nutrition, Assistant et Atelier. Routes v1 conservées.
Saisie manuelle, recherche USDA/OFF, recette web compatible, objectif facultatif,
favoris, copie, export et vue de semaine. Une journée sans entrée est « non
renseignée », pas un apport réel nul. Pas de macros inventées depuis des absences.

Les aides de recherche français→anglais sont un petit dictionnaire explicite,
pas une traduction officielle des fiches. Noms et versions des références restent
ceux de la source. Photo : proposition locale d’aliments, corrigible avant toute
recherche et portion. Aucun calcul de calories par IA.

## IA et rôles

Voir [BROWSER_AI.md](BROWSER_AI.md). Modèles gratuits exécutés dans un Web Worker
sur le téléphone, après téléchargement explicite. Texte léger expérimental,
option multilingue WebGPU et vision SmolVLM séparée. Le traitement des photos
reste local au navigateur ; aucun transfert vers un fournisseur d’IA.

Le test CPU réel du modèle léger a produit une réponse française incorrecte.
Le succès de l’inférence n’est pas une validation de qualité. L’Assistant ouvre
par défaut la recherche Wikipédia sourcée ; calcul sans eval et sources restent
utilisables sans modèle. Android/WASM/WebGPU et vision réelle restent à vérifier.

L’Atelier enchaîne les dix rôles à partir d’un brief avec le modèle texte choisi.
Les résultats sont des propositions, pas des actions GitHub ou des tests exécutés.
Chaque livrable est enregistré en D1. Le calcul continue lors de la navigation
SPA dans cet onglet ; fermeture ou suspension du navigateur interrompt son
exécution. Les rôles restants peuvent être repris, sans faux statut de daemon.
Une sortie non confirmée par D1 reste exportable ; un conflit impose rechargement
sans effacement silencieux. Les cinq agents de développement utilisés pendant
cette construction sont distincts de ces rôles de l’application.

## Construction reproductible

Prérequis Node 24, références USDA importées, dépendances de développement installées.

```sh
npm ci
npm run nutrition:import:usda
npm test
npm run check
npm run build:hosted
node scripts/check-hosted-build.mjs
```

La sortie est .build/site. Le manifeste conserve l’ID du Site, déclare DB, retire
le mode static ; l’archive déployable contient manifeste, dist/server et drizzle.
`USDA_REFERENCE_JSON` peut désigner le catalogue public exporté du Site pour un
rebuild ; il ne doit jamais pointer vers un journal privé. Le build ne copie
que les modules public/v2, l’icône et les références USDA vérifiées.

Publication sur le projet Sites existant, en préservant son audience propriétaire
seul. Les migrations sont appliquées avant le Worker : même un déploiement échoué
peut laisser une migration appliquée. Vérifier cet état avant de modifier quoi
que ce soit et ne pas réécrire une migration déjà appliquée. Le code Node antérieur
reste dans le dépôt pour le moteur serveur et ses essais, pas comme backend du Site.

## Vérification disponible

80 tests Node : API historique, nouveau Worker/D1 simulé par SQLite, imports,
propriétaires distincts, favoris/copies, sources, moteur navigateur simulé,
annulation et Atelier. Le bundle réel et les migrations générées ont aussi été
exécutés dans un contrôle Node avec 8 217 références : routes/modules servis,
portion 125 g de banane crue à 111,3 kcal, isolation propriétaire et projet Atelier.

Ces tests ne prouvent ni l’identité injectée par le proxy en production, ni D1
hébergé, ni le rendu/les performances Android. Pas de navigateur Sites supporté
accessible dans cet environnement ; aucune validation visuelle hébergée revendiquée.
