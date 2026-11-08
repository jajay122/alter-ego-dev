import { DatabaseSync } from 'node:sqlite';
import { mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from './assistant.mjs';

const PROVIDER = 'openfoodfacts';
const BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'AlterEgoDev/0.3 (https://github.com/jajay122/alter-ego-dev)';
const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,last_modified_t';
const WEEK = 7 * 24 * 3600_000;
const LIMIT = 1000;
const fail = (status, code, message) => new AppError(status, code, message);
const text = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const normalized = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const numeric = (v, max) => (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)))
  && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max ? Number(v) : null;
export const validCode = code => typeof code === 'string' && /^(?:\d{8}|\d{12,14})$/.test(code);

export function normalizeProduct(raw, retrievedAt = new Date().toISOString()) {
  if (!raw || !validCode(raw.code)) return null;
  const name = text(raw.product_name_fr) || text(raw.product_name);
  if (!name) return null;
  const n = raw.nutriments || {};
  const direct = numeric(n['energy-kcal_100g'], 1000);
  const kj = numeric(n['energy-kj_100g'], 4184) ?? (n.energy_unit === 'kJ' ? numeric(n.energy_100g, 4184) : null);
  const kcalPer100 = direct ?? (kj === null ? null : Math.round(kj / 4.184 * 1000) / 1000);
  const sourceUpdatedAt = Number.isSafeInteger(raw.last_modified_t) && raw.last_modified_t > 0 && raw.last_modified_t < 253402300799
    ? new Date(raw.last_modified_t * 1000).toISOString() : null;
  return { provider: PROVIDER, code: raw.code, name, brand: text(raw.brands), kcalPer100,
    energyMethod: direct !== null ? 'source-kcal' : kj !== null ? 'converted-kj' : 'missing',
    basis: '100g-or-100ml', sourceUrl: `${BASE}/product/${raw.code}`, sourceUpdatedAt, retrievedAt,
    license: 'ODbL-1.0', nutrients: Object.fromEntries(['proteins', 'carbohydrates', 'fat', 'fiber', 'salt'].map(key => [key, numeric(n[`${key}_100g`], 100)])) };
}

export function validateNutritionSnapshot(value, kcal) {
  if (value === undefined || value === null) return null;
  const usda = value?.provider === 'usda';
  const identity = usda
    ? typeof value.code === 'string' && /^[1-9]\d{0,9}$/.test(value.code) && value.license === 'CC0-1.0'
      && value.sourceUrl === `https://fdc.nal.usda.gov/food-details/${value.code}/nutrients`
      && ['Foundation', 'SR Legacy'].includes(value.dataset) && typeof value.release === 'string'
      && /^(?:\d{4}-\d{2}|\d{4}-\d{2}-\d{2})$/.test(value.release)
      && /^[a-f0-9]{64}$/.test(value.revision) && [1008, 2047, 2048].includes(value.energyNutrientId) && value.unit === 'g'
    : value?.provider === PROVIDER && validCode(value.code) && value.license === 'ODbL-1.0' && value.sourceUrl === `${BASE}/product/${value.code}`;
  if (!identity || !['g', 'ml'].includes(value.unit)
    || value.basisConfirmed !== true || !Number.isFinite(value.kcalPer100)
    || value.kcalPer100 < 0 || value.kcalPer100 > 1000 || !Number.isFinite(value.quantity)
    || value.quantity <= 0 || value.quantity > 10000 || Math.abs(value.quantity * 10 - Math.round(value.quantity * 10)) > 1e-7
    || typeof value.retrievedAt !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt))
    || !(value.sourceUpdatedAt === null || (typeof value.sourceUpdatedAt === 'string' && Number.isFinite(Date.parse(value.sourceUpdatedAt))))
    || Math.round(value.kcalPer100 * value.quantity / 100 * 10) !== Math.round(kcal * 10)) {
    throw fail(400, 'INVALID_NUTRITION', 'La source ou le calcul de portion est invalide. Rechoisis le produit ou utilise la saisie manuelle.');
  }
  return { provider: value.provider, code: value.code, sourceUrl: value.sourceUrl, license: value.license,
    ...(usda ? { dataset: value.dataset, release: value.release, revision: value.revision, energyNutrientId: value.energyNutrientId } : {}),
    sourceUpdatedAt: value.sourceUpdatedAt, retrievedAt: value.retrievedAt, kcalPer100: value.kcalPer100,
    quantity: value.quantity, unit: value.unit, basisConfirmed: true };
}

