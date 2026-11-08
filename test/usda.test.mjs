import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeUsda, csvRows, zipMember, parseUsdaArchive, installUsda } from '../lib/usda-import.mjs';
import { createUsdaCatalog } from '../lib/usda.mjs';
import { createCalorieStore } from '../lib/calories.mjs';
import { createApp } from '../server.mjs';

function zip(files) {
  let offset = 0; const local = [], central = [];
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content), filename = Buffer.from(name), compressed = deflateRawSync(data);
    const a = Buffer.alloc(30); a.writeUInt32LE(0x04034b50); a.writeUInt16LE(8, 8); a.writeUInt32LE(crc32(data), 14); a.writeUInt32LE(compressed.length, 18); a.writeUInt32LE(data.length, 22); a.writeUInt16LE(filename.length, 26);
    const b = Buffer.alloc(46); b.writeUInt32LE(0x02014b50); b.writeUInt16LE(8, 10); b.writeUInt32LE(crc32(data), 16); b.writeUInt32LE(compressed.length, 20); b.writeUInt32LE(data.length, 24); b.writeUInt16LE(filename.length, 28); b.writeUInt32LE(offset, 42);
    local.push(a, filename, compressed); central.push(b, filename); offset += a.length + filename.length + compressed.length;
  }
  const index = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
