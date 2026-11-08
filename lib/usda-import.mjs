import { inflateRawSync, crc32 } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export const USDA_RELEASES = [
  { dataset: 'Foundation', release: '2026-10-29', format: 'json', minimum: 400,
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip',
    sha256: 'dd414cc9f1a132626bad354ef6655972c78b44aff14f16114dc899708663c579' },
  { dataset: 'SR Legacy', release: '2018-04', format: 'csv', minimum: 7000,
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    sha256: 'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0' },
];
export const USDA_SCHEMA = `CREATE TABLE foods(code TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE VIRTUAL TABLE foods_fts USING fts5(code UNINDEXED, terms, tokenize='unicode61 remove_diacritics 2');
 CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);`;

// Read only a requested member into memory; never extract archive paths to disk.
export function zipMember(zip, basename) {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  if (end < 0 || zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6)) throw new Error('Archive ZIP invalide.');
  let offset = zip.readUInt32LE(end + 16); const count = zip.readUInt16LE(end + 10);
  let found;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Index ZIP invalide.');
    const flags = zip.readUInt16LE(offset + 8), method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20), outputSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28), extraLength = zip.readUInt16LE(offset + 30), commentLength = zip.readUInt16LE(offset + 32);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name.split('/').at(-1) === basename) {
      if (found || flags & 1 || ![0, 8].includes(method) || outputSize > 64 * 1024 * 1024) throw new Error('Membre ZIP interdit ou trop volumineux.');
      const local = zip.readUInt32LE(offset + 42);
      if (local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw new Error('En-tête ZIP invalide.');
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      if (start + size > offset) throw new Error('Données ZIP invalides.');
      const bytes = zip.subarray(start, start + size);
      found = method === 8 ? inflateRawSync(bytes, { maxOutputLength: 64 * 1024 * 1024 }) : Buffer.from(bytes);
      if (found.length !== outputSize || crc32(found) !== zip.readUInt32LE(offset + 16)) throw new Error('Intégrité ZIP incorrecte.');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!found) throw new Error(`Fichier ${basename} absent de l’archive officielle.`);
  return found.toString('utf8');
}

export function* csvRows(content) {
  let field = '', row = [], quoted = false, afterQuote = false;
  for (let i = content.charCodeAt(0) === 0xfeff ? 1 : 0; i <= content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (ch === undefined) throw new Error('Champ CSV non terminé.');
      if (ch === '"') { if (content[i + 1] === '"') { field += '"'; i++; } else { quoted = false; afterQuote = true; } }
      else field += ch;
    } else if (ch === '"' && !field && !afterQuote) quoted = true;
    else if (ch === ',' || ch === '\n' || ch === '\r' || ch === undefined) {
      row.push(field); field = ''; afterQuote = false;
      if (ch !== ',') {
        if (row.length > 1 || row[0]) yield row;
        row = [];
        if (ch === '\r' && content[i + 1] === '\n') i++;
      }
    } else {
      if (afterQuote || ch === '"') throw new Error('Format CSV invalide.');
      field += ch;
    }
    if (field.length > 65536 || row.length > 100) throw new Error('Champ CSV trop volumineux.');
  }
}
function* records(content, required) {
  const rows = csvRows(content); const header = rows.next().value;
  if (!header || new Set(header).size !== header.length || required.some(key => !header.includes(key))) throw new Error('Colonnes USDA manquantes.');
  for (const row of rows) {
    if (row.length !== header.length) throw new Error('Ligne USDA invalide.');
    yield Object.fromEntries(header.map((key, i) => [key, row[i]]));
  }
}
const number = v => typeof v === 'number' && Number.isFinite(v) ? v
  : typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v) ? Number(v) : null;
