# Lecture de valeurs nutritionnelles sur le web

État : implémentée dans le serveur principal du dépôt. **Non reliée à l’aperçu
mobile statique version 1**, qui reste celui approuvé et publié séparément.

## Parcours

Dans « Ajouter un aliment », choisir « Page web — recette et portion sourcées ».
Saisir un nom de plat puis ouvrir « Chercher une recette sur le web » : cette
action ouvre DuckDuckGo dans un autre onglet. Aucune API de recherche payante,
clé ou recherche automatique du serveur n’est utilisée.

Trouver une recette compatible et coller son URL HTTPS. « Lire la page source »
fait lire cette URL au serveur, puis propose une fiche seulement si l’énergie et
la portion de référence sont exploitables. Choisir la fiche, ouvrir son lien,
vérifier sa portion et confirmer le nombre de portions consommées avant ajout.
La portion peut être fractionnée au dixième ; elle n’est pas convertie en g/ml.

## Périmètre réellement pris en charge

- Domaines fixes : `www.bbcgoodfood.com`, `www.skinnytaste.com`,
  `www.jamieoliver.com`. Chemins de recettes uniquement pour Good Food et Jamie
  Oliver ; pas d’URL arbitraire ou de PDF. Une page autorisée peut rester incompatible.
- Lecture de données JSON-LD de type Recipe, sans exécuter les scripts de la page.
  Une valeur numérique doit annoncer kcal, calories ou kJ. Les kJ explicites
  sont convertis avec 1 kcal = 4,184 kJ. Nombres sans unité, formats ambigus et
  valeurs absentes ne deviennent jamais zéro.
- Référence préférée : `nutrition.servingSize` explicite. Pour Good Food seulement,
  le marqueur textuel « Nutrition: Per serving » avec un nombre de parts dans
  `recipeYield` permet de définir une portion de recette. Cette seconde voie est
  refusée si plusieurs recettes différentes rendent l’association ambiguë.
- Aucune extraction d’une énergie seule sans portion, ni interprétation par LLM,
  estimation de poids, lecture de photo ou inférence depuis des ingrédients.
- Les informations sont celles publiées par l’auteur du site, pas une mesure
  nutritionnelle indépendante de l’application. Toujours confirmer la préparation
  et la portion de référence choisies.

L’essai réel Good Food « Overnight oats » a fourni 348 kcal pour une portion,
recette pour une personne. C’est une observation ponctuelle de cette page, pas
une preuve de compatibilité de toutes les recettes d’un domaine. Une page
Skinnytaste essayée n’offrait pas les données attendues ; d’autres éditeurs ont
renvoyé une restriction de lecture. Aucun accès n’est déclaré garanti.

## Protection des données et limites de lecture

`POST /api/nutrition/web` est protégé par session, origine et JSON limité à 2 Ko.
Le serveur accepte uniquement HTTPS sur les domaines fixes, sans port alternatif,
identifiant ou mot de passe, puis retire paramètres et fragment. Les hôtes IP,
loopback, domaines ressemblants et chemins non approuvés sont refusés. Aucun
contexte JSON-LD ou URL secondaire n’est téléchargé. Redirections interdites,
délai de douze secondes, HTML limité à 1 Mo, graphe borné, maximum cinq fiches.

Le plafond local est de six lectures/minute et une lecture distante à la fois,
en mémoire pour une instance. Ce n’est pas un quota annoncé par les éditeurs.
Leurs erreurs, restrictions ou changements de structure restent possibles.
Les domaines approuvés sont supposés conserver leur DNS légitime ; le code n’est
pas un proxy universel et ne prétend pas épingler leurs adresses IP.

Seule l’URL de la recette est envoyée au site ; aucune photo ou entrée du journal.
Le moteur de recherche externe reçoit seulement les termes saisis lors du clic
d’ouverture. Les textes ou scripts des pages ne donnent jamais des instructions
exécutables au serveur ou au modèle.

## Stockage et calcul

`.data/web-nutrition.sqlite`, fichier privé distinct, conserve au maximum 100
fiches extraites. Il garde uniquement nom, énergie, portion, URL, date de lecture
et identifiant dérivé ; pas de page complète, recette entière ou image copiée.
Aucune licence ouverte n’est supposée pour ces sites (`license: null`).

À l’ajout, le serveur relit sa fiche et calcule : kcal par portion × nombre de
portions confirmées, arrondi au dixième. Le journal conserve cet instantané et
son URL/date. Un changement de page n’altère pas les repas déjà enregistrés ;
les fiches antérieures de cette URL sont invalidées lors d’une nouvelle lecture.
Une fiche sélectionnée depuis plus de quatorze jours exige une nouvelle lecture.
La correction manuelle retire l’attribution automatique, comme pour OFF/USDA.

Le journal reste en schéma 1 avec un instantané optionnel par fournisseur.
Une ancienne version peut refuser les nouveaux instantanés web : sauvegarder
journal et version de code ensemble avant tout retour arrière.

## Sources techniques et validation

- [Schema.org NutritionInformation](https://schema.org/NutritionInformation) : énergie et portion.
- [Page réelle testée](https://www.bbcgoodfood.com/recipes/overnight-oats).
- [Contrôles et limites](VALIDATION.md).

À poursuivre : davantage de formats et sources après vérification, OCR d’étiquette,
Ciqual lorsque son service redevient accessible, et hébergement adapté au serveur
et au moteur local pour relier toutes ces fonctions à l’accès mobile permanent.
