import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from './assistant.mjs';
import { nutritionSourceUrl, validateWebNutritionSnapshot } from './web-nutrition-source.mjs';

const clean = v => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
export function extractWebNutrition(html, inputUrl, retrievedAt = new Date().toISOString()) {
  const sourceUrl = nutritionSourceUrl(inputUrl);
  if (typeof html !== 'string' || Buffer.byteLength(html) > 1_000_000) throw new AppError(502, 'SOURCE_TOO_LARGE', 'La page dépasse la taille de lecture autorisée.');
  const visible = clean(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '));
  const perServing = /nutrition\s*:?\s*per serving\b/i.test(visible);
  const records = []; const subjects = new Set();
  for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let root; try { root = JSON.parse(match[1]); } catch { continue; }
    const queue = [root]; let count = 0;
    while (queue.length) {
      if (++count > 8000) throw new AppError(502, 'SOURCE_FORMAT', 'Les données structurées de cette page sont trop complexes.');
      const value = queue.pop();
      if (!value || typeof value !== 'object') continue;
      const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
      if (types.includes('Recipe') && value.nutrition && !Array.isArray(value.nutrition)) {
        const name = clean(value.name).slice(0, 120);
        const energy = /^\s*(\d+(?:\.\d+)?)\s*(kcal|calories|kj)\s*$/i.exec(String(value.nutrition.calories ?? ''));
        const explicit = clean(value.nutrition.servingSize);
        const yieldText = clean(typeof value.recipeYield === 'number' ? String(value.recipeYield) : value.recipeYield);
        const yieldMatch = /^(\d+)(?: (?:servings?|portions?|people))?$/i.exec(yieldText);
        const portions = yieldMatch ? Number(yieldMatch[1]) : 0;
        subjects.add(JSON.stringify([name, value.nutrition, yieldText]));
        const basisMethod = explicit && explicit.length <= 120 ? 'serving-size' : new URL(sourceUrl).hostname === 'www.bbcgoodfood.com' && perServing && portions > 0 && portions <= 1000 ? 'recipe-per-serving' : null;
        const servingLabel = basisMethod === 'serving-size' ? explicit : basisMethod ? `1 portion — recette pour ${portions}` : '';
        if (name && energy && basisMethod) {
          const original = Number(energy[1]); const kcalPerServing = energy[2].toLowerCase() === 'kj' ? Math.round(original / 4.184 * 1000) / 1000 : original;
          if (Number.isFinite(kcalPerServing) && kcalPerServing >= 0 && kcalPerServing <= 10000) {
            const code = createHash('sha256').update(JSON.stringify([sourceUrl, name, kcalPerServing, servingLabel, basisMethod])).digest('hex');
            if (!records.some(r => r.code === code) && records.length < 5) records.push({ provider: 'web', code, name, sourceUrl, license: null,
              kcalPerServing, servingLabel, basisMethod, retrievedAt, basis: 'serving', energyOriginal: energy[0].trim() });
          }
        }
      }
      for (const v of Object.values(value)) if (v && typeof v === 'object') {
        if (Array.isArray(v)) for (const item of v) queue.push(item); else queue.push(v);
      }
    }
  }
  if (subjects.size > 1) { for (let i = records.length - 1; i >= 0; i--) if (records[i].basisMethod === 'recipe-per-serving') records.splice(i, 1); }
  if (!records.length) throw new AppError(422, 'NO_SOURCE_NUTRITION', 'Aucune énergie avec portion explicite et exploitable dans les données structurées. Utilisez une autre page ou la saisie manuelle.');
  return records;
}

export function createWebNutrition(directory, { fetchImpl = fetch, now = Date.now } = {}) {
  const file = join(directory, 'web-nutrition.sqlite'); const calls = []; let busy = false;
  function database(fn) {
    let db;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 }); db = new DatabaseSync(file, { timeout: 1000 }); chmodSync(file, 0o600);
      db.exec('CREATE TABLE IF NOT EXISTS sources(code TEXT PRIMARY KEY, url TEXT NOT NULL, data TEXT NOT NULL, fetched INTEGER NOT NULL)');
      return fn(db);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'WEB_SOURCE_STORAGE', 'Le stockage des sources web est inaccessible. Aucune modification du journal.');
    } finally { db?.close(); }
  }
  return {
    async read(input) {
      const url = nutritionSourceUrl(input);
      while (calls.length && calls[0] <= now() - 60_000) calls.shift();
      if (busy || calls.length >= 6) throw new AppError(429, 'WEB_SOURCE_LIMIT', 'Attendez avant de lire une autre source web.');
      busy = true; calls.push(now());
      try {
        let response;
        try { response = await fetchImpl(url, { redirect: 'error', headers: { 'User-Agent': 'AlterEgoDev/0.6 (https://github.com/jajay122/alter-ego-dev)', Accept: 'text/html' }, signal: AbortSignal.timeout(12_000) }); }
        catch { throw new AppError(503, 'WEB_SOURCE_OFFLINE', 'Cette page est inaccessible ou redirige vers une autre adresse. Ouvrez son lien final dans votre navigateur.'); }
        if (!response.ok) throw new AppError(502, 'WEB_SOURCE_ERROR', 'Le site ne permet pas cette lecture. Ouvrez la page ou choisissez une autre source.');
        if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new AppError(415, 'WEB_SOURCE_FORMAT', 'Seules les pages HTML sont prises en charge, pas les PDF ou les images.');
        const chunks = []; let size = 0;
        try {
          for await (const chunk of response.body) { size += chunk.length; if (size > 1_000_000) throw new Error('large'); chunks.push(Buffer.from(chunk)); }
        } catch { throw new AppError(502, 'WEB_SOURCE_FORMAT', 'La page est trop volumineuse ou sa lecture a été interrompue.'); }
        const products = extractWebNutrition(Buffer.concat(chunks).toString('utf8'), url, new Date(now()).toISOString());
        database(db => {
          db.exec('BEGIN IMMEDIATE');
          try {
            db.prepare('DELETE FROM sources WHERE url=?').run(url);
            for (const p of products) db.prepare('INSERT INTO sources(code,url,data,fetched) VALUES(?,?,?,?)').run(p.code, url, JSON.stringify(p), now());
            db.exec('DELETE FROM sources WHERE code NOT IN (SELECT code FROM sources ORDER BY fetched DESC LIMIT 100)');
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
        });
        return { products, mode: 'web', warning: 'Valeurs de la page source, par portion indiquée. Vérifiez le plat, la portion et les ingrédients avant ajout.' };
      } finally { busy = false; }
    },
    portion(selection) {
      if (!selection || typeof selection.code !== 'string' || !/^[a-f0-9]{64}$/.test(selection.code)) throw new AppError(400, 'INVALID_PRODUCT', 'Rechoisissez une source web.');
      return database(db => {
        const row = db.prepare('SELECT data FROM sources WHERE code=?').get(selection.code);
        const p = row ? JSON.parse(row.data) : null;
        if (!p || p.retrievedAt !== selection.retrievedAt || Date.parse(p.retrievedAt) < now() - 14 * 86400_000) throw new AppError(409, 'PRODUCT_CHANGED', 'Relisez la source web avant de confirmer cette portion.');
        const kcal = Math.round(p.kcalPerServing * selection.quantity * 10) / 10;
        return { name: p.name, kcal, nutrition: validateWebNutritionSnapshot({ ...p, quantity: selection.quantity, unit: selection.unit, basisConfirmed: selection.basisConfirmed }, kcal) };
      });
    },
  };
}
