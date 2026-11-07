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

## Mise à jour : portail et recherche nutritionnelle — 7 novembre 2026

- `npm test` : 26 tests réussis, aucun échec, aucun test ignoré.
- `npm run check` et `git diff --check` : réussis.
- `PLAYWRIGHT_MODULE=/tmp/alter-ego-browser/node_modules/playwright/index.mjs node scripts/calories-browser-check.mjs` : réussi dans Chromium.
- Portail de deux applications : ouverture du suivi et de l’assistant vérifiée ;
  rendu à 360 et 1 365 pixels sans débordement horizontal ; capture mobile examinée.
- Session ouverte depuis le journal reconnue dans le portail ; verrouillage depuis
  le portail puis export refusé avec HTTP 401. Aucune erreur JavaScript de page.
- Régression du journal : saisie, correction, jours, export, suppression, repère
  facultatif et reprise après redémarrage toujours vérifiés avec stockage temporaire.
- Liens relatifs : 13 documents Markdown contrôlés, aucun chemin absent.
- Recherche : pages officielles et publications citées dans le dossier ; le
  sous-site Ciqual renvoyait une maintenance 503, distincte de la page ANSES accessible.

Non effectués : import de base alimentaire, connexion nutritionnelle photo/web,
benchmark alimentaire du modèle, test Android physique, nouvelle construction
Docker et déploiement. Les chiffres des sources ne constituent pas une mesure
nutritionnelle ni une preuve de couverture de notre application.

## Mise à jour : recherche alimentaire et portions — 7 novembre 2026

- `npm test` : **36 tests réussis** (26 existants et 10 nouveaux), aucun échec
  ni test ignoré. Nouveau périmètre : valeurs absentes/zéro/kJ, contrat HTTP,
  cache/reprise/FTS5, quotas persistants, concurrence, formats invalides, source
  figée, correction manuelle, unité/quantité obligatoires, cache corrompu et API privée.
- `PLAYWRIGHT_MODULE=/tmp/alter-ego-browser/node_modules/playwright/index.mjs node scripts/calories-browser-check.mjs` : régression portail/journal réussie.
- `PLAYWRIGHT_MODULE=/tmp/alter-ego-browser/node_modules/playwright/index.mjs node scripts/nutrition-browser-check.mjs` : parcours réussi avec fournisseur simulé,
  à 360 et 1 365 pixels. Produit incomplet désactivé, confirmation de l’unité,
  calcul 123,4 × 125 / 100 = 154,3 kcal, persistance de la source après rechargement,
  conservation lors du changement de repas, cache local sans réseau, code-barres
  saisi, retour manuel et message d’indisponibilité vérifiés. Aucune erreur de page.
- Le premier passage de ce script a détecté une option HTML mal fermée ; corrigée,
  puis parcours complet relancé avec succès. Capture mobile examinée ; formulaire
  défilable dans la fenêtre modale, sans débordement horizontal.
- Essais réels séparés avec `NODE_USE_ENV_PROXY=1` : code-barres public
  `3017620422003` retrouvé via v3.6, sans énergie dans la réponse reçue (null conservé) ;
  recherche `yaourt nature` par endpoint historique, dix produits retournés, dont
  `6111242100206` à 78,5 kcal/100 unités. Valeurs observées, pas vérité nutritionnelle
  certifiée. Cache temporaire supprimé ; aucune donnée ajoutée au journal réel.
- L’essai sur le serveur de test avec ses identifiants HTTP publics de démonstration
  a été refusé par le contrôle automatique d’approbation, à cause de leur transmission
  externe. Aucun identifiant transmis ; alternative en lecture publique sans
  authentification autorisée et réussie. Aucun besoin de lever ce refus.

Pas de téléchargement du catalogue mondial, de connexion Ciqual/USDA, de benchmark
photo/OCR, de scan caméra, de web général ou de test physique Android. Pas de nouvelle
construction Docker ni de déploiement. Les tests réseau réels prouvent deux parcours
ponctuels, pas une disponibilité permanente. Attribution et liens sources visibles ;
pas d’audit juridique complet de toutes les redistributions possibles.

