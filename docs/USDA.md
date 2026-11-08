# Catalogue alimentaire USDA local

État au 8 novembre 2026 : import et recherche implémentés, sans déploiement.
Ce catalogue complète Open Food Facts pour les aliments et ingrédients courants.
Aucune clé API, abonnement ou connexion Internet n’est nécessaire pour rechercher
après import. Ce n’est pas la totalité de FoodData Central ni du catalogue mondial.

## Données réellement importées

| Export officiel | Version figée | Fiches observées |
| --- | --- | --- |
| Foundation Foods, JSON | 29 octobre 2026 | 424 |
| SR Legacy, CSV | avril 2018 | 7 793 |
| Ensemble indexé | Deux collections distinctes | 8 217 |

8 167 fiches ont une valeur énergétique utilisable dans l’import vérifié ; 50
restent sans énergie et ne peuvent pas servir à un calcul automatique. Ces fiches
ne sont pas 8 217 aliments uniques : descriptions, préparations et collections
peuvent se recouper. Les produits emballés OFF restent dans leur cache séparé.

Les noms sont conservés en anglais, sans traduction ou correction par LLM.
Rechercher par exemple `banana`, `rice cooked` ou `chicken`, puis vérifier la
préparation exacte : cru, cuit, séché, avec peau, etc. `Bananas, raw` et `Bananas,
dehydrated, or banana powder` ont des valeurs différentes et restent distincts.
Aucune correspondance automatique ni moyenne entre les sources n’est faite.

Les données USDA sont [dans le domaine public sous CC0](https://fdc.nal.usda.gov/api-guide).
L’interface attribue la source à USDA FoodData Central et montre collection,
version et lien vers la fiche. SR Legacy est une collection historique de 2018 ;
la date d’import ne rend pas les données nutritionnelles plus récentes.

## Installation explicite

Prérequis : Node.js 24 et accès HTTPS à `fdc.nal.usda.gov` pour le téléchargement.
Aucun paquet de production supplémentaire. Depuis la racine :

```sh
npm run nutrition:import:usda
```

Le script télécharge deux URL officielles figées, contrôle la taille et le SHA-256,
valide ZIP/CRC et structure, construit l’index SQLite temporaire puis remplace
atomiquement `.data/usda.sqlite`. Si une étape échoue, le catalogue précédent est
conservé et `calories.json` n’est pas touché. `CALORIES_DATA_DIR` permet d’utiliser
le volume privé configuré ; le script npm charge `.env.local` comme le serveur.
Dans un environnement imposant un proxy, utiliser son mécanisme Node prévu,
par exemple `NODE_USE_ENV_PROXY=1`, sans désactiver TLS.

Des archives déjà téléchargées peuvent être passées dans cet ordre :

```sh
npm run nutrition:import:usda -- /chemin/foundation-json.zip /chemin/sr-legacy-csv.zip
```

Les empreintes sont celles observées sur les fichiers officiels lors de cette
intégration, pas des signatures publiées par USDA. Un fichier modifié à la même
URL est refusé jusqu’à vérification et mise à jour explicite du manifeste dans
`lib/usda-import.mjs`. Les ZIP, bases et journaux ne sont pas ajoutés au dépôt.

L’import vérifié a produit une base d’environ 6,5 Mio. Ce n’est pas une garantie
pour d’autres versions. Les limites de 1 000 produits / 200 recherches du cache
OFF ne s’appliquent pas au catalogue USDA. Aucun import ne part automatiquement
au démarrage ni depuis le formulaire. Dans une installation déployée approuvée,
exécuter la commande dans le service applicatif et son volume de données.

## Recherche et journal

Dans « Ajouter un aliment », choisir « USDA — aliments courants, local ».
Les résultats viennent uniquement de la base locale et conservent leurs noms
anglais. Le nombre de fiches du catalogue est affiché lors d’une recherche réussie.
Sans import ou si le fichier est illisible, une erreur explicite propose OFF ou
la saisie manuelle ; aucun catalogue vide n’est créé silencieusement.

USDA exprime les nutriments pour **100 g**. Une quantité en ml est refusée : peser
la portion ou utiliser une autre source avec l’unité adaptée. L’application ne
suppose jamais qu’un ml pèse un gramme.

L’énergie est prise, lorsqu’elle est disponible en kcal, dans l’ordre :
Atwater spécifique (2048), Atwater général (2047), énergie historique (1008).
Le choix est une règle de cette application, pas une recommandation USDA de
hiérarchie universelle. Le nutriment utilisé est conservé dans l’instantané ;
aucune moyenne n’est faite entre méthodes. Les autres valeurs retenues ont leur
unité vérifiée ; sodium et sel ne sont pas confondus. Une absence reste null.

Avant l’ajout, le serveur relit la fiche puis vérifie sa révision et sa date
d’import. Il calcule la portion et conserve la source, le code FDC, la version,
l’empreinte de l’export, le nutriment énergétique, la quantité et l’unité.
Un réimport n’altère pas les totaux des anciens repas. Une sélection périmée doit
être refaite. La saisie manuelle et les anciennes entrées OFF restent compatibles.
Le nom du journal reste limité à 120 caractères ; la fiche source conserve la
description complète. Pas de migration du journal appliquée.

## Vérifications et limites

Les tests unitaires utilisent des archives synthétiques clairement identifiées,
contrôlent les erreurs d’import, le calcul, la provenance et le maintien du journal.
Le script `scripts/usda-browser-check.mjs` utilise une copie du catalogue public
réel importé, jamais le journal personnel ; le réseau y est interdit. Installer
les données avant ce test ; `USDA_TEST_DATABASE` peut désigner un autre fichier
USDA importé compatible. Voir [VALIDATION.md](VALIDATION.md).

Ciqual reste à connecter : son sous-site renvoyait encore une maintenance lors
de cette vérification. Ni les données Ciqual 2025 ni les produits USDA Branded,
FNDDS ou l’ensemble mondial ne sont déclarés installés. OCR d’étiquette et
recherche web générale restent à construire.

## Sources officielles consultées

- [Versions et téléchargements](https://fdc.nal.usda.gov/download-datasets/)
- [Foundation : unités, portions et énergie](https://fdc.nal.usda.gov/Foundation_Foods_Documentation)
- [Licence et guide](https://fdc.nal.usda.gov/api-guide)
- [Ciqual : maintenance observée](https://ciqual.anses.fr/)