export function createNutritionCatalog(directory, { fetchImpl = fetch, now = Date.now } = {}) {
  const file = join(directory, 'nutrition.sqlite');
  let init;
  let pending = null;
  async function database() {
    init ??= mkdir(directory, { recursive: true, mode: 0o700 }).catch(error => { init = null; throw error; });
    try {
      await init;
      const db = new DatabaseSync(file, { timeout: 1000 });
      try {
        db.exec(`CREATE TABLE IF NOT EXISTS products (code TEXT PRIMARY KEY, data TEXT NOT NULL, fetched INTEGER NOT NULL);
          CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(code UNINDEXED, terms, tokenize='unicode61 remove_diacritics 2');
          CREATE TABLE IF NOT EXISTS queries (query TEXT PRIMARY KEY, codes TEXT NOT NULL, fetched INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS requests (kind TEXT NOT NULL, at INTEGER NOT NULL);`);
        await chmod(file, 0o600);
        return db;
      } catch (error) { db.close(); throw error; }
    } catch { throw fail(503, 'CATALOG_STORAGE', 'Le cache alimentaire est inaccessible. La saisie manuelle reste disponible.'); }
  }
  async function withDb(fn) {
    const db = await database();
    try { return fn(db); }
    catch (error) { if (error instanceof AppError) throw error; throw fail(503, 'CATALOG_STORAGE', 'Le cache alimentaire est illisible. Aucune donnée du journal n’est modifiée.'); }
    finally { db.close(); }
  }
  function products(db, codes) { return codes.map(code => db.prepare('SELECT data FROM products WHERE code = ?').get(code))
    .filter(Boolean).map(row => JSON.parse(row.data)); }
  async function cached(query, barcode) {
    return withDb(db => {
      if (barcode) {
        const row = db.prepare('SELECT data, fetched FROM products WHERE code = ?').get(query);
        return row ? { products: [JSON.parse(row.data)], fresh: row.fetched > now() - WEEK } : null;
      }
      const row = db.prepare('SELECT codes, fetched FROM queries WHERE query = ?').get(query);
      return row ? { products: products(db, JSON.parse(row.codes)), fresh: row.fetched > now() - WEEK } : null;
    });
  }
  async function local(query, barcode) {
    if (barcode) return [];
    const tokens = normalized(query).match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) || [];
    if (!tokens.length) return [];
    return withDb(db => products(db, db.prepare('SELECT code FROM products_fts WHERE products_fts MATCH ? LIMIT 10')
      .all(tokens.map(t => `"${t}"*`).join(' AND ')).map(row => row.code)));
  }
  async function reserve(kind) {
    await withDb(db => {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM requests WHERE at <= ?').run(now() - 60_000);
        const count = db.prepare('SELECT count(*) AS n FROM requests WHERE kind = ?').get(kind).n;
        if (count >= (kind === 'search' ? 8 : 12)) throw fail(429, 'NUTRITION_LIMIT', 'La limite de recherche est atteinte. Attends une minute ou cherche dans le cache local.');
        db.prepare('INSERT INTO requests(kind, at) VALUES (?, ?)').run(kind, now());
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    });
  }
  async function fetchProducts(query, barcode) {
    await reserve(barcode ? 'product' : 'search');
    const url = new URL(barcode ? `/api/v3.6/product/${query}.json` : '/cgi/search.pl', BASE);
    url.searchParams.set('fields', FIELDS);
    if (!barcode) for (const [k, v] of Object.entries({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '10', lc: 'fr' })) url.searchParams.set(k, v);
    let response;
    try { response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(12_000) }); }
    catch { throw fail(503, 'NUTRITION_OFFLINE', 'La source alimentaire est indisponible. Essaie le cache local ou la saisie manuelle.'); }
    if (barcode && response.status === 404) return [];
    if (!response.ok) throw fail(response.status === 429 ? 429 : 503, 'NUTRITION_PROVIDER', response.status === 429
      ? 'Open Food Facts limite les demandes. Attends avant de réessayer.' : 'Open Food Facts est momentanément indisponible.');
    const reader = response.body?.getReader();
    if (!reader) throw fail(502, 'NUTRITION_FORMAT', 'La réponse alimentaire est vide.');
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 1_000_000) { await reader.cancel(); throw new Error('too large'); }
        chunks.push(Buffer.from(value));
      }
      const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!barcode && !Array.isArray(json.products)) throw new Error('invalid search');
      if (barcode && !json.product && json.status !== 0 && !json.errors?.some(e => e.message?.id === 'product_not_found')) throw new Error('invalid product');
      return (barcode ? [json.product] : json.products).slice(0, 10).map(raw => normalizeProduct(raw, new Date(now()).toISOString())).filter(Boolean)
        .filter(p => !barcode || p.code === query);
    } catch { throw fail(502, 'NUTRITION_FORMAT', 'La source a renvoyé des données illisibles ou trop volumineuses.'); }
  }
  async function save(query, barcode, items) {
    await withDb(db => {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const item of items) {
          db.prepare('INSERT OR REPLACE INTO products(code,data,fetched) VALUES(?,?,?)').run(item.code, JSON.stringify(item), now());
          db.prepare('DELETE FROM products_fts WHERE code = ?').run(item.code);
          db.prepare('INSERT INTO products_fts(code,terms) VALUES(?,?)').run(item.code, `${item.name} ${item.brand}`);
        }
        if (!barcode) db.prepare('INSERT OR REPLACE INTO queries(query,codes,fetched) VALUES(?,?,?)').run(query, JSON.stringify(items.map(p => p.code)), now());
        const old = db.prepare('SELECT code FROM products ORDER BY fetched DESC, code LIMIT -1 OFFSET ?').all(LIMIT);
        for (const { code } of old) {
          db.prepare('DELETE FROM products WHERE code = ?').run(code);
          db.prepare('DELETE FROM products_fts WHERE code = ?').run(code);
        }
        // Any query referencing an evicted product is removed rather than silently becoming incomplete.
        if (old.length) db.exec('DELETE FROM queries');
        db.exec('DELETE FROM queries WHERE query NOT IN (SELECT query FROM queries ORDER BY fetched DESC LIMIT 200)');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    });
  }
  return {
    async search(input, { localOnly = false } = {}) {
      if (typeof input !== 'string') throw fail(400, 'INVALID_SEARCH', 'Indique un nom ou un code-barres.');
      const query = normalized(input.trim().replace(/\s+/g, ' '));
      if (query.length < 2 || query.length > 80 || /[\p{C}]/u.test(query)) throw fail(400, 'INVALID_SEARCH', 'Utilise entre 2 et 80 caractères pour la recherche.');
      const barcode = /^\d+$/.test(query);
      if (barcode && !validCode(query)) throw fail(400, 'INVALID_BARCODE', 'Indique un code-barres de 8, 12, 13 ou 14 chiffres.');
      const hit = await cached(query, barcode);
      if (hit?.fresh || localOnly) return { products: hit?.products ?? await local(query, barcode), mode: localOnly ? 'local' : 'cache', warning: localOnly ? 'Recherche limitée aux produits déjà consultés ; vérifie la date des fiches.' : null };
      if (pending) throw fail(429, 'NUTRITION_BUSY', 'Une recherche alimentaire est déjà en cours. Attends sa fin.');
      pending = (async () => {
        try {
          const items = await fetchProducts(query, barcode);
          await save(query, barcode, items);
          return { products: items, mode: 'online', warning: null };
        } catch (error) {
          const items = hit?.products ?? await local(query, barcode);
          if (items.length && error.code !== 'CATALOG_STORAGE') return { products: items, mode: 'stale', warning: `${error.message} Résultats du cache uniquement ; vérifie leur date.` };
          throw error;
        }
      })();
      try { return await pending; } finally { pending = null; }
    },
    async portion(selection) {
      if (!selection || !validCode(selection.code)) throw fail(400, 'INVALID_PRODUCT', 'Rechoisis un produit alimentaire.');
      const item = (await cached(selection.code, true))?.products[0];
      if (!item || item.retrievedAt !== selection.retrievedAt) throw fail(409, 'PRODUCT_CHANGED', 'La fiche a changé ou n’est plus en cache. Recherche à nouveau le produit.');
      if (item.kcalPer100 === null) throw fail(400, 'MISSING_ENERGY', 'Cette fiche ne contient pas de valeur énergétique utilisable.');
      const kcal = Math.round(item.kcalPer100 * selection.quantity / 100 * 10) / 10;
      const nutrition = validateNutritionSnapshot({ ...item, quantity: selection.quantity, unit: selection.unit, basisConfirmed: selection.basisConfirmed }, kcal);
      return { name: item.name, kcal, nutrition };
    },
  };
}