Contrôles de clôture de cette mise à jour : `npm run check` et `git diff --check`
réussis ; liens relatifs de 14 documents vérifiés, aucun chemin absent.

## Mise à jour : photo alimentaire assistée — 7 novembre 2026

- `npm test` : **42 tests réussis**, aucun échec ni test ignoré (36 existants et
  6 nouveaux). Accès privé/origine, validation et taille d’image, consigne serveur,
  absence de requête externe et d’écriture photo, réponses inutilisables/tronquées,
  moteur absent/externe, verrou et quota partagés avec l’assistant vérifiés.
- `npm run check` et `git diff --check` : réussis sur les changements.
- `PLAYWRIGHT_MODULE=/tmp/alter-ego-browser/node_modules/playwright/index.mjs node scripts/photo-browser-check.mjs` : parcours simulé réussi à 360 et
  1 365 pixels. Envoi explicite, JPEG réduit à 512 pixels, absence d’un marqueur de
  commentaire JPEG du fichier d’origine dans le contenu envoyé, candidat modifiable,
  recherche externe explicite, portion confirmée et source dans le journal vérifiés.
- Ce script vérifie aussi UNKNOWN sans remplacement, panne du modèle puis saisie
  manuelle, annulation, réponse tardive ignorée, fermeture/réouverture, fichier
  illisible, retrait de photo et verrouillage. Aucune erreur JavaScript de page ;
  pas de débordement horizontal. Capture mobile examinée, formulaire défilable.
- Régression `scripts/calories-browser-check.mjs` réussie : portail, journal,
  date Paris au passage du jour UTC, persistance après redémarrage, export,
  correction, suppression et verrouillage. Le premier passage avait interrogé
  la date avant initialisation du nouveau module ES ; attente de l’interface prête
  ajoutée, puis date correcte confirmée. Pas de modification du calcul de date.
- Régression `scripts/nutrition-browser-check.mjs` exécutée séparément, source OFF
  simulée et stockage temporaire ; voir les résultats de clôture ci-dessous.

### Essais réels du moteur local

Le moteur llama.cpp natif existant a été relancé avec les poids SmolVLM-256M
installés et le contexte de 2 048 tokens, sans téléchargement de nouveaux poids.

- Photo publique : [Banana-Single.jpg sur Wikimedia](https://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg).
  L’image originale 3 030 × 2 670 a provoqué une réponse HTTP 400 du moteur :
  2 104 tokens pour un contexte de 2 048. Un premier parcours à 1 024 pixels n’a
  pas fourni de candidat attendu au navigateur dans son délai. La préparation
  a été ramenée à 512 pixels sur le grand côté.
- `PHOTO_REAL_IMAGE=/tmp/alter-ego-photo-banana.jpg PLAYWRIGHT_MODULE=/tmp/alter-ego-browser/node_modules/playwright/index.mjs node scripts/photo-browser-check.mjs` :
  réussi après correction et sur l’interface repliable finale. Photo préparée
  à 512 × 451, réponse réelle « Banana. », candidat affiché, un appel local et
  zéro appel catalogue ; aucune erreur JavaScript. Aucun ajout au journal réel.
- Image synthétique rouge : réponse réelle « The food visible in this photo is
  not specified, but it is red. ». Le premier filtre avait laissé passer le
  fragment « but it is red » ; rejet de la phrase entière ajouté et testé.
  Nouvel essai réel : même réponse, liste de candidats vide. Aucun aliment inventé
  par le code pour compenser cette réponse inexploitable.

Les essais réels utilisent une image publique et une image synthétique, dans des
journaux temporaires supprimés ensuite. Images et captures restent hors Git.
Ces deux cas ne sont pas un benchmark : précision, faux positifs et plats mixtes
ne sont pas caractérisés. Aucune promesse de mesure de portion, d’énergie ou d’OCR.
Pas de test Android physique, nouveau build Docker ou déploiement en production.

Clôture : régression du parcours nutritionnel réussie, aucune erreur de page ;
liens relatifs de 15 documents vérifiés, aucun chemin absent. Analyse syntaxique
et contrôle du diff réussis après les derniers changements.
