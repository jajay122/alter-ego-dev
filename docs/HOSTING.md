# Hébergement — Démarrage gratuit

## Contrainte confirmée

Budget initial : **0 € d’hébergement**. Le propriétaire a confirmé « Gratuite ».
Ce choix ne garantit ni une disponibilité permanente ni le maintien des tarifs.
Il concerne le portail, pas l’hébergement de toutes les applications référencées.
L’abonnement ChatGPT existant est distinct de ce budget.

## Piste proposée, non provisionnée

| Élément | Proposition | Conditions |
| --- | --- | --- |
| Site web | Vercel Hobby | Gratuit ; usage personnel non commercial uniquement. |
| Connexion et données | Supabase Free : Auth et PostgreSQL | Gratuit dans les quotas ; projet susceptible d’être mis en pause après une semaine d’inactivité. |
| Adresse | Sous-domaine gratuit fourni par l’hébergeur | Aucun domaine personnalisé acheté. |
| Connexion du propriétaire | Étudier GitHub OAuth via Supabase Auth | Aucun SMS ni service d’envoi d’emails payant prévu ; droits limités au propriétaire à concevoir. |

Un portail utilisé seul peut quand même servir une activité commerciale.
L’éligibilité à Hobby doit donc être vérifiée avant de retenir cet hébergeur.
Si les applications ou le portail servent une entreprise, réexaminer une offre
gratuite autorisant cet usage, sans basculer vers un abonnement payant par défaut.

## Limites observées le 5 novembre 2026

- Vercel Hobby : 100 Go de Fast Data Transfer inclus ; des dépassements peuvent
  bloquer une fonctionnalité jusqu’à la remise à disposition du quota.
- Supabase Free : 500 Mo de base de données, 5 Go de trafic sortant,
  50 000 utilisateurs actifs mensuels inclus et deux projets actifs au maximum.
  Ces plafonds ne dispensent pas de surveiller l’usage.
- Supabase Free : pause après une semaine d’inactivité ; sauvegardes automatiques
  et restauration à un instant donné non incluses. Prévoir export et restauration.
- Ni la pause ni le dépassement ne doivent déclencher de passage payant automatique.
  Afficher une erreur honnête, puis restaurer le service selon les règles du fournisseur.
- Ne pas créer de trafic artificiel pour empêcher la mise en pause.

## Avant mise en service

Vérifier l’éligibilité, les quotas en vigueur et les comptes accessibles.
Configurer la connexion du seul propriétaire, les droits côté serveur et les
politiques d’accès aux données. Prévoir une procédure de sauvegarde récupérable,
garder les secrets hors Git et vérifier les parcours définis dans PRODUCT.md.

Le lien entre GitHub et l’hébergement devra préserver l’approbation humaine
explicite avant production. Le budget gratuit ne vaut pas autorisation de déployer.
Aucun service, option payante ou déploiement n’est créé par ce document.

## Sources officielles

- [Vercel Hobby : gratuité, limites et usage personnel](https://vercel.com/docs/plans/hobby)
- [Supabase : tarif et fonctionnalités Free](https://supabase.com/pricing)

## Références

- [Produit](PRODUCT.md)
- [Décisions](DECISIONS.md)
