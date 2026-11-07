# Modèle local installé

## Choix

SmolVLM-256M-Instruct, famille HuggingFaceTB, licence Apache 2.0.
C’est un modèle préentraîné installé, pas un modèle entraîné dans ce dépôt.
Il prend en entrée du texte et une image et produit du texte. La carte du modèle
annonce surtout l’anglais ; son français et sa précision visuelle sont limités.

## Fichiers vérifiés

Révision : b9e4379657e1450d04d02eec8e345667265b0a00 du dépôt
[ggml-org/SmolVLM-256M-Instruct-GGUF](https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF).

| Fichier | SHA-256 |
| --- | --- |
| SmolVLM-256M-Instruct-Q8_0.gguf | 2a31195d3769c0b0fd0a4906201666108834848db768af11de1d2cef7cd35e65 |
| mmproj-SmolVLM-256M-Instruct-Q8_0.gguf | 7e943f7c53f0382a6fc41b6ee0c2def63ba4fded9ab8ed039cc9e2ab905e0edd |

Environ 266 Mio au total. Les fichiers sont placés dans .models, hors Git.
Le script d’installation vérifie les empreintes et n’a pas besoin d’une clé.

Moteur : llama.cpp, image Docker figée par digest dans compose.yaml et
scripts/model-service.mjs. L’exécution utilise les fichiers locaux, --offline,
un seul slot, 2 threads CPU et un contexte de 2 048 tokens. Aucun accès à une API
d’IA externe n’est implémenté. En Compose, le moteur n’a pas de réseau sortant.

## Tâches

Questions courtes et description d’éléments visibles dans une photo. Pour
Internet, l’application récupère trois résultats maximum dans Wikipédia et les
fournit comme contexte au modèle. Les sources sont jointes par le serveur,
jamais inventées par le modèle. Ce périmètre ne couvre pas tout le web.

Les réponses peuvent être fausses, répétitives, en anglais ou incomplètes.
Le modèle n’est ni un agent qui exécute des commandes, ni un OCR fiable,
ni un système de reconnaissance d’identité.

## Sources techniques

- [Carte du modèle et licence](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct)
- [Support multimodal llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md)
- [API de recherche MediaWiki](https://www.mediawiki.org/wiki/API:Search)
