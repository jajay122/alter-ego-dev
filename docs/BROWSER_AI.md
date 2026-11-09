# IA dans le navigateur — version 2

Le lien public ouvre le même assistant sur Android et ordinateur. Le serveur
Cloudflare sert les fichiers et les recherches ; il ne lance pas llama.cpp.
Aucun abonnement, clé ou appel à une API d’inférence n’est utilisé. La connexion
et le stockage du téléphone restent nécessaires au premier téléchargement.

## Trois profils, activation explicite

| Profil | Modèle et révision figée | Artefact ONNX et taille observée |
| --- | --- | --- |
| Léger, par défaut | `onnx-community/SmolLM2-135M-Instruct-ONNX`, `b8a5c0f183b78c55955a5364f610c36668b5e681` | `onnx/model_quantized.onnx`, 135 658 354 octets, soit 129,37 Mio |
| Photo assistée, facultatif | `HuggingFaceTB/SmolVLM-256M-Instruct`, `7e3e67edbbed1bf9888184d9df282b700a323964` | `embed_tokens_quantized.onnx` : 28 385 824 ; `vision_encoder_q4.onnx` : 63 784 987 ; `decoder_model_merged_q4.onnx` : 86 562 901 octets ; total 178 733 712 octets, soit 170,45 Mio |
| Français renforcé, facultatif | `onnx-community/Qwen2.5-0.5B-Instruct`, `22942cb7d7ba4cc81bb4673549ca4d4614469b5e` | `onnx/model_q4f16.onnx`, 483 003 582 octets, soit 460,63 Mio |

Tailles lues dans les API publiques Hugging Face le 9 novembre 2026 avec
`?blobs=true`, sans télécharger les poids dans Git. Tokenizer observé :
3 522 656 octets pour SmolLM2 ; 7 031 673 pour Qwen ; 3 548 256 pour SmolVLM. Le total indiqué dans
l’interface (environ 133 / 468 / 174 Mio) comprend poids et tokenizer arrondis.
Ajouter environ 21 Mio pour le runtime WASM (21 596 019 octets observés dans
le manifeste CDN), le JavaScript (~0,85 Mio), configurations et métadonnées.
La mémoire d’exécution requise n’a pas été mesurée et dépasse ces tailles.

Le profil léger est surtout entraîné en anglais : son français peut être
faible, malgré la consigne française. Qwen est multilingue et mieux adapté
au français ; aucune amélioration chiffrée n’est revendiquée sans benchmark.
Le léger tente WebGPU puis WASM en cas d’échec avec **le même artefact q8**.
SmolVLM suit la même règle avec les trois mêmes fichiers q8/q4/q4, sans
float16 obligatoire ni téléchargement automatique d’une autre quantification.
Qwen exige un adaptateur WebGPU offrant `shader-f16`, contrôlé avant tout
chargement du modèle. En cas d’échec Qwen, aucun autre poids n’est téléchargé
automatiquement : choisir et activer le léger reste une action explicite.

Les poids et le runtime sont obtenus auprès de Hugging Face / jsDelivr au
clic « Activer / télécharger », ou « Analyser la photo » dans Calories avec
son avertissement de taille distinct. L’import du client seul ne lance aucun Worker
et ne télécharge rien. Transformers.js utilise le Cache API du navigateur
quand disponible. Le système ou le navigateur peut évincer ce cache ; le mode
hors ligne complet et la persistance du cache ne sont pas garantis. Effacer
les données du site dans les paramètres du navigateur supprime ce stockage.

## Moteur et contrats

Transformers.js **3.8.1**, bundle navigateur complet :
`https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js`.
Le fichier `transformers.web.js` contient des imports de paquets nus et n’est
pas utilisable directement dans un Worker sans bundler/import map ; il n’est
pas utilisé. API vérifiée dans la documentation 3.8.1 et les sources du tag :
`pipeline('text-generation', model, { revision, device, dtype })`, entrée chat,
`TextStreamer(tokenizer, { skip_prompt, callback_function })`.
La version **publiée 3.8.1** contient le mapping `idefics3` vers
`AutoModelForVision2Seq` et son `Idefics3Processor` : support confirmé par
lecture des sources de ce tag, au-delà de la PR initiale. SmolVLM utilise
`AutoProcessor.from_pretrained` et
`AutoModelForVision2Seq.from_pretrained(...,{dtype:{embed_tokens:"q8",
vision_encoder:"q4",decoder_model_merged:"q4"}})`.

`model-client.js` exporte :

- `initModel(progressCallback?, {profile: 'light'|'french'|'vision'}?)` : Promise d’état ;
  appeler après consentement explicite au téléchargement. Les chargements
  concurrents sont mutualisés. Changer de profil pendant une tâche est refusé.
  Sans profil explicite, le profil texte actif est conservé, ou `light` est
  choisi si `vision` était actif. Cela permet de réactiver le texte après une photo.
