# ALTER EGO — Vie parallèle

## Position et décisions confirmées

Première application à référencer dans le portail privé ALTER EGO.
Le portail reste le catalogue ; Vie parallèle porte la simulation et son état.
Le propriétaire confirme une simulation inspirée de Smallville et souhaite
des personnages à IA générative utilisant des modèles gratuits dès le départ.

Ce document cadre le produit ; aucun code, modèle ou service n’est exécuté.
Les nombres, écrans et mécanismes ci-dessous sont des propositions à valider.

## Vision et inspiration

Observer et influencer un petit quartier virtuel dont les personnages ont une
personnalité, des objectifs, des souvenirs et des relations qui évoluent.

La recherche Generative Agents décrit des personnages associant observations,
mémoire, réflexion et planification à un modèle de langage. Elle sert de source
d’inspiration ; cette application n’est ni une reproduction du protocole de
recherche, ni un produit affilié à Stanford.

## Première version proposée

- Un quartier simple avec quelques lieux et trois personnages fictifs.
- Une fiche par personnage : personnalité, activité, objectif et souvenirs récents.
- Une horloge simulée avec avance par étapes et pause.
- Un journal des événements et des rencontres entre personnages.
- Une interaction textuelle avec un personnage.
- Une sauvegarde du monde permettant de reprendre depuis Android.
- Une entrée Vie parallèle dans le catalogue une fois l’application disponible.

La simulation progresse pendant une session active, sans calcul continu lorsque
le téléphone ou l’onglet est fermé. Un monde sauvegardé n’implique pas une
simulation qui tourne 24 h/24.

## Modèles gratuits : piste vérifiée et contraintes

La page officielle Gemini API Pricing consultée le 5 novembre 2026 affiche des
modèles Flash-Lite avec entrées et sorties sans frais au niveau Free Tier.
Cette famille est une piste ; le modèle exact doit être vérifié dans le compte
avant implémentation, selon disponibilité et région. Aucun compte ni clé configuré.

Les limites de requêtes et tokens varient selon le modèle et le projet ; consulter
les quotas réels dans AI Studio. La capacité gratuite n’est pas garantie.
L’abonnement ChatGPT Plus ne constitue pas un crédit d’API pour l’application.

Proposition de fonctionnement :
- Une file de décisions, sans appel à chaque image ou pas d’animation.
- Des limites explicites de requêtes et de tokens, ajustées au quota réel.
- Un contexte court : souvenirs pertinents et résumés bornés.
- Une pause visible en cas de quota épuisé, erreur fournisseur ou absence de clé ;
  sauvegarder l’état et permettre la reprise sans répéter un événement validé.
- Aucune bascule automatique vers un modèle, une option ou une offre payante.
- Règles locales pour le temps, les déplacements et la validation des actions ;
  le modèle propose une intention structurée, le moteur décide si elle est valide.

Le modèle textuel peut être fourni gratuitement sans être un modèle open source.
Les règles de traitement des données du fournisseur restent applicables ; la
tarification Free consultée indique une utilisation des données pour améliorer
les produits, sous réserve des conditions applicables. Partir de personnages
fictifs et ne transmettre ni secrets ni données personnelles réelles.

## Architecture cible proposée

Interface web mobile → moteur de simulation → état et journal persistants.
Le moteur appelle un adaptateur de modèle via le serveur ; aucune clé dans le
navigateur ou Git. La réponse générée est validée avant d’agir sur le monde et
affichée comme texte, jamais exécutée comme code. Les événements validés sont
enregistrés avant de passer à l’étape suivante.

Les permissions du propriétaire doivent protéger lecture, interactions et
sauvegardes, même pour un accès direct hors du portail. Les décisions de connexion,
stockage et hébergement restent à préciser. Aucune base partagée avec le portail
n’est imposée à ce stade.

## Critères d’acceptation proposés

| ID | Résultat attendu |
| --- | --- |
| VP-01 | Le portail distingue une application prévue d’une application réellement disponible ; aucun lien de lancement fictif. |
| VP-02 | Seul le propriétaire peut lire, modifier et reprendre son monde, y compris par accès direct aux opérations. |
| VP-03 | Une nouvelle partie crée les personnages et lieux définis, avec un état initial cohérent et sans fausses données réelles. |
| VP-04 | Avancer le temps déclenche des actions valides ; pause et fermeture n’engendrent aucun calcul permanent en arrière-plan. |
| VP-05 | Une interaction peut produire une réponse du modèle gratuit et un souvenir traçable, sans prétendre à une mémoire humaine ou illimitée. |
| VP-06 | Les événements validés et souvenirs sont retrouvés après sauvegarde puis rechargement ; un échec de sauvegarde est visible. |
| VP-07 | Une réponse de modèle invalide ne corrompt pas le monde ; une reprise après erreur ne duplique pas une action déjà enregistrée. |
| VP-08 | L’épuisement du quota provoque une pause compréhensible, sans boucle de relance ni appel payant. |
| VP-09 | Quartier, fiches, journal et conversation sont utilisables sur Android à 360 pixels CSS de largeur. |
| VP-10 | La clé du fournisseur reste côté serveur, hors dépôt et hors réponses au navigateur. |

Ces critères ne sont pas des résultats de tests.

## Hors périmètre initial

Grande ville, 25 personnages, multijoueur, boutique, monnaie réelle, voix et vidéo,
simulation permanente, copie des assets Smallville et promesse d’autonomie illimitée.

## Sources

- [Article original : Generative Agents](https://arxiv.org/abs/2304.03442)
- [Dépôt de recherche](https://github.com/joonspk-research/generative_agents)
- [Gemini API : tarification](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API : limites](https://ai.google.dev/gemini-api/docs/rate-limits)

## Références internes

- [Catalogue des applications](../APPLICATIONS.md)
- [Produit du portail](../PRODUCT.md)
- [Rôles et règles](../../AGENTS.md)
