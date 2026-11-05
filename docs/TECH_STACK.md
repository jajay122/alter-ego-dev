# Stack et prérequis — ALTER EGO

## Choix pour le premier parcours

Décision d’architecture documentaire ; aucun framework n’est encore installé.

| Besoin | Choix | Raison |
| --- | --- | --- |
| Interface et serveur | Next.js App Router avec TypeScript | Une seule application web, routes serveur et interface Android responsive. |
| Présentation | CSS simple, composants accessibles | Dépendances limitées ; pas de moteur de jeu nécessaire pour le premier quartier textuel. |
| Connexion | Supabase Auth, connexion GitHub proposée | Compte GitHub déjà utilisé ; session vérifiée côté serveur et identité propriétaire explicitement autorisée. |
| Sauvegarde | Supabase PostgreSQL avec politiques RLS | Persistance et permissions du propriétaire, sans serveur de base à administrer. |
| Modèle | Gemini textuel éligible Free Tier, famille Flash-Lite à vérifier dans le compte | Choix motivé par le budget ; appels serveur directs au fournisseur. |
| Hébergement | Vercel Hobby sous condition d’usage personnel non commercial | Piste gratuite existante ; aucune liaison ni publication réalisée. |
| Vérification future | TypeScript, analyse statique, tests du moteur et parcours navigateur | Choisir et installer les outils lors de l’implémentation, sans inventer de résultats. |

Ne pas ajouter de passerelle IA facturée : l’offre gratuite directe du fournisseur
doit rester vérifiable. Ne pas figer un identifiant de modèle non confirmé dans le
compte. Les versions seront choisies et verrouillées au début de l’implémentation.

## Structure cible

```text
app/                      interface et routes serveur
lib/auth/                 identité propriétaire et sessions
lib/simulation/           règles, opérations et validation des intentions
lib/models/               adaptateur Gemini réservé au serveur
lib/data/                 lecture et sauvegarde autorisées
```

Ce schéma n’est pas une arborescence déjà créée. Le portail et Vie parallèle
restent deux domaines distincts dans une seule application web pour démarrer :
catalogue sous une route, simulation sous une autre, sans appel réseau entre
eux. Une extraction en applications déployées séparément pourra être décidée
si un besoin réel apparaît. Les fiches du catalogue pourront aussi référencer
des applications externes. Ne pas créer une architecture de microservices.

## Contrôle d’accès retenu

Connexion GitHub ne signifie pas autorisation pour tous les utilisateurs GitHub.
Le serveur vérifie le jeton et compare l’identité Supabase à l’identité propriétaire
configurée. Absence d’identité propriétaire configurée : accès refusé.

Les politiques RLS protègent chaque table exposée et contrôlent le propriétaire
autorisé et l’appartenance du monde. Vérifier également les mises à jour pour
empêcher la réattribution de propriété. Ne pas utiliser une simple valeur
user_metadata, modifiable par l’utilisateur, pour accorder des droits.
La clé privilégiée de Supabase ne sert pas au navigateur ni aux opérations
ordinaires de la simulation. Aucun secret n’est stocké dans une fiche du portail.

## Vérifications observées le 5 novembre 2026

| Vérification | Résultat observé | Limite |
| --- | --- | --- |
| GitHub | Lecture, création de branches et fusion de PR fonctionnelles. | Ne prouve pas les droits d’hébergement. |
| Connecteur Vercel | Liste des projets accessible ; aucun associé à ce dépôt dans le contexte retourné. | Pas de projet relié ; plan et périmètre personnel à confirmer lors de la liaison. |
| Connecteur Supabase | Liste des projets accessible ; projets existants sans lien identifié avec ALTER EGO. | Aucun réutilisé, restauré ou modifié ; choix d’un projet dédié restant à faire. |
| Environnement | Node.js 24.22.1 et npm 11.9.0 disponibles. | Aucune dépendance installée. |
| Outils locaux | CLI Vercel et Supabase absentes. | Connecteurs accessibles pour les lectures ; installation éventuelle à prévoir. |
| Configuration locale | Variables Gemini et configuration Supabase attendues absentes. | Aucun appel de modèle ni connexion applicative validée. |
| Runtime géré | Aucune liaison de secret déclarée ; indicateur de connectivité offline. | Ne permet pas de conclure sur un futur appel réseau depuis le terminal. |

Contrôles locaux effectués : présence des exécutables avec shutil.which, présence
des variables avec bool(os.environ.get(...)), puis node --version et npm --version.
Aucune valeur de secret affichée. Les listes de projets ont été consultées en
lecture seule. Les détails des projets sans rapport ne sont pas reproduits ici.

## Configuration à fournir au moment de la mise en œuvre

| Variable prévue | Usage | Exposition |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL du projet choisi. | Publique par conception. |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clé publiable, permissions bornées par Auth et RLS. | Publique par conception ; aucune clé privilégiée à sa place. |
| OWNER_USER_ID | Identité Supabase autorisée. | Serveur. |
| GEMINI_API_KEY | Accès au niveau gratuit du fournisseur. | Secret serveur uniquement. |
| GEMINI_MODEL | Identifiant réellement disponible et gratuit. | Configuration serveur. |

Ces noms sont une convention prévue, pas la preuve d’une configuration.
Les limites d’appels et tokens seront configurées après lecture des quotas réels.
Stocker les secrets dans les paramètres sécurisés de l’environnement et de
l’hébergeur ; ne jamais les demander dans le chat ou les inclure dans le dépôt.

## Ordre de préparation

1. Identifier ou créer un projet Supabase dédié compatible avec 0 € ; ne pas
   détourner une base existante sans en avoir confirmé l’usage.
2. Préparer l’identité propriétaire et la connexion GitHub dans Supabase.
3. Identifier le projet Gemini gratuit et ses quotas ; ajouter la clé par un
   mécanisme sécurisé, sans en publier la valeur.
4. Préparer la liaison Vercel et la configuration d’environnement ; empêcher
   toute publication en production sans approbation humaine.
5. Initialiser les dépendances et verrouiller les versions, puis vérifier les
   accès avant migrations et serveur de développement.
6. Réaliser le parcours à un personnage décrit dans le plan ; distinguer les
   tests à faux fournisseur d’une génération réelle.

L’authentification, la sauvegarde et la génération ne sont pas encore validées.
Aucune migration, création de service, dépense ni publication effectuée.

## Sources consultées

- [Next.js : installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase : authentification serveur Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Gemini : sorties structurées](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini : tarification](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini : quotas](https://ai.google.dev/gemini-api/docs/rate-limits)

## Références

- [Architecture](ARCHITECTURE.md)
- [Plan de Vie parallèle](apps/VIE_PARALLELE_PLAN.md)
- [Hébergement gratuit](HOSTING.md)
