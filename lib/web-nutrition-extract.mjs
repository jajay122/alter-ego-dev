import { AppError } from './assistant.mjs';
import { nutritionSourceUrl } from './web-nutrition-source.mjs';
const clean = v => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
export function parseWebNutrition(html, inputUrl, retrievedAt = new Date().toISOString()) {
  const sourceUrl = nutritionSourceUrl(inputUrl);
  if (typeof html !== 'string' || new TextEncoder().encode(html).byteLength > 1_000_000) throw new AppError(502, 'SOURCE_TOO_LARGE', 'La page dépasse la taille de lecture autorisée.');
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
            const fingerprint = JSON.stringify([sourceUrl, name, kcalPerServing, servingLabel, basisMethod]);
            const code = fingerprint;
            if (!records.some(r => r.code === code) && records.length < 5) records.push({ provider: 'web', code, fingerprint, name, sourceUrl, license: null,
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

export async function extractWebNutrition(html, url, retrievedAt = new Date().toISOString()) {
  return Promise.all(parseWebNutrition(html, url, retrievedAt).map(async ({ fingerprint, ...record }) => ({ ...record, code: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))), b => b.toString(16).padStart(2, '0')).join('') })));
}
