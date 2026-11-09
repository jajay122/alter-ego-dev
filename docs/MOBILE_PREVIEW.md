# Aperçu privé sur téléphone

Version 1 publiée le 8 novembre 2026 après validation explicite du propriétaire.

- [Portail ALTER EGO](https://alter-ego-apercu-mobile-20261108.jay789456.chatgpt.site)
- [Application calories](https://alter-ego-apercu-mobile-20261108.jay789456.chatgpt.site/calories/)

Ouvrir dans Chrome Android et se connecter avec le même compte ChatGPT que dans
cette conversation. Le Site est réservé au propriétaire : aucune ouverture au
public ni invitation d’autres utilisateurs n’a été effectuée. Un raccourci peut
être ajouté via le menu Chrome « Ajouter à l’écran d’accueil » ; il ne s’agit
pas d’une application Android native ou d’une PWA hors ligne complète.

## Fonctionnement exact de cette version

Le portail et les écrans sont dérivés des fichiers publics du dépôt. Un adaptateur
spécifique à l’aperçu conserve le journal dans localStorage sur cet appareil,
avec états vides sans aliments ni objectif fictifs, portions, modification,
suppression, repère facultatif et export. Le catalogue USDA public de 8 217
fiches est livré en JSON ; une recherche le charge sur le téléphone.

Les données du journal ne sont pas envoyées au serveur de développement et ne se
synchronisent pas entre appareils. Exporter avant de changer de navigateur ou
d’effacer son stockage. L’accès privé repose sur Sites/ChatGPT, pas sur le mot
de passe de l’application Node ; les contrôles de mot de passe/verrouillage du
prototype sont masqués dans cet aperçu.

Le moteur IA local, OFF côté serveur et la lecture nutritionnelle de pages web
ne sont pas reliés à cet aperçu statique. L’interface de l’assistant explique
cette limite. Aucun résultat IA fictif n’est renvoyé ; la recherche USDA et la
saisie manuelle permettent d’essayer le journal. Le code serveur complet continue
d’évoluer dans GitHub ; ce lien correspond précisément à la version 1 approuvée.

## Traçabilité de publication

- Site : `appgprj_6af02c9979648191a6559b395dc578df`.
- Source Sites distincte : `/workspace/sites/alter-ego-apercu-mobile`.
- Commit publié : `1654684fd5937aa2bb35b03a460d2cc2b68b284f`.
- Version : `appgprj_6af02c9979648191a6559b395dc578df~appgver_b5385ec5202081919b6e9263e185332c`.
- Déploiement : `appgdep_6af02e177f9881919988757aaacc535e`, résultat `succeeded`.
- Accès vérifié par l’API Sites : propriétaire seul, aucun groupe ou visiteur externe.
- Autorisation humaine : « Publier cet aperçu privé », portant sur cette version,
  ce domaine, le stockage sur appareil et l’absence de moteur IA connecté.

Le journal existant, les modèles, les clés et les données privées n’ont pas été
copiés dans le Site. L’archive ne contient que manifeste, fichiers publics et
catalogue USDA CC0. Les identifiants d’écriture Sites ne sont pas stockés dans
le dépôt. Aucun hébergement permanent du moteur Node/llama.cpp n’est établi.

## Version 2 préparée le 9 novembre 2026

La version 1 ci-dessus reste la version publiée tant que la nouvelle autorisation
n’est pas obtenue. La version 2 sauvegardée réunit portail, calories, assistant et
Atelier sur le même domaine ; voir [HOSTED_V2.md](HOSTED_V2.md) pour son fonctionnement
et [VALIDATION.md](VALIDATION.md) pour les limites des contrôles.

- Source Sites : `8ac7e5cdb207d892a0725d69917b32ee63fde65e`.
- Version sauvegardée : `appgprj_6af02c9979648191a6559b395dc578df~appgver_239c13eab13c8191b076a3126c6dad39`.
- SHA-256 de l’archive : `98f78facea5e49ee7d9c32f9a54729f4472c9755b292a183a4b266580e51a610`.
- Cible : même URL privée, même propriétaire seul ; nouvelle base D1 pour les données.
- État : sauvegardée, **publication en attente d’approbation humaine de cette version**.

Le journal v1 n’est pas transféré automatiquement : une commande d’import explicite
lit sa copie locale et conserve celle-ci. Les modèles gratuits se téléchargent à
la demande sur l’appareil ; leur fonctionnement Android et la vision restent à
valider. L’Atelier traite les rôles successivement tant que l’onglet reste actif ;
il ne garantit pas une exécution après fermeture ou suspension du téléphone.