export function normalizeUsda(food, release, retrievedAt) {
  const code = String(food.fdcId);
  if (!/^[1-9]\d{0,9}$/.test(code) || typeof food.description !== 'string' || !food.description.trim() || food.description.length > 500) throw new Error('Identité USDA invalide.');
  const nutrients = new Map();
  for (const n of food.foodNutrients || []) {
    const id = Number(n.nutrient.id), value = number(n.amount);
    if (nutrients.has(id)) throw new Error('Nutriment USDA dupliqué.');
    nutrients.set(id, { value, unit: String(n.nutrient.unitName).toUpperCase() });
  }
  let energyNutrientId = null; let kcalPer100 = null;
  for (const id of [2048, 2047, 1008]) {
    const n = nutrients.get(id);
    if (n?.unit === 'KCAL' && n.value !== null && n.value >= 0 && n.value <= 1000) { kcalPer100 = n.value; energyNutrientId = id; break; }
  }
  const date = typeof food.publicationDate === 'string' ? Date.parse(food.publicationDate) : NaN;
  const macro = id => { const n = nutrients.get(id); return n?.unit === 'G' && n.value !== null && n.value >= 0 && n.value <= 100 ? n.value : null; };
  return { provider: 'usda', code, name: food.description.trim(), brand: '', language: 'en', dataset: release.dataset, release: release.release,
    revision: release.sha256, basis: '100g', kcalPer100, energyNutrientId, energyMethod: energyNutrientId === null ? 'missing' : `usda-${energyNutrientId}`,
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${code}/nutrients`, sourceUpdatedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
    retrievedAt, license: 'CC0-1.0', nutrients: { proteins: macro(1003), carbohydrates: macro(1005), fat: macro(1004), fiber: macro(1079), salt: null } };
}
export function parseUsdaArchive(zip, release, retrievedAt) {
  if (createHash('sha256').update(zip).digest('hex') !== release.sha256) throw new Error('Empreinte SHA-256 USDA incorrecte. Import annulé.');
  let foods;
  if (release.format === 'json') {
    const json = JSON.parse(zipMember(zip, `FoodData_Central_foundation_food_json_${release.release}.json`));
    if (!Array.isArray(json.FoundationFoods)) throw new Error('Catalogue Foundation absent.');
    foods = json.FoundationFoods;
  } else {
    foods = [...records(zipMember(zip, 'food.csv'), ['fdc_id', 'data_type', 'description', 'publication_date'])].map(row => {
      if (row.data_type !== 'sr_legacy_food') throw new Error('Type de catalogue USDA inattendu.');
      return { fdcId: row.fdc_id, description: row.description, publicationDate: row.publication_date, foodNutrients: [] };
    });
    const byId = new Map(foods.map(f => [f.fdcId, f]));
    if (byId.size !== foods.length) throw new Error('Identifiant USDA dupliqué.');
    const units = new Map([...records(zipMember(zip, 'nutrient.csv'), ['id', 'unit_name'])].map(n => [n.id, n.unit_name]));
    for (const n of records(zipMember(zip, 'food_nutrient.csv'), ['fdc_id', 'nutrient_id', 'amount'])) {
      if (![1008, 2047, 2048, 1003, 1004, 1005, 1079].includes(Number(n.nutrient_id))) continue;
      const food = byId.get(n.fdc_id);
      if (!food || !units.has(n.nutrient_id)) throw new Error('Référence USDA inconnue.');
      food.foodNutrients.push({ nutrient: { id: Number(n.nutrient_id), unitName: units.get(n.nutrient_id) }, amount: n.amount });
    }
  }
  if (foods.length < release.minimum || foods.length > 20000) throw new Error('Nombre de fiches USDA inattendu.');
  return foods.map(f => normalizeUsda(f, release, retrievedAt));
}

export async function installUsda(directory, archives, releases = USDA_RELEASES) {
  if (releases.length !== 2 || archives.length !== releases.length) throw new Error('Les deux catalogues USDA sont requis.');
  const retrievedAt = new Date().toISOString();
  const foods = archives.flatMap((zip, i) => parseUsdaArchive(zip, releases[i], retrievedAt));
  if (new Set(foods.map(f => f.code)).size !== foods.length) throw new Error('Identifiants USDA en conflit.');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.usda-${randomUUID()}.sqlite`);
  const handle = await open(temporary, 'wx', 0o600); await handle.close();
  let db;
  try {
    db = new DatabaseSync(temporary);
    db.exec(USDA_SCHEMA); db.exec('BEGIN');
    const insert = db.prepare('INSERT INTO foods(code,data) VALUES(?,?)');
    const index = db.prepare('INSERT INTO foods_fts(code,terms) VALUES(?,?)');
    for (const food of foods) { insert.run(food.code, JSON.stringify(food)); index.run(food.code, food.name); }
    const metadata = { schema: 1, importedAt: retrievedAt, count: foods.length, withEnergy: foods.filter(f => f.kcalPer100 !== null).length,
      releases: releases.map(r => ({ ...r, count: foods.filter(f => f.dataset === r.dataset).length })) };
    db.prepare('INSERT INTO metadata(id,data) VALUES(1,?)').run(JSON.stringify(metadata));
    db.exec('COMMIT'); db.close(); db = null;
    const file = await open(temporary, 'r'); try { await file.sync(); } finally { await file.close(); }
    await rename(temporary, join(directory, 'usda.sqlite'));
    return metadata;
  } finally { db?.close(); await unlink(temporary).catch(() => {}); }
}
