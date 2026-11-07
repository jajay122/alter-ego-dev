# Suivi calories — Première application privée

## Demande

Le propriétaire souhaite commencer par une application de suivi de calories.
Cette application est un module sur /calories ; l’accueil / regroupe les outils.
Le petit assistant est conservé sur /assistant ; le journal ne dépend pas du modèle.

## Parcours

Se connecter, choisir la journée, saisir un aliment et les kcal de la portion,
consulter le total, corriger une entrée si nécessaire et retrouver ses données
après redémarrage. Exporter son journal pour en conserver une copie.

## Données et règles

Une entrée contient un identifiant, un nom de 1 à 120 caractères, une date civile,
un repas et les calories de la portion (0 à 10 000 kcal, une décimale maximum).
Les repas sont petit-déjeuner, déjeuner, dîner et collation. La date est celle
choisie par l’utilisateur ; elle ne doit pas basculer au jour UTC du serveur.

Les calories sont stockées en dixièmes de kcal et additionnées comme des entiers.
Le chiffre saisi concerne la portion consommée : l’application n’effectue aucune
conversion implicite depuis une valeur pour 100 g. Les données ne sont pas
estimées par IA ni tirées d’une base alimentaire non vérifiée.

L’objectif est facultatif, entier et défini par l’utilisateur, sans valeur
par défaut. Il sert de repère pour toutes les journées consultées, pas de
prescription ni d’objectif historique distinct par journée. Le champ vide
retire l’objectif.

## Critères de validation

| ID | Résultat attendu |
| --- | --- |
| CAL-01 | Le journal et l’export sont inaccessibles sans session. |
| CAL-02 | Une journée vide affiche zéro sans aliment fictif ni objectif imposé. |
| CAL-03 | Un ajout valide reste disponible après rechargement et redémarrage. |
| CAL-04 | Les totaux quotidiens et par repas restent exacts avec des décimales. |
| CAL-05 | La date sélectionnée sépare correctement les journées, y compris selon le fuseau du téléphone. |
| CAL-06 | Une modification met à jour le total ; une version obsolète est refusée. |
| CAL-07 | La suppression demande confirmation et retire la bonne entrée. |
| CAL-08 | Une nouvelle tentative du même ajout ne crée pas de doublon. |
| CAL-09 | Un fichier illisible ou un échec de stockage produit une erreur et aucune fausse confirmation. |
| CAL-10 | L’export contient toutes les journées et le repère personnel. |
| CAL-11 | Les parcours restent utilisables à 360 pixels de large et sans moteur IA. |
| CAL-12 | La déconnexion retire les informations privées de l’interface et révoque l’accès API. |

## Limites

Un propriétaire et un processus serveur ; fichier JSON local sur un volume
persistant. Une exécution multi-instance nécessiterait un stockage transactionnel
partagé. Les exports sont privés et ne doivent pas être ajoutés au dépôt.

Pas de scan de code-barres, reconnaissance des aliments par photo, macros,
base de produits, import par interface ou recommandation d’apport dans cette
première version. Ces extensions pourront être décidées ensuite.

- [Validation](VALIDATION.md)
- [Architecture](ARCHITECTURE.md)

## Extensions demandées

Catalogue étendu, recherche par photo et recherche web nutritionnelle :
[recherche et priorités](research/NUTRITION_RESEARCH.md),
[plan de construction](research/NUTRITION_DATA_PLAN.md). À développer.
