import { spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const name = 'alter-ego-small-model';
const image = 'ghcr.io/ggml-org/llama.cpp@sha256:41988e510b6fe0a0b5b9be00a9dbf91d9f0fa691da173d7b06d97d370329fe84';
const directory = fileURLToPath(new URL('../.models/', import.meta.url));
const run = args => spawnSync('docker', args, { encoding: 'utf8' });
if (!['start', 'stop'].includes(process.argv[2])) {
  console.error('Utiliser npm run model:start ou npm run model:stop.');
  process.exit(1);
}
if (run(['info', '--format', '{{.ServerVersion}}']).status !== 0) {
  console.error('Docker doit être installé et accessible pour exécuter le modèle.');
  process.exit(1);
}
const info = run(['inspect', '--format', '{{index .Config.Labels "org.alterego.model"}}', name]);
if (info.status === 0 && info.stdout.trim() !== 'smolvlm-256m') {
  console.error('Un autre conteneur utilise ce nom ; aucun changement effectué.');
  process.exit(1);
}
if (process.argv[2] === 'stop') {
  if (info.status !== 0) { console.log('Le modèle n’est pas démarré.'); process.exit(0); }
  const result = run(['stop', name]);
  console.log(result.status === 0 ? 'Modèle arrêté ; fichiers conservés.' : 'Impossible d’arrêter le moteur.');
  process.exit(result.status === 0 ? 0 : 1);
}
for (const file of ['SmolVLM-256M-Instruct-Q8_0.gguf', 'mmproj-SmolVLM-256M-Instruct-Q8_0.gguf']) {
  try { await access(new URL(`../.models/${file}`, import.meta.url)); }
  catch { console.error('Installer les poids avec npm run model:install avant de démarrer.'); process.exit(1); }
}
const args = info.status === 0 ? ['start', name] : [
  'run', '-d', '--name', name, '--label', 'org.alterego.model=smolvlm-256m',
  '--restart', 'unless-stopped', '-p', '127.0.0.1:8081:8080',
  '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
  '--memory', '2g', '--cpus', '2', '--mount', `type=bind,src=${directory},dst=/models,readonly`, image,
  '-m', '/models/SmolVLM-256M-Instruct-Q8_0.gguf', '--mmproj', '/models/mmproj-SmolVLM-256M-Instruct-Q8_0.gguf',
  '--alias', 'local', '--host', '0.0.0.0', '--port', '8080', '--ctx-size', '2048', '--parallel', '1',
  '--threads', '2', '--n-gpu-layers', '0', '--no-mmproj-offload', '--no-webui', '--no-slots', '--offline', '--log-verbosity', '1',
];
const result = run(args);
if (result.status !== 0) {
  console.error('Le moteur n’a pas démarré. Vérifier Docker, le port 8081 et les fichiers du modèle.');
  process.exit(1);
}
console.log('Moteur local démarré sur le port 8081. Le chargement initial peut prendre quelques secondes.');
