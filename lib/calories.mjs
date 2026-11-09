import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './assistant.mjs';
import { MEALS, validDate, validateEntry } from './calorie-validation.mjs';
export { MEALS, validDate, validateEntry } from './calorie-validation.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const blank = () => ({ schema: 1, goal: null, entries: [] });

function validateStored(data) {
  if (data?.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > 20000
    || !(data.goal === null || (Number.isInteger(data.goal) && data.goal > 0 && data.goal <= 20000))) throw new Error('invalid data');
  const ids = new Set();
  for (const entry of data.entries) {
    if (!UUID.test(entry.id) || ids.has(entry.id) || !Number.isInteger(entry.tenths)
      || !Number.isSafeInteger(entry.version) || entry.version < 1 || typeof entry.createdAt !== 'string') throw new Error('invalid entry');
    const normalized = validateEntry({ ...entry, kcal: entry.tenths / 10 });
    if (normalized.name !== entry.name) throw new Error('invalid name');
    ids.add(entry.id);
  }
  return data;
}

export function createCalorieStore(directory) {
  const file = join(directory, 'calories.json');
  let tail = Promise.resolve();
  async function load() {
    try { return validateStored(JSON.parse(await readFile(file, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') return blank();
      throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Le journal est illisible ou inaccessible. Aucune donnée existante ne sera remplacée.');
    }
  }
  async function save(data) {
    const temporary = join(directory, `.calories-${randomUUID()}.tmp`);
    let handle;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(data));
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, file);
    } catch {
      throw new AppError(503, 'SAVE_FAILED', 'La sauvegarde a échoué. La modification n’est pas confirmée ; réessaie après vérification du stockage.');
    } finally {
      await handle?.close().catch(() => {});
      await unlink(temporary).catch(() => {});
    }
  }
  function mutate(fn) {
    const result = tail.then(async () => {
      const data = await load();
      const value = fn(data);
      await save(data);
      return value;
    });
    tail = result.then(() => {}, () => {});
    return result;
  }
  return {
    async snapshot() { await tail; return load(); },
    async day(date) {
      if (!validDate(date)) throw new AppError(400, 'INVALID_DATE', 'La date choisie est invalide.');
      const data = await this.snapshot();
      const entries = data.entries.filter(e => e.date === date).map(e => ({ ...e, kcal: e.tenths / 10 }));
      const mealTotals = Object.fromEntries(MEALS.map(meal => [meal, entries.filter(e => e.meal === meal).reduce((sum, e) => sum + e.tenths, 0) / 10]));
      return { date, entries, total: entries.reduce((sum, e) => sum + e.tenths, 0) / 10, mealTotals, goal: data.goal };
    },
    add(body) {
      const input = validateEntry(body);
      if (!UUID.test(body.operationId)) throw new AppError(400, 'INVALID_OPERATION', 'L’identifiant de la demande est invalide.');
      return mutate(data => {
        const existing = data.entries.find(e => e.id === body.operationId);
        if (existing) {
          if (Object.entries(input).some(([key, value]) => key === 'nutrition' ? JSON.stringify(existing[key]) !== JSON.stringify(value) : existing[key] !== value) || Boolean(existing.nutrition) !== Boolean(input.nutrition)) throw new AppError(409, 'OPERATION_CONFLICT', 'Cette demande a déjà été enregistrée avec un autre contenu. Recharge le journal.');
          return { ...existing, kcal: existing.tenths / 10 };
        }
        if (data.entries.length >= 20000) throw new AppError(409, 'JOURNAL_FULL', 'La capacité de ce prototype est atteinte. Exporte le journal avant de l’alléger.');
        const entry = { id: body.operationId, ...input, version: 1, createdAt: new Date().toISOString() };
        data.entries.push(entry);
        return { ...entry, kcal: entry.tenths / 10 };
      });
    },
    update(id, body) {
      const input = validateEntry(body);
      return mutate(data => {
        const entry = data.entries.find(e => e.id === id);
        if (!entry) throw new AppError(404, 'ENTRY_NOT_FOUND', 'Cette entrée n’existe plus. Recharge le journal.');
        if (body.version !== entry.version) throw new AppError(409, 'VERSION_CONFLICT', 'Cette entrée a été modifiée dans un autre onglet. Recharge le journal avant de la corriger.');
        if (!input.nutrition && body.preserveNutrition === true && entry.nutrition && input.name === entry.name && input.tenths === entry.tenths) input.nutrition = entry.nutrition;
        if (!input.nutrition) delete entry.nutrition;
        Object.assign(entry, input, { version: entry.version + 1 });
        return { ...entry, kcal: entry.tenths / 10 };
      });
    },
    remove(id, version) {
      return mutate(data => {
        const index = data.entries.findIndex(e => e.id === id);
        if (index < 0) return { deleted: true };
        if (data.entries[index].version !== version) throw new AppError(409, 'VERSION_CONFLICT', 'Cette entrée a changé. Recharge le journal avant de la supprimer.');
        data.entries.splice(index, 1);
        return { deleted: true };
      });
    },
    setGoal(goal) {
      if (!(goal === null || (Number.isInteger(goal) && goal > 0 && goal <= 20000))) throw new AppError(400, 'INVALID_GOAL', 'Choisis un objectif entier entre 1 et 20 000 kcal, ou laisse le champ vide.');
      return mutate(data => { data.goal = goal; return { goal }; });
    },
  };
}