const nutrient = (id, amount, unitName = 'KCAL') => ({ nutrient: { id, unitName }, amount });
function fixtures(energy = 89) {
  const foundation = zip({ 'FoodData_Central_foundation_food_json_2026-10-29.json': JSON.stringify({ FoundationFoods: [
    { fdcId: 1234567, description: 'Synthetic foundation food', publicationDate: '2026-10-29', foodNutrients: [nutrient(2048, 100), nutrient(1003, 5, 'G')] },
    { fdcId: 1234568, description: 'Synthetic missing energy', foodNutrients: [] },
  ] }) });
  const legacy = zip({ 'food.csv': 'fdc_id,data_type,description,publication_date\n123456,sr_legacy_food,"Banana fixture, raw",2019-04-01\n',
    'nutrient.csv': 'id,unit_name\n1008,KCAL\n', 'food_nutrient.csv': `fdc_id,nutrient_id,amount\n123456,1008,${energy}\n` });
  return { archives: [foundation, legacy], releases: [
    { dataset: 'Foundation', release: '2026-10-29', minimum: 2, format: 'json' },
    { dataset: 'SR Legacy', release: '2018-04', minimum: 1, format: 'csv' },
  ].map((r, i) => ({ ...r, sha256: createHash('sha256').update([foundation, legacy][i]).digest('hex') })) };
}
async function directory(t) { const dir = await mkdtemp(join(tmpdir(), 'alter-ego-usda-test-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
async function installed(t) { const dir = await directory(t), f = fixtures(); await installUsda(dir, f.archives, f.releases); return dir; }
const selection = p => ({ provider: 'usda', code: p.code, retrievedAt: p.retrievedAt, revision: p.revision, quantity: 125, unit: 'g', basisConfirmed: true });
const entry = () => ({ operationId: randomUUID(), date: '2026-11-08', meal: 'breakfast', name: 'Repas', kcal: 50 });

test('CSV gère guillemets, virgules et retours à la ligne sans accepter un format cassé', () => {
  assert.deepEqual([...csvRows('\ufeffid,name\r\n1,"Rice, cooked"\r\n2,"A ""quoted""\nname"\n')], [['id','name'],['1','Rice, cooked'],['2','A "quoted"\nname']]);
  assert.throws(() => [...csvRows('a,"unterminated')]); assert.throws(() => [...csvRows('"a"x,b')]);
});

test('ZIP et empreinte sont vérifiés, sans extraction de chemins de fichiers', () => {
  const f = fixtures(); assert.ok(zipMember(f.archives[1], 'food.csv').includes('Banana fixture'));
  assert.throws(() => zipMember(Buffer.from('invalid'), 'food.csv'));
  assert.throws(() => zipMember(f.archives[0], 'food.csv'), /absent/);
  assert.throws(() => parseUsdaArchive(f.archives[0], { ...f.releases[0], sha256: '0'.repeat(64) }, new Date().toISOString()), /SHA-256/);
  const bad = Buffer.from(f.archives[1]); bad[50] ^= 1; assert.throws(() => zipMember(bad, 'food.csv'));
});

test('la normalisation choisit une énergie en kcal et conserve les absences et la base de 100 g', () => {
  const r = fixtures().releases[0]; const food = { fdcId: 1234, description: 'Synthetic food', foodNutrients: [nutrient(2048, 90), nutrient(2047, 95), nutrient(1008, 100)] };
  const p = normalizeUsda(food, r, new Date().toISOString()); assert.equal(p.kcalPer100, 90); assert.equal(p.energyNutrientId, 2048); assert.equal(p.basis, '100g'); assert.equal(p.nutrients.fiber, null);
  assert.equal(normalizeUsda({ ...food, foodNutrients: [] }, r, p.retrievedAt).kcalPer100, null);
  assert.equal(normalizeUsda({ ...food, foodNutrients: [nutrient(1008, 0)] }, r, p.retrievedAt).kcalPer100, 0);
  assert.equal(normalizeUsda({ ...food, foodNutrients: [nutrient(1008, 100, 'KJ')] }, r, p.retrievedAt).kcalPer100, null);
  assert.throws(() => normalizeUsda({ ...food, foodNutrients: [nutrient(1008, 1), nutrient(1008, 2)] }, r, p.retrievedAt), /dupliqu/);
});

test('import atomique, recherche locale, permissions et refus d’une archive incomplète', async t => {
  const dir = await installed(t), file = join(dir, 'usda.sqlite');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const catalog = createUsdaCatalog(dir); const result = catalog.search('banana'); assert.equal(result.catalog.count, 3); assert.equal(result.products[0].kcalPer100, 89);
  assert.equal(catalog.search('123456').products[0].name, 'Banana fixture, raw'); assert.equal(catalog.search('" OR *').products.length, 0);
  assert.equal(catalog.search('missing').products[0].kcalPer100, null);
  const before = await readFile(file); const f = fixtures();
  await assert.rejects(installUsda(dir, [Buffer.from('broken'), f.archives[1]], f.releases));
  assert.deepEqual(await readFile(file), before);
  assert.throws(() => parseUsdaArchive(f.archives[1], { ...f.releases[1], minimum: 50 }, new Date().toISOString()), /Nombre/);
});

test('portion uniquement en grammes, source figée et journal historique conservé après réimport', async t => {
  const dir = await installed(t), catalog = createUsdaCatalog(dir), store = createCalorieStore(dir);
  const p = catalog.search('banana').products[0], selected = selection(p), portion = catalog.portion(selected);
  assert.equal(portion.kcal, 111.3); assert.equal(portion.nutrition.license, 'CC0-1.0');
  assert.throws(() => catalog.portion({ ...selected, unit: 'ml' }), { code: 'INVALID_NUTRITION' });
  assert.throws(() => catalog.portion({ ...selected, revision: '0'.repeat(64) }), { code: 'PRODUCT_CHANGED' });
  const saved = await store.add({ ...entry(), ...portion });
  const f = fixtures(95); await installUsda(dir, f.archives, f.releases);
  assert.throws(() => catalog.portion(selected), { code: 'PRODUCT_CHANGED' });
  const stored = (await createCalorieStore(dir).snapshot()).entries[0]; assert.equal(stored.tenths, 1113); assert.equal(stored.nutrition.kcalPer100, 89);
  assert.equal((await store.update(saved.id, { ...entry(), name: stored.name, kcal: 111.3, version: 1, preserveNutrition: true })).nutrition.provider, 'usda');
});

test('catalogue absent ou corrompu : erreur explicite et journal indépendant', async t => {
  const dir = await directory(t), catalog = createUsdaCatalog(dir);
  assert.throws(() => catalog.search('banana'), { code: 'USDA_REQUIRED' });
  const store = createCalorieStore(dir); await store.add(entry()); const before = await readFile(join(dir, 'calories.json'));
  await writeFile(join(dir, 'usda.sqlite'), 'corrupted'); assert.throws(() => catalog.search('banana'), { code: 'USDA_STORAGE' });
  assert.deepEqual(await readFile(join(dir, 'calories.json')), before);
});

test('API USDA privée, sans appel externe, source validée et export de provenance', async t => {
  const dir = await installed(t); const password = 'usda-test-only-password'; let calls = 0;
  const server = createApp({ config: { dataDir: dir, password, origin: '' }, fetchImpl: async () => { calls++; throw new Error('Unexpected network'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`; let cookie;
  async function request(path, method = 'GET', body) { return fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: base, 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  assert.equal((await request('/api/nutrition/search?source=usda&q=banana')).status, 401);
  cookie = (await request('/api/login', 'POST', { password })).headers.get('set-cookie').split(';')[0];
  const p = (await (await request('/api/nutrition/search?source=usda&q=banana')).json()).products[0];
  const input = { ...entry(), catalogPortion: selection(p), kcal: 999 };
  const r = await request('/api/calories/entries', 'POST', input); assert.equal(r.status, 201); assert.equal((await r.json()).kcal, 111.3);
  const exported = await (await request('/api/calories/export')).json(); assert.equal(exported.entries[0].nutrition.dataset, 'SR Legacy');
  assert.equal((await request('/api/nutrition/search?source=unknown&q=banana')).status, 400);
  assert.equal((await request('/api/calories/entries', 'POST', { ...entry(), catalogPortion: { ...selection(p), provider: 'other' } })).status, 400);
  assert.equal(calls, 0);
});