- `generateText(prompt, {onToken, maxNewTokens, systemPrompt, signal}?)` :
  Promise de chaîne, fragments texte via `onToken(chunk)`. Nécessite l’état
  `ready` avec profil texte, refuse une tâche concurrente ou le profil vision. Prompt jusqu’à 6 000 caractères,
  sortie de 16 à 512 tokens (192 par défaut).
- `getModelState()` : copie synchrone avec `status` (`idle`, `loading`,
  `ready`, `generating`, `error`), `model`, `profile`, `device` (null,
  `webgpu`, `wasm`), `error`, `bytes` (ONNX seulement), `sizeKnown: true`,
  `supportsVision` (vrai uniquement si le profil vision est chargé et
  prêt ou en cours de génération ; ne garantit pas la compatibilité d’un appareil).
- `cancelGeneration()` : termine réellement le Worker, y compris pendant le
  téléchargement. Toutes les tâches sont rejetées avec `AbortError`, l’état
  retourne à `idle`. Les réponses tardives sont ignorées. Réactivation requise,
  les fichiers entièrement reçus en cache peuvent être réutilisés.
- `describePhoto(imageDataURL|Blob, {onProgress, signal, onToken}?)` : action
  explicite qui active le profil vision séparé puis analyse localement une photo
  JPEG/PNG/WebP de 10 Mo maximum. Une URL distante est refusée. Toute tâche
  déjà en cours est refusée ; l’ancien Worker texte au repos est terminé avant
  le chargement vision, pour éviter de conserver deux modèles en mémoire.
  Retourne `{description, candidates: string[], requiresConfirmation: true,
  model: 'HuggingFaceTB/SmolVLM-256M-Instruct'}`. Les 0 à 3 noms proposés
  peuvent être anglais, faux ou absents : affichage modifiable et validation
  humaine avant recherche nutritionnelle, jamais ajout automatique au journal.
  `onProgress` reçoit les événements HF (`status`, `file`, `progress` 0–100,
  `loaded`, `total`) et un éventuel événement `{status:'fallback',message}`.
  `signal` annule chargement ou génération en terminant le Worker. Aucun
  contenu photo n’est envoyé au serveur ni enregistré par ce module.

`ai.js` exporte `mountAssistant({root, api, toast}) -> dispose`. `api` est
le helper du shell (`api(path, options)` ; GET par défaut). Le démontage annule
la demande en cours ; un téléchargement déjà lancé peut continuer pour les
autres modules, notamment Atelier. Quitter ou fermer la page ne laisse aucun
agent autonome tourner. Android peut suspendre un onglet en arrière-plan.
Aucun Worker navigateur ne remplace un service permanent ou un planificateur.

## Outils sans modèle

Le calcul arithmétique utilise un analyseur déterministe (+, -, *, /,
parenthèses, virgule décimale), sans `eval`. Les flottants sont ceux de
JavaScript, affichés à 12 chiffres significatifs ; ce n’est pas un moteur
symbolique ni un calculateur financier.

La recherche utilise `GET /api/assistant/search?q=...` et attend
`{sources:[{title, excerpt, url}]}`. Les extraits et liens sont affichés
directement sans IA ; le bouton de synthèse demande explicitement le modèle
activé. Seuls les liens HTTPS vers Wikipédia sont affichés. Aucune recherche
web générale ou source inventée par l’IA n’est présentée comme vérifiée.

Pour la nutrition, les chiffres doivent venir du catalogue et des portions
sourcées du journal. SmolVLM propose seulement des noms d’aliments candidats ;
aucun calcul nutritionnel ne lui est demandé. La description brute reste un
texte non fiable. Le filtre des noms élimine les nombres et mentions de
calories mais ne garantit pas qu’un aliment est réellement présent.
La saisie de nom et le code-barres restent disponibles sans modèle photo.

SmolVLM redimensionne la photo dans le Worker (512 pixels maximum), désactive
le découpage en patches et réduit le prétraitement à 512 pixels. Le navigateur
doit offrir `createImageBitmap` et `OffscreenCanvas` dans le Worker ; cette
condition est contrôlée avant de télécharger la vision. La configuration
publique du modèle annonce surtout l’anglais. La taille des poids et leur
support logiciel ne prouvent pas une exécution fiable sur Android : vitesse,
mémoire, qualité et compatibilité matérielle restent à mesurer sur le téléphone.

## CSP et validation

Origines utilisées :

```
script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
worker-src 'self' blob:;
connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co;
```

Ces directives sont à fusionner avec la CSP du site. Aucun `unsafe-eval`
JavaScript n’est nécessaire. Un seul thread WASM évite d’exiger les en-têtes
COOP/COEP pour SharedArrayBuffer. Les téléchargements peuvent être redirigés
vers les domaines CDN Hugging Face listés. Un proxy, manque de mémoire,
quota de cache, version du navigateur ou CSP peut encore bloquer le moteur.

