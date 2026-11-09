# Roadmap — ALTER EGO

## Disponible dans le dépôt

- Portail commun / avec deux applications : suivi /calories et assistant /assistant.
- Journal manuel privé : jours, repas, totaux, correction, suppression, repère
  facultatif et export ; persistance et contrôle des versions.
- Recherche Open Food Facts par nom/code-barres saisi, cache SQLite/FTS5 et portions
  confirmées avec provenance figée.
- Catalogue USDA local : Foundation et SR Legacy, 8 217 fiches dans l’import vérifié.
- Photo alimentaire assistée, corrigible avant recherche explicite et portion confirmée.
- Assistant local facultatif texte/photo/Wikipédia ; aucune API d’IA distante.
- Lecture web de recettes compatibles, portion explicite et provenance conservée.
- Aperçu mobile privé version 1 publié avec approbation ; journal sur appareil.
- Serveur Node/IA local non déployé en production ; dix responsabilités de collaboration.

## Prochaine construction : module nutrition

La [recherche](research/NUTRITION_RESEARCH.md) et le
[plan technique](research/NUTRITION_DATA_PLAN.md) explicitent sources et limites.
Le connecteur OFF est branché ; le cache ne contient que les produits consultés,
pas le catalogue mondial complet. USDA dispose d’un catalogue importé séparé.
La photo assistée est branchée ; Ciqual, OCR d’étiquette et web général restent
à construire.

| Priorité | Travail | Condition de fin |
| --- | --- | --- |
| Livré (USDA) | Catalogue local Foundation + SR Legacy. | Import vérifié, source/version conservées, aucune recherche externe, unités en g uniquement. |
| P0 | Connecter Ciqual quand son accès officiel est rétabli. | Export/licence vérifiés, index français et import sans perte testés. |
| Livré (OFF) | Recherche texte et code-barres saisi, portions en g/ml. | Calcul serveur et instantané vérifiés ; scanner caméra non livré. |
| Prototype livré | Photo assistée. | Parcours et essais ponctuels vérifiés ; benchmark alimentaire à réaliser, précision non établie. |
| P1 | OCR d’étiquette local. | Valeurs et unités sourcées puis confirmées ; aucun ajout automatique. |
| Prototype livré (Node) | Lecture web de recettes compatibles. | Ouverture de recherche, URL explicite, portion sourcée, contrôles et instantané vérifiés ; autres formats à étendre. |
| P2 | Recettes pesées, favoris, duplication, macros/fibres/sel. | Calcul de rendement et couverture explicites ; pas de valeur manquante remplacée par zéro. |
| P2 | Bilan hebdomadaire et rappels facultatifs. | Journées complètes distinguées des absences ; aucune promesse médicale. |
| P2 | Fiches administrables des prochaines applications. | Ajout/modification privés, liens réels, navigation Android vérifiée. |

## Mise en service indépendante

Choisir une machine et dimensionner CPU/RAM/disque, prévoir sauvegarde et HTTPS,
configurer les secrets hors Git, puis soumettre version et cible exactes à
validation humaine avant production. Aucun hébergement permanent gratuit ou
service externe illimité n’est garanti. Voir [VALIDATION.md](VALIDATION.md).

## Version 2 — demandée le 9 novembre

Préparée : interface unifiée Android, D1, favoris/copie/semaine, import v1,
sources OFF/web accessibles dans le Worker, Assistant avec outils fiables et
modèles navigateur optionnels, Atelier de dix rôles. Voir [HOSTED_V2.md](HOSTED_V2.md).
Publication sur le même lien après validation humaine ; essais réels Android
nécessaires pour qualifier mémoire, performance et qualité des modèles.
