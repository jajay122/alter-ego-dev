# Recherche nutrition — ALTER EGO

> État ultérieur : le connecteur Open Food Facts, le cache SQLite/FTS5 et les
> portions sourcées sont maintenant implémentés : [état courant](../NUTRITION.md).
> La photo assistée est aussi disponible : [fonctionnement](../FOOD_PHOTO.md).
> Les constats de recherche et les autres propositions ci-dessous restent datés.


Date : 7 novembre 2026. Le suivi calories est un module du SaaS privé ALTER EGO,
à côté du petit assistant et des applications futures.

## Méthode et état réel

Recherche ciblée, pas revue scientifique systématique : six requêtes Exa,
39 résultats sur trois axes (catalogues, applications, science), recherche de
publications puis lecture de pages officielles et de passages des études citées.
Les descriptions commerciales ci-dessous établissent des fonctions annoncées,
pas leur précision ni leur efficacité clinique. Les recommandations sont des
choix de conception ; elles ne constituent pas des fonctions déjà livrées.

Le journal manuel et le portail sont implémentés. Aucun catalogue alimentaire
n’a été importé ; aucune recherche nutritionnelle par photo ou sur le web n’est
connectée au journal. Les outils Exa et Firecrawl employés pour cette recherche
ne sont pas un moteur de recherche gratuit intégré à l’application.

## 1. Le catalogue le plus large utile

Recommandation : fédérer plusieurs sources et garder leur provenance. Aucun
fournisseur seul ne couvre correctement tous les produits et plats. Le nombre
de fiches ne mesure ni leur complétude ni le nombre d’aliments distincts.