Validation réalisée : `node --check` des trois modules et
`node --test test/browser-model.test.mjs` : calcul, absence de téléchargement
implicite, progression, streaming, concurrence, annulation, réponse tardive,
réactivation immédiate, profil explicite, activation photo séparée, entrée
photo valide/abandon avant téléchargement et déchargement du modèle texte.
Dix tests réussissent, dont le code Worker exécuté en VM avec bibliothèque
de modèle remplacée, et le refus des API image absentes avant tout chargement. Les Workers de ces tests sont
des doublures : cela ne prouve pas l’inférence, WebGPU, le rendu mobile,
le cache hors ligne ou la CSP sur un vrai téléphone. Les URL de modèles,
configurations et bundle CDN ont été consultées avec succès ; aucune
inférence réelle navigateur ni validation Android n’a été exécutée ici.
Ces validations restent nécessaires sur le lien public avant une déclaration
de compatibilité Android.

Sources officielles :

- [Transformers.js 3.8.1](https://huggingface.co/docs/transformers.js/v3.8.1/en/index)
- [TextStreamer, tag 3.8.1](https://github.com/huggingface/transformers.js/blob/3.8.1/src/generation/streamers.js)
- [Pipeline texte, tag 3.8.1](https://github.com/huggingface/transformers.js/blob/3.8.1/src/pipelines.js)
- [Artefacts SmolLM2 figés](https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX/tree/b8a5c0f183b78c55955a5364f610c36668b5e681)
- [Carte SmolLM2 d’origine](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct)
- [Artefacts Qwen figés](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/tree/22942cb7d7ba4cc81bb4673549ca4d4614469b5e)
- [Carte Qwen d’origine](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)

- [Artefacts SmolVLM figés](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct/tree/7e3e67edbbed1bf9888184d9df282b700a323964)
- [Mapping Vision2Seq publié, tag 3.8.1](https://github.com/huggingface/transformers.js/blob/3.8.1/src/models.js)
- [Processor Idefics3 publié, tag 3.8.1](https://github.com/huggingface/transformers.js/blob/3.8.1/src/models/idefics3/processing_idefics3.js)

## Preuve d’inférence réelle sur Node CPU — 9 novembre 2026

Un essai supplémentaire a exécuté **réellement** SmolLM2 q8 sur le processeur
Linux, avec Node `v24.22.1`, Transformers.js `3.8.1` et son ONNX Runtime natif.
Ce résultat est distinct des dix tests de contrat utilisant des doublures.
Il ne valide pas ONNX Runtime WASM, WebGPU, la vision ou Android.

L’espace libre initial était de 874 Mio. Les dépendances officielles ont été
installées dans un répertoire temporaire sous `/tmp`, sans changement du dépôt :

```
npm install --ignore-scripts --no-audit --no-fund --cache ./npm-cache @huggingface/transformers@3.8.1
node --use-env-proxy proof.mjs
```

Les variables de proxy et la confiance CA héritées ont été conservées.
Les scripts npm ont été désactivés pour éviter l’installation CUDA facultative,
inutile pour cet essai CPU. Le pipeline testé était :

```js
const engine = await pipeline('text-generation',
  'onnx-community/SmolLM2-135M-Instruct-ONNX', {
    revision: 'b8a5c0f183b78c55955a5364f610c36668b5e681',
    dtype: 'q8', device: 'cpu',
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  });
const output = await engine([
  { role: 'system', content: 'Tu es un assistant francophone. Réponds brièvement en français.' },
  { role: 'user', content: 'À quoi sert un calendrier ? Réponds en une phrase en français.' },
], { max_new_tokens: 32, do_sample: false, repetition_penalty: 1.15 });
```

Le fichier reçu faisait exactement **135 658 354 octets** ; SHA-256 calculé :
`0fab87142e3eb1fcacb881f8282e7473e62ad66920c347b81f088da6fda2da37`.
Le processus s’est terminé avec le code 0 après génération. Mesures de cet
unique essai : chargement avec téléchargement **14,95 s** ; génération
**1,41 s** ; mémoire RSS au moment du résultat **623 181 824 octets**
(environ 594 Mio, mesure ponctuelle et non un pic mémoire).

Réponse exacte, coupée par la limite de 32 tokens :

> C'est une phrase qui a été reçus par les débutants de l'université de Paris et est très important pour la

Le moteur et l’artefact fonctionnent donc sur Node CPU ; **la réponse française
est incorrecte et hors sujet**. Cet essai confirme la limite annoncée du petit
modèle et ne justifie aucune promesse de qualité comparable aux grands
assistants. Les outils calcul et données sourcées restent les chemins fiables.
Les dépendances et poids temporaires ont été supprimés après ce contrôle pour
libérer l’espace de travail. Aucun Qwen ni modèle photo n’a été téléchargé
pour cet essai.
