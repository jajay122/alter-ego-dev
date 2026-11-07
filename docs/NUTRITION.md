# Recherche alimentaire — État implémenté

Le module calories propose une recherche par nom ou code-barres saisi. Dans
« Ajouter un aliment », rechercher explicitement, choisir le bon produit,
confirmer la quantité et l’unité de l’étiquette (g ou ml), puis enregistrer.
La saisie manuelle reste disponible sans source externe ni modèle IA.

## Source et confidentialité

Seul Open Food Facts est actuellement connecté, en lecture publique sans clé.
Les résultats montrent marque, code, valeur pour 100 g/100 ml et date de consultation.
Un lien vers la fiche accompagne la sélection et l’entrée enregistrée. Attribution
Open Food Facts/ODbL affichée ; aucune image produit copiée. Une fiche peut être
incomplète ou erronée : vérifier l’étiquette. Les kcal absentes ne deviennent pas zéro
et empêchent l’utilisation automatique de la fiche.

Le serveur envoie à OFF les termes recherchés ou le code, un User-Agent identifiant
l’application et son adresse de dépôt. Il n’envoie ni repas du journal, ni photo,
ni mot de passe. « Seulement les produits déjà consultés » utilise exclusivement
le cache local et n’effectue aucune requête externe.

## Calcul et historique

Open Food Facts nomme les champs normalisés `_100g`, y compris pour certains
produits liquides dont l’étiquette est pour 100 ml. L’application ne déduit donc
pas automatiquement l’unité. L’utilisateur doit la confirmer d’après l’étiquette ;
aucune densité n’est inventée et aucun ml n’est converti en g.

Calcul : énergie de référence × quantité / 100, arrondi au dixième de kcal.
Une valeur en kJ explicite peut être convertie avec 1 kcal = 4,184 kJ. Le serveur
recoupe la sélection avec son cache, puis calcule lui-même l’énergie. Une fiche
modifiée entre sélection et ajout exige une nouvelle sélection.

L’entrée garde un instantané : fournisseur, code, URL, licence, date de source,
date de consultation, énergie pour 100 unités, quantité et unité confirmée.
Une mise à jour du catalogue ne change jamais rétroactivement les totaux.
Changer seulement le repas conserve cet instantané. Une correction manuelle du
nom ou des kcal retire l’attribution automatique ; rechercher à nouveau le produit
pour modifier sa portion avec une source. L’export JSON contient l’instantané.

## Cache, quotas et limites

- Cache SQLite privé `.data/nutrition.sqlite`, index plein texte FTS5 ; jusqu’à
  1 000 produits et 200 recherches, renouvellement après sept jours.
- Le catalogue mondial n’est pas téléchargé. Le cache démarre vide, sans aliments
  ni objectif de démonstration. Les entrées du journal sont dans un autre fichier.
- Recherche déclenchée par bouton, maximum dix résultats, une demande distante
  à la fois, sans relance automatique. Budget persistant : 8 recherches et
  12 lectures de produit par minute pour cette installation, sous les limites
  OFF consultées (10 et 15). D’autres clients partageant l’IP peuvent consommer
  la même limite fournisseur ; ses erreurs restent affichées.
- Indisponibilité : résultats locaux si disponibles, avec avertissement quand
  périmés ; sinon erreur explicite et possibilité de saisir manuellement.
- Appels HTTPS vers un seul domaine, redirections refusées, délai de douze
  secondes et réponse JSON limitée à 1 Mo. Pas de collecte de pages arbitraires.
- Accès API protégé par session ; valeurs de référence fournies côté serveur.
  Réponses cachées sur disque en mode privé 0600, exclues de Git et Docker build.
- Installation mono-processus comme le journal. Faire une sauvegarde cohérente à
  l’arrêt du service ; le cache est reconstructible, les instantanés du journal
  permettent de conserver les anciens calculs même sans cache.

Node 24 fournit SQLite nativement ; son API est encore candidate à stabilisation
selon la documentation consultée. Aucun paquet npm de production ajouté.
Dans un environnement imposant un proxy, Node peut nécessiter l’activation de
son support de proxy hérité (utilisé ici pour les essais réels). Ne pas désactiver
la vérification TLS ni contourner la politique réseau.

## Vérification et suite

`npm test`, `npm run check` et les scripts navigateur décrits dans
[VALIDATION.md](VALIDATION.md). Les tests automatisés n’interrogent pas OFF :
ils utilisent des fiches fictives dans un stockage temporaire. Les essais réels
sont rapportés séparément, sans prétendre valider toute la base.

La [photo assistée](FOOD_PHOTO.md) propose désormais un nom, corrigible avant
la recherche. Elle ne déduit ni calories ni portions.

À construire ensuite : Ciqual et USDA, imports plus larges dimensionnés, lecture
par caméra de codes-barres, OCR d’étiquette, recherche
web générale sourcée. Voir [recherche](research/NUTRITION_RESEARCH.md) et
[plan](research/NUTRITION_DATA_PLAN.md).

## Contrats officiels consultés

- [OFF : contrat, quotas et User-Agent](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [OFF : exemples et limites des versions](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/)
- [SQLite natif Node 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
