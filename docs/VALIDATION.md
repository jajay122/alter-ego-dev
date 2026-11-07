# Validation du prototype — 7 novembre 2026

## Contrôles reproductibles

- npm test : **14 tests réussis**, aucun échec ni test ignoré.
- npm run check : syntaxe serveur, adaptateur, interface et scripts vérifiée.
- git diff --check : aucune erreur d’espacement détectée.
- node scripts/install-model.mjs : deux fichiers déjà installés, empreintes
  SHA-256 vérifiées ; aucune clé nécessaire.
- docker compose config --quiet : configuration valide, avec URL et mot de passe
  de test éphémères ; aucun déploiement lancé.
- docker build -t alter-ego-assistant:dev . : construction finale réussie.
  Une première tentative a manqué de disque ; le cache de cette seule construction
  a été retiré et le Dockerfile réduit à une seule copie avant le nouvel essai.

Les tests automatisés de serveur utilisent des réponses de moteur simulées pour
vérifier authentification, révocation, origine, limites de connexion et de tâches,
taille maximale d’image, refus des images déguisées, refus d’un moteur distant,
erreurs, concurrence, sources et protection des fichiers.

## Essais réels du modèle installé

Moteur llama.cpp sur CPU, SmolVLM-256M Q8_0 et projecteur Q8_0 présents sur disque.
Aucun service d’inférence distant appelé.

| Essai | Résultat observé | Portée |
| --- | --- | --- |
| Question « What is 2 + 2? » | Réponse « 2 + 2 = 4 ». | Une question simple, pas une évaluation générale. |
| Image générée pour le test : carré rouge | Réponse « Red », puis « Red. » dans le navigateur. | Couleur simple ; ne prouve pas une reconnaissance générale ou un OCR précis. |
| Recherche « panneau solaire » | Trois liens réels Wikipédia, transmis au modèle comme contexte. | Réponse sommaire, comprenant des extraits ; recherche limitée à l’encyclopédie. |

Ces essais n’attestent pas d’un niveau de français ou de raisonnement comparable
à un grand modèle. Le modèle est principalement anglophone.

## Parcours navigateur réel

Chromium automatisé avec Playwright, serveur de test et mot de passe aléatoire
conservé uniquement en mémoire : mauvais mot de passe refusé, bonne connexion,
état réel du modèle, demande texte, upload et réponse sur image, recherche avec
sources, verrouillage et retrait du résultat privé.

Vérifié à 360 × 800 et 1 365 × 900 pixels : aucun débordement horizontal et aucune
erreur JavaScript de page. Ce n’est pas un essai sur un téléphone Android physique.
Les captures et résultats locaux sont dans artifacts, hors Git.

Pour reproduire, installer Playwright et Chromium dans un environnement de test,
démarrer le moteur local, puis exécuter node scripts/browser-check.mjs.
PLAYWRIGHT_MODULE peut fournir le chemin du module Playwright installé hors dépôt.
Le script choisit un mot de passe éphémère ; aucune valeur n’est affichée.

## Limites restantes

Aucun déploiement de production ou test d’un proxy HTTPS public. Pas de garantie
de disponibilité permanente du serveur de travail. Aucun test physique Android,
audit complet d’accessibilité, évaluation OCR, benchmark de français ou essai
exhaustif sur images complexes. Le modèle peut halluciner et les sources ne
couvrent pas tout Internet. Toute mise en production exige une validation humaine.

## Mise à jour : suivi calories

- npm test : **26 tests réussis** (14 existants et 12 dédiés au journal).
- npm run check et git diff --check exécutés sur la version modifiée.
- Tests du journal : dates civiles, journées distinctes, décimales exactes,
  ajout idempotent, écritures concurrentes d’une instance, version de correction,
  persistance, fichier corrompu, accès privés, export et stockage inaccessible.
- Nouveau serveur démarré dans un test HTTP : entrées conservées, session à refaire.
- Parcours Chromium réel : ajout, modification, date précédente/suivante, repère
  facultatif, export, annulation puis confirmation de suppression, verrouillage
  et reprise après redémarrage effectif du processus serveur.
- Écran de 360 × 800 puis 1 365 × 1 000 pixels : aucun débordement horizontal et
  aucune erreur JavaScript de page. Locale française et fuseau Europe/Paris.
- Date contrôlée : à 23 h 30 UTC le 7 novembre, le journal choisit bien le
  8 novembre à Paris. Le modèle était volontairement indisponible durant le test.
- Configuration Compose vérifiée en mémoire avec un mot de passe éphémère :
  application seule par défaut, volume de journal persistant, modèle optionnel
  via le profil assistant. Aucune valeur de secret affichée, aucun déploiement.

Les données et objectifs utilisés dans les essais navigateur sont fictifs,
saisis dans un dossier temporaire supprimé à la fin. Aucun aliment ni objectif
de démonstration n’est injecté au premier démarrage réel. Les captures sont
locales dans artifacts/calories-mobile.png et artifacts/calories-desktop.png.

Le stockage prévu est mono-processus. Pas de test Android physique ni de reprise
après coupure électrique ou perte complète du volume. Les calories sont des
valeurs manuelles ; leur exactitude nutritionnelle n’est pas vérifiée.
