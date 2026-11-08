import { AppError } from './assistant.mjs';
export const WEB_NUTRITION_HOSTS = ['www.bbcgoodfood.com', 'www.skinnytaste.com', 'www.jamieoliver.com'];
export function nutritionSourceUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new AppError(400, 'INVALID_SOURCE_URL', 'Indiquez le lien HTTPS complet de la recette.'); }
  if (typeof input !== 'string' || input.length > 1000 || url.protocol !== 'https:' || url.port || url.username || url.password
    || !WEB_NUTRITION_HOSTS.includes(url.hostname) || !/^\/[a-z0-9\-/]+\/?$/i.test(url.pathname)
    || (url.hostname !== 'www.skinnytaste.com' && !url.pathname.startsWith('/recipes/'))) {
    throw new AppError(400, 'SOURCE_NOT_SUPPORTED', 'Source non prise en charge. Utilisez une recette Good Food, Skinnytaste ou Jamie Oliver en HTTPS.');
  }
  url.hash = ''; url.search = '';
  return url.toString();
}
export function validateWebNutritionSnapshot(value, kcal) {
  let validUrl;
  try { validUrl = nutritionSourceUrl(value.sourceUrl); } catch {}
  if (!validUrl || value.provider !== 'web' || typeof value.code !== 'string' || !/^[a-f0-9]{64}$/.test(value.code)
    || validUrl !== value.sourceUrl || value.license !== null || value.unit !== 'serving' || value.basisConfirmed !== true
    || typeof value.servingLabel !== 'string' || !value.servingLabel.trim() || value.servingLabel.length > 120
    || !['serving-size', 'recipe-per-serving'].includes(value.basisMethod)
    || !Number.isFinite(value.kcalPerServing) || value.kcalPerServing < 0 || value.kcalPerServing > 10000
    || !Number.isFinite(value.quantity) || value.quantity <= 0 || value.quantity > 10000
    || Math.abs(value.quantity * 10 - Math.round(value.quantity * 10)) > 1e-7
    || typeof value.retrievedAt !== 'string' || !Number.isFinite(Date.parse(value.retrievedAt))
    || Math.round(value.kcalPerServing * value.quantity * 10) !== Math.round(kcal * 10)) {
    throw new AppError(400, 'INVALID_NUTRITION', 'Confirmez la portion de référence de cette page ou utilisez la saisie manuelle.');
  }
  return { provider: 'web', code: value.code, sourceUrl: value.sourceUrl, license: null, unit: 'serving',
    servingLabel: value.servingLabel, basisMethod: value.basisMethod, kcalPerServing: value.kcalPerServing,
    quantity: value.quantity, basisConfirmed: true, retrievedAt: value.retrievedAt };
}
