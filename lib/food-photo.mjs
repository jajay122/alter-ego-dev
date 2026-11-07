import { validateInput } from './assistant.mjs';

// A server-owned prompt: the photo is only used to suggest search terms.
export const FOOD_PHOTO_PROMPT = 'What food is visible in this photo? Reply with only the main food name in English, at most five words. Do not give calories, quantities or advice. If no food is visible, reply UNKNOWN.';

export function validateFoodPhoto(body) {
  return validateInput({ mode: 'photo', prompt: FOOD_PHOTO_PROMPT, image: body?.image });
}

export function foodCandidates(answer, truncated = false) {
  if (truncated || typeof answer !== 'string' || answer.length > 1200) return [];
  // Reject uncertain/prose replies as a whole: a comma must not turn their tail into a food name.
  if (/\b(?:unknown|none|nothing|unclear|unidentified|inconnu|aucun|impossible|cannot|sorry|not|no|photo|image|picture|visible|instructions?|ignore|answer|reply|this|there|looks|appears|specified|but)\b/iu.test(answer)) return [];
  const candidates = [];
  for (const line of answer.split(/[\n,;]/)) {
    const name = line.trim().replace(/^(?:[-*•]\s*|\d+[.)]\s*)/, '').replace(/[.!]$/, '').trim();
    if (!name || name.length > 60 || name.split(/\s+/).length > 6
      || !/^[\p{L}][\p{L}\p{M}\s’'\-]*$/u.test(name)
      || /\b(?:unknown|none|nothing|unclear|unidentified|inconnu|aucun|impossible|cannot|sorry|not|no|photo|image|picture|visible|calories?|kcal|kilocalories?|kj|grams?|grammes?|millilitres?|portion|instructions?|ignore|answer|reply|this|there|looks|appears)\b/iu.test(name)) continue;
    if (!candidates.some(c => c.toLocaleLowerCase() === name.toLocaleLowerCase())) candidates.push(name);
    if (candidates.length === 3) break;
  }
  return candidates;
}
