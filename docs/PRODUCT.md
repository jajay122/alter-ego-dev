# Produit — Portail privé ALTER EGO

## Besoin et statut

Le propriétaire souhaite regrouper toutes ses futures applications dans un portail
réservé à lui seul, utilisable depuis Android. Cet usage privé est confirmé
(« que pour moi »). Les fonctionnalités suivantes sont proposées pour validation.
Ce cadrage ne déclenche pas de développement.

## Première version proposée

- Connexion réservée au propriétaire, sans inscription publique.
- Tableau de bord avec catalogue d’applications.
- Fiches avec nom, description, catégorie facultative, URL HTTPS et statut déclaré :
  en projet, en développement, disponible ou archivée.
- Ajout, modification et archivage des fiches depuis le téléphone.
- Recherche par nom ou description et filtres par catégorie et statut.
- Bouton Ouvrir pour les applications disponibles avec une URL valide.

Une application en projet peut ne pas avoir d’URL. Le statut est renseigné
manuellement : ce n’est pas une mesure automatique de disponibilité.
Le catalogue démarre vide, sans applications fictives.

## Parcours principal

Se connecter, retrouver une application, l’ouvrir, puis ajouter ou modifier une
fiche et retrouver ses changements après rechargement. Se déconnecter retire
l’accès au portail.

## Critères d’acceptation proposés

| ID | Critère observable |
| --- | --- |
| AC-01 | Sans connexion, aucun accès au catalogue ni aux opérations de gestion, y compris par appel direct ; les droits sont vérifiés côté serveur. |
| AC-02 | Seule l’identité autorisée du propriétaire accède au portail ; une autre identité reste refusée même si elle s’authentifie. |
| AC-03 | Le catalogue vide explique comment ajouter une fiche et ne présente aucun faux projet. |
| AC-04 | Nom, description et statut sont requis ; le statut disponible exige une URL HTTPS valide. Toute entrée invalide produit une erreur compréhensible. |
| AC-05 | Une fiche créée ou modifiée est retrouvée après rechargement et nouvelle connexion. |
| AC-06 | Recherche et filtres se combinent ; un résultat vide est explicite et les filtres peuvent être réinitialisés. |
| AC-07 | Ouvrir mène à l’URL enregistrée ; les protocoles exécutables sont refusés et une fiche sans URL ouvrable n’offre pas ce bouton. |
| AC-08 | Archiver retire la fiche de la vue active ; le filtre des archives permet de la retrouver et de la réactiver. |
| AC-09 | Les parcours fonctionnent sur Android à 360 pixels CSS de largeur sans défilement horizontal ; commandes tactiles utilisables, libellés accessibles et navigation clavier. |
| AC-10 | Chargement et erreur de sauvegarde sont explicites ; un échec n’est jamais annoncé comme une réussite. |
| AC-11 | La déconnexion retire l’accès aux pages et opérations protégées. |
| AC-12 | Ajouter une application ne demande ni modification du code ni redéploiement du portail. |

Ces critères sont des exigences futures, pas des tests déjà exécutés.
Aucune URL enregistrée ne doit contenir de mot de passe, de jeton ou de clé privée.

## Limites de la première version

Les applications restent indépendantes : le portail les référence sans les
héberger, fusionner leurs données ni remplacer leur authentification. Ouvrir un
lien n’accorde aucun droit sur l’application cible.

Comptes clients, abonnements commerciaux, paiements, équipes, génération
automatique d’applications, déploiement depuis le portail, supervision automatique,
application Android native et connexion unique entre applications sont hors périmètre.

## Choix encore ouverts

Méthode de connexion du propriétaire, premières applications à référencer,
stack et hébergement restent à définir. Le propriétaire confirme un budget de
0 € pour le démarrage. Voir [HOSTING.md](HOSTING.md) pour la piste gratuite et ses
limites. Aucun service payant n’est provisionné par ce cadrage.

## Références

- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Décisions](DECISIONS.md)
- [Rôles et règles](../AGENTS.md)

## Première application demandée le 7 novembre 2026

Le propriétaire autorise la création d’un petit assistant texte, photo et
recherche Internet avec un modèle installé côté serveur, sans API d’IA distante.
Le premier prototype est décrit dans [LOCAL_MODEL.md](LOCAL_MODEL.md).
Les critères du catalogue ci-dessus restent un objectif ultérieur ; ils ne
sont pas présentés comme une application déjà construite.
