# ALTER EGO — Vie parallèle : MVP v0.1

## Vision
Une simulation locale, textuelle et explicable : l'utilisateur configure son avatar, observe une petite société virtuelle et fait avancer le temps.

## Hypothèses
- Prototype sans compte, sans backend et sans modèle IA distant.
- Les personnages utilisent des règles déterministes simples ; aucune conscience ni fidélité psychologique n'est revendiquée.
- Le profil est fictif ou renseigné volontairement ; ne pas saisir de données sensibles.
- Les données sont conservées uniquement dans le navigateur (localStorage) ; elles peuvent disparaître si le stockage est effacé.

## Parcours
1. Ouvrir index.html dans un navigateur.
2. Modifier le nom, le trait dominant et l'objectif de l'avatar.
3. Cliquer sur « Faire avancer 1 heure ».
4. Observer les déplacements, interactions et souvenirs dans le journal.
5. Réinitialiser la simulation au besoin.

## Critères d'acceptation
- L'application s'affiche sur écran mobile sans service externe.
- L'avatar est modifiable et son profil persiste après rechargement si le navigateur autorise localStorage.
- Chaque cycle avance l'horloge d'une heure et ajoute un événement horodaté.
- Au moins trois personnages secondaires possèdent un lieu, un objectif et une mémoire récente.
- Les interactions sont visibles et ne sont pas présentées comme des comportements humains prédictifs.
- La réinitialisation demande confirmation et supprime les données locales de cette simulation.

## Architecture
- Frontend : HTML, CSS, JavaScript sans dépendances.
- Moteur : transitions d'état locales, reproductibles à partir de règles.
- Stockage : localStorage avec validation simple du schéma.
- Pas de serveur ni d'API dans cette version.

## Évolutions possibles
Mémoire structurée, objectifs hiérarchiques, simulation multi-agents, évaluation de la fidélité du double, moteur IA et stockage chiffré. Toute connexion à des données personnelles exigera un cadrage spécifique de sécurité et confidentialité.
