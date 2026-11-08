# Recherche assistée par photo

Statut : implémentée dans le module calories, sans déploiement en production.
Le modèle local propose des termes de recherche ; les calories proviennent de la
fiche nutritionnelle choisie et de la portion confirmée, jamais de la photo seule.

## Utilisation sur téléphone

1. Ouvrir le journal, se connecter, puis « Ajouter un aliment ».
2. Déplier « Partir d’une photo » et choisir une image JPEG, PNG ou WebP.
3. Examiner l’aperçu, puis appuyer sur « Proposer un aliment ». L’image n’est pas
   envoyée au serveur avant ce clic. Retrait et annulation sont disponibles.
4. Choisir une proposition, éventuellement en anglais, puis corriger son nom
   dans le champ de recherche. Appuyer explicitement sur « Rechercher ».
5. Choisir une fiche correspondant réellement au plat ou à l’ingrédient,
   vérifier sa source et confirmer quantité et unité g/ml avant enregistrement.
   Un plat composé peut nécessiter plusieurs entrées saisies séparément.

La section photo est repliée par défaut pour garder la saisie manuelle rapide.
Le sélecteur de fichier peut dépendre du navigateur Android ; pas de caméra en
continu, de lecture de code-barres par caméra ou de permission getUserMedia.

Si rien n’est proposé, si le moteur est arrêté ou si le résultat est faux,
utiliser directement la recherche texte, le cache ou la saisie manuelle.
Open Food Facts couvre surtout des produits emballés : une reconnaissance de
« banana » ne garantit pas de retrouver immédiatement une fiche générique adaptée.
Le choix [USDA local](USDA.md), après import, permet de retrouver des aliments
courants avec leur nom anglais. Ciqual reste une prochaine intégration.

## Traitement et confidentialité

- Le navigateur accepte au maximum 12 Mo et 24 mégapixels. Il décode l’image,
  applique son orientation, la dessine sur un fond blanc puis réencode un JPEG
  de 512 pixels maximum sur le grand côté. La requête finale reste limitée à 3 Mo.
  Le réencodage ne recopie ni le nom de fichier ni les métadonnées d’origine.
- Le format 512 pixels limite mémoire, transfert et nombre de tokens visuels
  dans le contexte de 2 048 tokens du petit modèle. Un essai original à haute
  résolution dépassait ce contexte. Ce choix ne garantit pas la lecture des
  petites étiquettes ; cette fonction n’est pas un OCR nutritionnel.
- La photo quitte le téléphone uniquement pour le serveur personnel et son
  moteur local. Le serveur n’écrit pas d’image dans le journal, le cache SQLite,
  les fichiers de l’application ou les exports ; aucun upload vers OFF.
- La préparation reste en mémoire navigateur. Retirer la photo, fermer le
  formulaire ou verrouiller le journal retire aperçu et propositions, révoque
  l’URL temporaire et annule la requête côté navigateur.
- L’annulation est transmise au moteur via AbortSignal ; celui-ci peut terminer
  un calcul commencé. Le moteur et ses caches internes ne sont pas un mécanisme
  d’effacement sécurisé de mémoire. Les images ne sont pas volontairement
  archivées par notre code ; pas de promesse d’effacement physique instantané.
- Seul un clic ultérieur sur « Rechercher » peut envoyer le nom corrigé à OFF,
  sauf en mode local. Aucun envoi automatique du résultat de vision vers Internet.

## API et protections

`POST /api/nutrition/photo`, JSON `{ image: { mimeType, data } }`, sous session et
contrôle d’origine. Le serveur impose la consigne de reconnaissance ; une consigne
fournie par le client n’est pas utilisée. Signature, base64 canonique et taille
sont vérifiés avant l’inférence. URL du modèle limitée à la boucle locale ou au
service Docker `model`, sans API d’IA externe.

La photo partage avec l’assistant un verrou d’inférence et une limite de
20 demandes par heure pour l’instance (non persistante, comme auparavant).
La sortie contient seulement `{ candidates, truncated }`. Trois noms maximum,
60 caractères et six mots par nom ; textes libres, chiffres, liens, réponses
incertaines ou tronquées sont écartés selon un filtre conservateur. Ce filtre
ne démontre pas qu’un nom proposé est vraiment présent dans l’image.

Une réponse inutilisable produit une liste vide, sans aliment de remplacement
inventé. Les résultats sont affichés par textContent ; ils ne sont jamais des
instructions d’outil. L’endpoint ne recherche aucune fiche, ne calcule aucune
portion et ne modifie pas le journal. L’ajout suit le parcours privé existant.

## Modèle et validation

SmolVLM-256M et son projecteur déjà installés sont réutilisés, avec llama.cpp.
L’anglais est privilégié dans la consigne car ce petit modèle maîtrise mal le
français. Aucun nouveau poids ni abonnement d’IA ajouté. Le moteur doit être
lancé pour l’analyse : voir [LOCAL_MODEL.md](LOCAL_MODEL.md).

Les tests unitaires/HTTP et navigateur utilisent un fournisseur simulé, clairement
séparé des essais réels. Sur une photo publique de banane réduite par le navigateur,
le vrai modèle a répondu « Banana. ». Sur un carré rouge, il a donné une phrase
non exploitable, rejetée après correction du filtre. Deux images ne sont pas un
benchmark de reconnaissance ni une validation clinique. Pas de taux de précision
annoncé. Voir [VALIDATION.md](VALIDATION.md).

À poursuivre : protocole de benchmark sur plats variés, Ciqual pour compléter
USDA, OCR d’étiquette et recherche web de valeurs sourcées.
