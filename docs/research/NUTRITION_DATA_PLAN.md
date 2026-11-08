# Plan technique — Données et recherche nutritionnelles

> État ultérieur : le connecteur Open Food Facts, le cache SQLite/FTS5 et les
> portions sourcées sont maintenant implémentés : [état courant](../NUTRITION.md).
> La photo assistée est aussi disponible : [fonctionnement](../FOOD_PHOTO.md).
> Le catalogue USDA local est maintenant livré : [état au 8 novembre](../USDA.md).
> Les constats de recherche et les autres propositions ci-dessous restent datés.


Statut : proposition de construction issue de la [recherche](NUTRITION_RESEARCH.md),
7 novembre 2026. Rien de ce plan n’est présenté comme déjà connecté au journal.

## Frontières

Conserver un serveur simple, une session privée et des modules distincts : portail
à `/`, calories à `/calories`, assistant à `/assistant`. Le journal manuel reste
utilisable sans modèle ni Internet. Pas de microservices ajoutés par défaut.

Prochaine étape recommandée : catalogue/cache SQLite avec index plein texte,
séparé du journal privé actuel. Tester le support SQLite de la version Node retenue,
les imports, transactions et sauvegardes avant introduction. PostgreSQL seulement
si plusieurs instances ou les mesures de charge le justifient. Ne pas déplacer
les journaux existants sans migration sauvegardée et testée.

Importer un noyau générique français quand Ciqual redevient disponible ; mettre en
cache les produits OFF consultés, puis compléter avec USDA. Préparer ensuite des
imports volumineux par lots sur disque dimensionné. Aucun engagement de gratuité
pour une machine permanente. Mesurer disque brut, index, RAM, latence et sauvegardes.

## Contrat de données proposé

Chaque fiche garde fournisseur, identifiant fournisseur, version, GTIN si présent,
nom, marque, pays, état cru/cuit, base 100 g/100 ml/portion, énergie kcal/kJ,
macronutriments, fibres, sodium/sel, micronutriments disponibles, URL source,
licence, date de source, date de récupération, méthode d’extraction et statut de
vérification. Une valeur absente est null, jamais zéro ; conserver les marqueurs
« trace » et limites de détection séparément des nombres.

- Calcul en grammes : kcal de portion = kcal pour 100 g × grammes / 100.
- Une valeur pour 100 ml ne devient pas une valeur pour 100 g sans densité connue.
- Ne pas confondre sodium et sel ni aliment cru et aliment cuit.
- Favoriser produit exact/étiquette et GTIN ; générique Ciqual ou USDA quand adapté.
- Ne pas moyenner silencieusement des fournisseurs contradictoires ; montrer le choix.
- Une reformulation de produit conserve une version/date, même avec le même GTIN.
- Le journal capture la fiche et la portion utilisées au moment de l’ajout : une
  mise à jour du catalogue ne doit pas modifier rétroactivement les totaux privés.
- Garder séparés sources publiques et journal ; jamais de journal ou photo privée
  dans un export de catalogue ou une contribution Open Food Facts.

## Recherche et photos

1. Texte/code-barres : interroger d’abord l’index/cache, puis un fournisseur avec
   quota, délai et résultat « introuvable » explicite. Ne pas rechercher OFF à
   chaque frappe ; utiliser un endpoint dont le contrat est vérifié.
2. Étiquette : lire localement code-barres ou texte ; associer produit et unité ;
   faire confirmer l’OCR et la base de portion avant calcul.
3. Assiette : modèle local pour suggérer des aliments, puis recherche dans le
   catalogue. L’utilisateur corrige les ingrédients et saisit/confirme les grammes.
   Proposer, sans les inventer, une vérification des huiles et sauces.
4. Web : priorité aux bases officielles, fabricants et restaurants publiant leurs
   données. Lire la page source, pas seulement l’extrait de recherche. Extraire
   valeur + unité + portion + URL + date et soumettre à confirmation.
5. Aucune valeur énergétique inventée par le modèle. Sans source/portion fiable,
   garder l’aliment comme proposition non résolue ou permettre la saisie manuelle.

Le moteur de recherche web général reste à choisir et son accès/quotas à vérifier.
La recherche Wikipédia existante n’est pas un catalogue nutritionnel. La collecte
Firecrawl/Exa réalisée pour le dossier n’installe pas ces services dans le SaaS.

## Accès, confidentialité et sécurité

Les photos restent sur le serveur local pour l’inférence, avec durée de rétention
minimale et suppression documentée. Les requêtes externes utilisent seulement les
termes nécessaires, sans exporter le journal ou la photo. Les clés fournisseur,
si utilisées, sont côté serveur et hors Git.

Pour les pages web : liste de sources autorisées au départ, blocage des adresses
privées/loopback et vérification des redirections, limites de taille/durée/type,
texte non exécutable. Une page ou sortie de modèle ne donne jamais une instruction
outil privilégiée. Conserver les limites d’origine, de session et de charge.

## Vérifications avant intégration des connecteurs

- Échantillons versionnés non personnels par fournisseur ; permissions de
  redistribution des fixtures vérifiées ; conversions, valeurs absentes, erreurs
  réseau/quota et conflits de fiches testés.
- Migration/reprise vérifiée sur copie du journal, export avant changement,
  journal historique inchangé après rafraîchissement des fiches.
- Benchmark proposé d’environ 50 plats variés avec ingrédients et masses pesés,
  et référence nutritionnelle traçable. Séparer les recettes proches entre
  développement et test ; aucune précision annoncée avant mesure.
- Mesurer rappel des candidats, erreur de portion en grammes, erreur absolue
  énergétique en kcal, erreur relative avec traitement explicite des zéros,
  biais/limites d’accord, taux de correction, couverture, latence et mémoire CPU.
  Ce pilote est une vérification technique, pas une validation clinique.
- Essayer des plats mixtes, huiles invisibles, portions différentes, étiquettes
  floues, unité manquante et absence de réseau ; aucun enregistrement automatique.
- Production : version et cible précises soumises à validation humaine préalable.
