# Vie parallèle — Écrans et plan de réalisation

## Statut

Plan documentaire, sans implémentation ni déploiement. Le portail privé, Vie
parallèle et le recours à des modèles gratuits sont confirmés. Les choix de
framework, d’authentification, de stockage et de modèle exact restent à vérifier.
Référence produit : [VIE_PARALLELE.md](VIE_PARALLELE.md).

## Écrans proposés pour Android

Navigation simple : Quartier, Personnages et Journal ; une conversation s’ouvre
depuis la fiche d’un personnage. Le retour au portail reste accessible.

| Écran | Contenu et actions | États nécessaires |
| --- | --- | --- |
| Accès privé | Connexion puis reprise de session autorisée. | Déconnecté, connexion en cours, identité refusée, session expirée. |
| Accueil | Nouvelle partie ou reprise, date simulée, dernière sauvegarde. | Aucun monde, chargement, sauvegarde disponible, erreur de lecture. |
| Quartier | Lieux, personnages présents, heure simulée ; avancer d’une étape. | Prêt, étape en cours, pause, quota épuisé, erreur ; pas de double lancement. |
| Personnage | Personnalité, objectif, activité, lieu et souvenirs pertinents ; parler. | Aucun souvenir, conversation accessible, personnage occupé. |
| Conversation | Historique court, saisie et envoi d’un message. | Réponse en cours, réponse reçue, erreur, quota épuisé ; message conservé après échec. |
| Journal | Événements datés et personnages concernés. | Vide, chargement, événements enregistrés ; distinction d’une intention non appliquée. |

Exemple de structure du quartier, sans données présentées comme réelles :

```text
ALTER EGO — Vie parallèle         Retour au portail
Jour [date simulée] · [heure]     [En pause]
Quartier : [lieux et personnes]
[Avancer d’une étape]
Dernière sauvegarde : [état réel]
Quartier       Personnages       Journal
```

L’horloge peut afficher un jour fictif ; l’état de sauvegarde et la disponibilité
du fournisseur doivent toujours refléter les observations réelles.

## Accessibilité et présentation

Interface en français, sans défilement horizontal à 360 pixels CSS. Commandes
tactiles d’au moins 44 pixels CSS, focus visible, libellés de champs et erreurs
associées. Ne pas coder un état uniquement par sa couleur. Prévoir contraste de
niveau WCAG AA, texte redimensionnable et réduction des animations.

Les retours sur chargement, erreur et pause sont annoncés aux technologies
d’assistance. La carte possède une liste textuelle équivalente des lieux et
personnages ; toutes les actions restent possibles sans manipuler la carte.
Ces points devront être vérifiés sur l’interface réelle.

## Premier parcours complet

D’abord un seul personnage : connexion autorisée → création d’un monde →
observation → une décision générative → action validée → sauvegarde → reprise.
Étendre à trois personnages après validation de ce parcours. Les données
d’exemple utilisées pendant les tests seront explicitement signalées.

## Données minimales proposées

| Entité | Informations | Contraintes |
| --- | --- | --- |
| Monde | Identifiant, propriétaire, date simulée, état, version. | Lecture et écriture réservées au propriétaire. |
| Personnage | Identifiant, monde, personnalité, lieu, objectif. | Lieu appartenant au même monde. |
| Souvenir | Personnage, événement source, résumé borné, date. | Relié à un événement enregistré, pas de mémoire prétendue illimitée. |
| Événement | Monde, opération, séquence, action et résultat. | Une seule application par opération et séquence. |
| Opération | Identifiant, version de départ, état, résultat enregistré. | Les nouvelles tentatives reprennent la même opération. |
| Consommation | Compteur de requêtes et tokens, fenêtre, état du quota. | Limites issues du compte réel ; pas de compteur fictif. |

Les réponses brutes du fournisseur ne sont pas des événements validés.
Ne pas conserver de conversations personnelles réelles dans les données initiales.

## Cycle d’une étape

1. Vérifier session, identité autorisée et accès au monde.
2. Vérifier version du monde, absence d’autre étape active et budget disponible.
3. Réserver une opération identifiée et préparer un contexte limité.
4. Appeler le modèle autorisé, côté serveur, avec un délai maximal.
5. Valider la structure, les lieux, les personnages et les actions proposées.
6. Enregistrer l’événement, les souvenirs et la nouvelle version de manière cohérente.
7. Renvoyer l’état réellement sauvegardé au navigateur.

En cas d’erreur ou de quota épuisé, ne pas faire avancer le temps silencieusement.
En cas de conflit de version, recharger l’état avant toute nouvelle action.
Une réponse perdue après sauvegarde doit pouvoir être retrouvée sans appliquer
une seconde fois l’événement. Le fournisseur peut compter un appel interrompu :
prévoir une limite prudente et ne pas promettre exactement un seul appel facturé
ou comptabilisé dans tous les scénarios de panne.

## Ordre des travaux futurs

| Lot | Pilote | Livrable | Condition de fin |
| --- | --- | --- | --- |
| A. Choix et accès | ARCHITECT, SECURITY | Stack, identité propriétaire, modèle éligible, quotas observés. | Accès réels vérifiés sans publier de secrets ; budget gratuit respecté. |
| B. Accès et sauvegarde | BACKEND, DATABASE | Monde privé persistant et contrôle des versions. | Accès refusé aux autres identités ; sauvegarde puis reprise vérifiées. |
| C. Écrans mobiles | DESIGN, FRONTEND | Navigation, quartier textuel et fiches. | Parcours sur Android et états vides/erreurs vérifiés. |
| D. Une décision générative | BACKEND | Adaptateur de modèle, validation et opération reprenable. | Réponse réelle valide appliquée une fois ; erreurs et quotas gérés. |
| E. Trois personnages | FRONTEND, BACKEND | Rencontres, souvenirs et journal. | Cohérence et limites de contexte vérifiées sur le scénario retenu. |
| F. Validation | QA, REVIEWER, SECURITY | Preuves des critères VP-01 à VP-10. | Contrôles disponibles exécutés, limites et échecs rapportés. |
| G. Livraison | DEVOPS | Version candidate, sauvegarde et procédure de retour arrière. | Approbation humaine explicite avant production. |

Les tests du moteur pourront employer un faux fournisseur pour reproduire les
pannes ; ils seront distingués d’une validation réelle du modèle gratuit.
Aucune réussite de connexion, de génération ou de sauvegarde n’est revendiquée
dans ce plan.

## Références

- [Catalogue](../APPLICATIONS.md)
- [Décisions](../DECISIONS.md)
- [Règles communes](../../AGENTS.md)
