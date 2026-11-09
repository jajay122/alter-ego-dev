import { AppError } from './assistant.mjs';
import { validateWebNutritionSnapshot } from './web-nutrition-source.mjs';
const PROVIDER = 'openfoodfacts';
const BASE = 'https://world.openfoodfacts.org';
const fail = (status, code, message) => new AppError(status, code, message);
export const validCode = code => typeof code === 'string' && /^(?:\d{8}|\d{12,14})$/.test(code);

export function validateNutritionSnapshot(value, kcal) {
  if (value === undefined || value === null) return null;
  if (value.provider === 'web') return validateWebNutritionSnapshot(value, kcal);
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
