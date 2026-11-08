import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { USDA_RELEASES, installUsda } from '../lib/usda-import.mjs';

// Downloads are explicit, public and limited to these two versioned USDA URLs.
async function download(release) {
  const response = await fetch(release.url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Téléchargement USDA refusé (${response.status}).`);
  let size = 0; const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw new Error('Archive USDA trop volumineuse.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
try {
  const args = process.argv.slice(2);
  if (args.length && args.length !== 2) throw new Error('Indiquer deux ZIP locaux (Foundation JSON, SR Legacy CSV), ou aucun pour télécharger les versions figées.');
  const archives = [];
  for (let i = 0; i < 2; i++) {
    if (args.length && (await stat(args[i])).size > 16 * 1024 * 1024) throw new Error('Archive USDA locale trop volumineuse.');
    archives.push(args.length ? await readFile(args[i]) : await download(USDA_RELEASES[i]));
  }
  const directory = process.env.CALORIES_DATA_DIR || fileURLToPath(new URL('../.data/', import.meta.url));
  const result = await installUsda(directory, archives);
  console.log(JSON.stringify({ imported: result.count, withEnergy: result.withEnergy, releases: result.releases.map(r => ({ dataset: r.dataset, release: r.release, count: r.count })) }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