| Source | Couverture vérifiée | Accès et contraintes | Usage proposé |
| --- | --- | --- | --- |
| [Open Food Facts](https://world.openfoodfacts.org/) | 4 900 599 produits affichés lors de la consultation ; compteur évolutif, valeurs parfois absentes. | Base ODbL, contenus DbCL, photos CC BY-SA 3.0 ; attribution et obligations de partage des bases adaptées. | Produits emballés, GTIN/codes-barres, marques, étiquettes internationales. |
| [Ciqual 2025, ANSES](https://www.anses.fr/en/article/ciqual-nutritional-composition-table) | 3 484 aliments courants, contexte français. | Données ouvertes ; vérifier la licence de l’export et citer ANSES/version avant import. | Aliments génériques, ingrédients et compositions françaises. |
| [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) | Foundation, SR Legacy, FNDDS, Branded ; pas de total global vérifié ici. | Données CC0 ; API avec clé data.gov gratuite, quota par défaut 1 000 requêtes/heure/IP ; exports disponibles. | Complément international et nutriments documentés. |

Ne pas additionner ces catalogues pour annoncer un total d’aliments uniques.
Ne pas copier les bases propriétaires des applications concurrentes.

### Import, disponibilité et licences

- [OFF : réutilisation et exports](https://world.openfoodfacts.org/data) : privilégier
  les exports dès qu’il faut beaucoup de produits, plutôt que parcourir l’API.
  Les tailles indicatives publiées du CSV sont d’environ 0,9 Go compressé et
  9 Go décompressé. Les formats JSONL/Parquet existent aussi. Les deltas ne couvrent
  pas les suppressions : prévoir une réconciliation périodique.
- [OFF : contrat API](https://openfoodfacts.github.io/openfoodfacts-server/api/) :
  User-Agent identifiant l’application et un contact ; recherche limitée à
  10 requêtes/minute/IP. Ne pas faire une requête à chaque frappe. La recherche
  structurée v2 ne garantit pas une recherche plein texte ; vérifier le contrat
  de l’endpoint retenu, sans inventer de paramètres v3.
- [USDA : exports](https://fdc.nal.usda.gov/download-datasets/) : la page consultée
  indique environ 463 Mo compressés et 3,1 Go décompressés pour le CSV complet.
  Ce sont des indications fournisseur, pas des mesures de cette installation.
  Une clé API reste hors Git ; DEMO_KEY n’est pas une solution de production.
- Ciqual : la page ANSES est accessible, mais le sous-site Ciqual renvoyait une
  maintenance HTTP 503 pendant la vérification. Le [texte juridique indexé](https://ciqual.anses.fr/cms/en/legal-information)
  indique une Licence Ouverte et l’attribution « Anses. 2025. Ciqual French food
  composition table ». Vérifier à nouveau la disponibilité et le fichier de
  licence de la version téléchargée avant ingestion.
- ODbL ne signifie pas que le code entier de l’application doit être publié.
  Les obligations concernent notamment l’attribution et certaines redistributions
  ou utilisations publiques de bases adaptées. Séparer les tables des fournisseurs
  ne dispense pas automatiquement de respecter ces obligations.

Le corpus complet dépasse largement un petit cache et peut occuper plusieurs Go,
plus l’index. Aucun téléchargement massif n’a été lancé. Commencer par un noyau
français et un cache de produits réellement consultés, puis importer par lots
sur une machine dont le disque et la RAM ont été dimensionnés.

## 2. Ce que font les applications existantes

| Application et source officielle | Fonction annoncée observée | À retenir pour ALTER EGO |
| --- | --- | --- |
| [Cronometer — Photo Logging](https://support.cronometer.com/hc/en-us/articles/39013533811092-Mobile-Photo-Logging) | Offre Gold : propositions d’aliments et portions, ingrédients éventuellement oubliés, correction et recette. | Corriger et confirmer avant enregistrement ; rendre visibles les correspondances. |
| [MyFitnessPal — Meal Scan](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-How-to-use-the-Meal-Scanner) | Premium, application mobile, conditions de version/langue ; suggestions puis choix de portion. | Garder le parcours manuel et la confirmation ; ne pas confondre photo et mesure. |
| [YAZIO — AI Calorie Tracking](https://help.yazio.com/hc/en-us/articles/39137901903889-What-is-the-AI-Calorie-Tracking-Feature-and-how-does-it-work) | Fonction Pro ; estimation des ingrédients/quantités, corrections ; précision explicitement limitée. | Afficher l’incertitude et permettre de corriger les quantités. |
| [Lifesum — AI Tracking](https://help.lifesum.com/en/article/ai-tracking-how-does-it-work-15sw7rk/) | Premium : photo, voix, texte, code-barres ; favoris/récents ; ajustements. | Favoris et recherche rapide limitent la saisie répétitive. |
| [MacroFactor — AI Food Logging](https://macrofactor.com/ai-food-logging/) | Article présentant une bêta photo/texte reliée aux aliments de la base, corrections avant journalisation. | L’IA aide à retrouver une fiche ; les valeurs viennent d’une source identifiable. |

Ces fonctions ne sont pas toutes gratuites chez ces fournisseurs. Aucun tarif,
classement de précision ou bénéfice de santé comparatif n’a été mesuré ici.
Notre logiciel peut rester sans abonnement d’IA ; calcul, disque et hébergement
permanent doivent malgré tout être assurés.

## 3. Résultats scientifiques et implications

### La source et les portions comptent autant que l’interface

[Zhang et al., 2021, revue et méta-analyse](https://pmc.ncbi.nlm.nih.gov/articles/PMC8634532/),
DOI 10.1093/advances/nmab058 : 14 études, dont 11 dans l’analyse énergétique.
L’écart moyen regroupé était de −202 kcal/jour (IC95 % −319 à −85), avec une
forte hétérogénéité (I² = 72 %). Dans le sous-groupe utilisant la même base de
composition que la référence, l’écart était plus faible : −57 kcal/jour
(IC95 % −116 à 2). Ce n’est ni une correction à appliquer à tous les journaux,
ni une évaluation des versions actuelles de toutes les applications.

Conséquence : tracer les sources et portions ; proposer une vérification des
huiles, sauces et boissons oubliées, sans les ajouter automatiquement.

### Une photo ne mesure pas les calories

[Fridolfsson et al., 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12513282/),
DOI 10.1016/j.cdnut.2025.107556 : 52 photos standardisées, comparées à une référence
pesée, avec GPT-4o, Claude 3.5 Sonnet et Gemini 1.5 Pro. Les erreurs absolues
relatives moyennes d’énergie étaient de 35,8 % pour les deux premiers et 64,2 %
pour Gemini. Ces chiffres concernent ces modèles et ce protocole, pas notre
SmolVLM ni toutes les photos possibles. Une MAPE n’est pas un taux de bonne
reconnaissance des aliments.

[Shonkoff et al., revue systématique](https://pmc.ncbi.nlm.nih.gov/articles/PMC10836267/)
compare 52 études de méthodes d’images alimentaires : forte diversité des
protocoles, plats simples plus faciles, absence de précision générale regroupée
fiable. Une assiette peut cacher l’huile, la sauce, la densité et le poids.

Conséquence : proposer des candidats, retrouver les fiches, faire confirmer les
ingrédients et les grammes. Le petit modèle local n’a pas de benchmark alimentaire
ici ; son essai antérieur sur une image rouge ne prouve aucune précision nutritionnelle.

### Rendre le suivi régulier, sans promettre un effet clinique

[Krukowski et al., 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10765525/),
DOI 10.1186/s12966-023-01555-6 : revue de 19 études, 3 261 participants, avec biais
et hétérogénéité. Le bénéfice regroupé concernant l’activité physique ne doit pas
être transformé en preuve de perte de poids grâce à un rappel alimentaire.

[Patel et al., 2019, essai randomisé](https://pmc.ncbi.nlm.nih.gov/articles/PMC6416539/),
DOI 10.2196/12209 : comparaison sur 12 semaines de stratégies de suivi ; pas de
différence significative de poids entre groupes. Plusieurs éléments étaient
combinés, ce qui ne démontre pas isolément l’effet d’un bouton ou d’un rappel.

Conséquence : favoris, duplication de repas, rappels facultatifs et bilan neutre
sont des propositions d’ergonomie informées par la littérature. Leur efficacité
propre devra être évaluée. Une journée non renseignée n’est pas une journée sans
apport ; afficher la complétude avant les moyennes. Éviter les séries culpabilisantes.

### Un jeu de données utile pour vérifier, pas pour remplir le catalogue

[Nutrition5k, Google Research, CVPR 2021](https://github.com/google-research-datasets/Nutrition5k) :
5 006 assiettes, ingrédients pesés, vidéos et images dont certaines avec profondeur,
principalement issues de cafétérias californiennes. Ce n’est pas une représentation
mondiale de toutes les cuisines. L’archive complète annoncée fait 181,4 Go ;
aucun téléchargement effectué. Vérifier le texte exact de la licence Creative
Commons lié au dépôt avant réutilisation. Respecter les partitions pour ne pas
placer des vues du même plat à la fois dans l’entraînement et le test.

## 4. Fonctions à construire, dans cet ordre

| Priorité | Fonction | Validation attendue |
| --- | --- | --- |
| P0 | Catalogue avec source, unités, valeurs manquantes, versions et recherche française. | Échantillons de chaque fournisseur vérifiés ; absence de valeur jamais convertie en zéro ; attribution visible. |
| P1 | Recherche texte et code-barres, choix du produit puis poids/portion. | Bonne marque/version ; calcul 100 g × grammes / 100 exact ; ml séparés des g. |
| P1 | Photo assistée et OCR d’étiquette local. | Candidats modifiables ; source nutritionnelle affichée ; confirmation de la quantité ; aucun ajout silencieux. |
| P1 | Recherche web nutritionnelle avec provenance. | URL/date/base de portion présentes ; page complète vérifiée ; absence de résultat clairement signalée. |
| P2 | Recettes, poids final cuit, favoris, récents et duplication. | Rendement de cuisson et portions explicites ; correction conservée. |
| P2 | Protéines, glucides, lipides, fibres, sel et micronutriments disponibles. | Unités cohérentes, couverture affichée ; aucune carence diagnostiquée depuis des données manquantes. |
| P2 | Bilan hebdomadaire, jours complets/incomplets et rappels facultatifs. | Moyennes explicites et rappels désactivables ; aucun objectif ou déficit imposé. |

L’estimation automatique d’un déficit, d’une dépense adaptative ou de calories
« exactes » depuis une photo n’est pas prioritaire. Voir le
[plan technique et critères d’acceptation](NUTRITION_DATA_PLAN.md).
