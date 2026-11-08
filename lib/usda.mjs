import { DatabaseSync } from 'node:sqlite';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from './assistant.mjs';
import { validateNutritionSnapshot } from './nutrition.mjs';

export function createUsdaCatalog(directory) {
  function read(fn) {
    let db;
    try {
      statSync(join(directory, 'usda.sqlite'));
      db = new DatabaseSync(join(directory, 'usda.sqlite'), { readOnly: true, timeout: 1000 });
      const metadata = JSON.parse(db.prepare('SELECT data FROM metadata WHERE id=1').get()?.data);
      if (metadata.schema !== 1 || !Number.isInteger(metadata.count)) throw new Error('schema');
      return fn(db, metadata);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, error.code === 'ENOENT' ? 'USDA_REQUIRED' : 'USDA_STORAGE', error.code === 'ENOENT'
        ? 'Le catalogue USDA n’est pas encore installé. Utilisez Open Food Facts ou la saisie manuelle.'
        : 'Le catalogue USDA est inaccessible. Le journal et la saisie manuelle restent indépendants.');
    } finally { db?.close(); }
  }
  return {
    search(input) {
      const query = typeof input === 'string' ? input.trim() : '';
      if (query.length < 2 || query.length > 80 || /\p{C}/u.test(query)) throw new AppError(400, 'INVALID_SEARCH', 'Utilise entre 2 et 80 caractères pour rechercher dans USDA.');
      const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) || [];
      return read((db, metadata) => {
        let rows;
        if (/^[1-9]\d{0,9}$/.test(query)) rows = db.prepare('SELECT data FROM foods WHERE code=?').all(query);
        else rows = tokens.length ? db.prepare('SELECT f.data FROM foods_fts JOIN foods f ON f.code=foods_fts.code WHERE foods_fts MATCH ? ORDER BY bm25(foods_fts) LIMIT 20').all(tokens.map(t => `"${t}"*`).join(' AND ')) : [];
        return { products: rows.map(row => JSON.parse(row.data)), mode: 'local', catalog: { count: metadata.count, importedAt: metadata.importedAt },
          warning: 'USDA local : noms en anglais, valeurs pour 100 g. Vérifiez notamment cru/cuit et la description exacte.' };
      });
    },
    portion(selection) {
      if (!selection || selection.provider !== 'usda' || !/^[1-9]\d{0,9}$/.test(selection.code)) throw new AppError(400, 'INVALID_PRODUCT', 'Rechoisis une fiche USDA.');
      return read(db => {
        const row = db.prepare('SELECT data FROM foods WHERE code=?').get(selection.code);
        const item = row ? JSON.parse(row.data) : null;
        if (!item || item.revision !== selection.revision || item.retrievedAt !== selection.retrievedAt) throw new AppError(409, 'PRODUCT_CHANGED', 'Le catalogue USDA a changé. Recherche à nouveau l’aliment.');
        if (item.kcalPer100 === null) throw new AppError(400, 'MISSING_ENERGY', 'Cette fiche USDA ne contient pas de valeur énergétique utilisable.');
        const kcal = Math.round(item.kcalPer100 * selection.quantity / 100 * 10) / 10;
        const nutrition = validateNutritionSnapshot({ ...item, quantity: selection.quantity, unit: selection.unit, basisConfirmed: selection.basisConfirmed }, kcal);
        return { name: item.name.slice(0, 120), kcal, nutrition };
      });
    },
  };
}
