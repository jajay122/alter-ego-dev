import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, chmod, rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const revision = 'b9e4379657e1450d04d02eec8e345667265b0a00';
const files = [
  ['SmolVLM-256M-Instruct-Q8_0.gguf', '2a31195d3769c0b0fd0a4906201666108834848db768af11de1d2cef7cd35e65'],
  ['mmproj-SmolVLM-256M-Instruct-Q8_0.gguf', '7e943f7c53f0382a6fc41b6ee0c2def63ba4fded9ab8ed039cc9e2ab905e0edd'],
];
const directory = new URL('../.models/', import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o755 });
await chmod(directory, 0o755);
async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
for (const [name, expected] of files) {
  const target = new URL(name, directory);
  try {
    if ((await stat(target)).isFile() && await checksum(target) === expected) {
      await chmod(target, 0o644);
      console.log(`${name} : déjà installé et vérifié.`);
      continue;
    }
  } catch { /* Fichier absent ou incomplet : téléchargement vérifié. */ }
  const temporary = new URL(`${name}.part`, directory);
  console.log(`Téléchargement de ${name}…`);
  try {
    const response = await fetch(`https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF/resolve/${revision}/${name}`, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok || !response.body) throw new Error('Téléchargement indisponible.');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { mode: 0o644 }));
    if (await checksum(temporary) !== expected) throw new Error('Empreinte du fichier incorrecte.');
    await rename(temporary, target);
    console.log(`${name} : installé, SHA-256 vérifié.`);
  } catch (error) {
    await rm(temporary, { force: true });
    console.error(`Installation interrompue : ${error.message}`);
    process.exitCode = 1;
    break;
  }
}
