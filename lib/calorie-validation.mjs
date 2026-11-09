import { AppError } from './assistant.mjs';
import { validateNutritionSnapshot } from './nutrition-validation.mjs';
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

export function validateEntry(value) {
  const name = typeof value?.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > 120) throw new AppError(400, 'INVALID_FOOD', 'Indique un aliment ou un plat (120 caractères maximum).');
  if (!validDate(value.date)) throw new AppError(400, 'INVALID_DATE', 'La date choisie est invalide.');
  if (!MEALS.includes(value.meal)) throw new AppError(400, 'INVALID_MEAL', 'Choisis un repas valide.');
  const kcal = value.kcal;
  if (typeof kcal !== 'number' || !Number.isFinite(kcal) || kcal < 0 || kcal > 10000
    || Math.abs(kcal * 10 - Math.round(kcal * 10)) > 1e-7) {
    throw new AppError(400, 'INVALID_CALORIES', 'Indique les kcal de la portion : entre 0 et 10 000, avec une décimale maximum.');
  }
  const nutrition = validateNutritionSnapshot(value.nutrition, kcal);
  return { name, date: value.date, meal: value.meal, tenths: Math.round(kcal * 10), ...(nutrition ? { nutrition } : {}) };
}
