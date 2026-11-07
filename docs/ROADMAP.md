# Roadmap — ALTER EGO

## Disponible dans le dépôt

- Portail commun / avec deux applications : suivi /calories et assistant /assistant.
- Journal manuel privé : jours, repas, totaux, correction, suppression, repère
  facultatif et export ; persistance et contrôle des versions.
- Recherche Open Food Facts par nom/code-barres saisi, cache SQLite/FTS5 et portions
  confirmées avec provenance figée.
- Photo alimentaire assistée, corrigible avant recherche explicite et portion confirmée.
- Assistant local facultatif texte/photo/Wikipédia ; aucune API d’IA distante.
- Dix responsabilités de collaboration et règles Git ; pas de production déployée.

## Prochaine construction : module nutrition

La [recherche](research/NUTRITION_RESEARCH.md) et le
[plan technique](research/NUTRITION_DATA_PLAN.md) explicitent sources et limites.
Le connecteur OFF est branché ; le cache ne contient que les produits consultés,
pas le catalogue mondial complet. La photo assistée est branchée ; Ciqual, USDA,
OCR d’étiquette et web général restent à construire.

| Priorité | Travail | Condition de fin |
| --- | --- | --- |
| P0 | Catalogue sourcé, index français, cache et contrats OFF/Ciqual/USDA. | Licences/accès revérifiés ; unités, absences, provenance et versions testées ; disque mesuré. |
| Livré (OFF) | Recherche texte et code-barres saisi, portions en g/ml. | Calcul serveur et instantané vérifiés ; scanner caméra non livré. |
| Prototype livré | Photo assistée. | Parcours et essais ponctuels vérifiés ; benchmark alimentaire à réaliser, précision non établie. |
| P1 | OCR d’étiquette local. | Valeurs et unités sourcées puis confirmées ; aucun ajout automatique. |
| P1 | Recherche web des valeurs énergétiques. | Page source, URL, date et base de portion vérifiées ; quotas et protections réseau testés. |
| P2 | Recettes pesées, favoris, duplication, macros/fibres/sel. | Calcul de rendement et couverture explicites ; pas de valeur manquante remplacée par zéro. |
| P2 | Bilan hebdomadaire et rappels facultatifs. | Journées complètes distinguées des absences ; aucune promesse médicale. |
| P2 | Fiches administrables des prochaines applications. | Ajout/modification privés, liens réels, navigation Android vérifiée. |

## Mise en service indépendante

Choisir une machine et dimensionner CPU/RAM/disque, prévoir sauvegarde et HTTPS,
configurer les secrets hors Git, puis soumettre version et cible exactes à
validation humaine avant production. Aucun hébergement permanent gratuit ou
service externe illimité n’est garanti. Voir [VALIDATION.md](VALIDATION.md).
