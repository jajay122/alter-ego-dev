# Hébergement du petit assistant

## Choix courant

Le modèle est installé avec le serveur du SaaS. Le téléphone affiche l’interface ;
il ne recharge pas les poids pour chaque demande. Le serveur Node.js et le moteur
llama.cpp doivent rester actifs sur une machine disposant de CPU, de mémoire et
de disque. SmolVLM-256M et llama.cpp sont gratuits, sans appel d’IA facturé.

Un hébergement gratuit de pages ou de fonctions à courte durée n’offre pas, à lui
seul, un processus de modèle permanent. La piste Vercel et la base Supabase ne
sont donc pas nécessaires pour ce prototype. Aucun projet existant n’a été modifié.

## Modes fournis

- Machine locale : npm run model:install, npm run model:start et npm start.
  Ports liés à 127.0.0.1 par défaut.
- Serveur : compose.yaml maintient les processus avec restart unless-stopped,
  sépare le réseau du modèle et prépare un port local pour un proxy HTTPS.
  PUBLIC_ORIGIN doit correspondre exactement à l’URL publique HTTPS.

Il reste à choisir et configurer une machine permanente. Aucun abonnement,
domaine, machine de production ou tunnel public n’est créé par ce changement.
Le budget de démarrage est 0 € ; ne pas présumer qu’une ressource permanente
adaptée sera disponible gratuitement. Toute dépense demande un accord préalable.

## Conditions avant publication

Mot de passe privé configuré hors Git, HTTPS, moteur non exposé publiquement,
versions et empreintes vérifiées, contrôles d’accès et tâches réels testés,
procédure d’arrêt disponible et approbation humaine de la version et de la cible.
Un redémarrage de l’application révoque les sessions. Aucun historique utilisateur
n’est stocké sur disque dans cette version.
