import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = await mkdtemp(join(tmpdir(), 'alter-ego-photo-browser-'));
const password = randomBytes(24).toString('hex');
let modelCalls = 0; let catalogCalls = 0; let mode = 'banana'; let sentImage; let realAnswer;
const realImage = process.env.PHOTO_REAL_IMAGE;
const server = createApp({ config: { password, origin: '', dataDir, modelUrl: 'http://127.0.0.1:8081' }, fetchImpl: async (url, options) => {
  const target = new URL(url);
  if (target.hostname === '127.0.0.1') {
    modelCalls++;
    const input = JSON.parse(options.body).messages[0].content;
    sentImage = input[1].image_url.url;
    const bytes = Buffer.from(sentImage.split(',')[1], 'base64');
    if (bytes.includes(Buffer.from('PRIVATE_TEST_METADATA')) || !sentImage.startsWith('data:image/jpeg;base64,')) throw new Error('Metadata or original format sent');
    if (realImage) {
      const response = await fetch(url, options);
      const payload = await response.clone().json();
      realAnswer = payload.choices?.[0]?.message?.content ?? payload.error?.message;
      return response;
    }
    if (mode === 'offline') throw new Error('simulated model outage');
    const current = mode;
    if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 700));
    return Response.json({ choices: [{ message: { content: current === 'slow' ? 'stale' : current }, finish_reason: 'stop' }] });
  }
  if (target.hostname !== 'world.openfoodfacts.org') throw new Error('Unexpected outbound request');
  catalogCalls++;
  return Response.json({ products: [{ code: '2000000000008', product_name: 'Produit test banane', nutriments: { 'energy-kcal_100g': 89 } }] });
} });
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, locale: 'fr-FR' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/calories');
  await page.locator('#password:not([disabled])').waitFor(); await page.locator('#password').fill(password); await page.locator('#login-submit').click();
  await page.locator('#journal:not([hidden])').waitFor(); await page.locator('#add-food').click();
  const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 1200; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffc900'; ctx.fillRect(0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg').split(',')[1]; });
  const original = realImage ? await readFile(realImage) : Buffer.from(encoded, 'base64');
  const comment = Buffer.from('PRIVATE_TEST_METADATA');
  const file = { name: 'private-photo-test.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([original.subarray(0, 2), Buffer.from([0xff, 0xfe, 0, comment.length + 2]), comment, original.subarray(2)]) };
  async function attach() { if (!await page.locator('#photo-panel').evaluate(el => el.open)) await page.locator('#photo-title').click(); await page.locator('#meal-photo').setInputFiles(file); await page.waitForFunction(() => document.getElementById('photo-status').textContent.includes('Photo prête')); }
  async function analyze() { await page.locator('#analyze-photo').click(); }
  await attach();
  if (modelCalls || catalogCalls) throw new Error('Photo sent before explicit action');
  const size = await page.locator('#meal-photo-image').evaluate(img => ({ w: img.naturalWidth, h: img.naturalHeight }));
  if (Math.max(size.w, size.h) > 512) throw new Error('Photo not resized');
  await analyze();
  await page.locator('#analyze-photo:not([disabled])').waitFor({ timeout: 70_000 });
  if (!await page.locator('#photo-candidates button').count()) throw new Error(`No candidate: ${await page.locator('#photo-status').textContent()}; model: ${realAnswer || mode}`);
  if (realImage && !/banana/i.test(realAnswer)) throw new Error(`Unexpected real answer: ${realAnswer}`);
  if (catalogCalls) throw new Error('Automatic external lookup from image');
  if (await page.locator('#food-name').inputValue() || await page.locator('#food-kcal').inputValue()) throw new Error('Photo filled nutritional fields');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.getElementById('food-dialog').scrollWidth > document.getElementById('food-dialog').clientWidth)) throw new Error('Mobile photo modal overflow');
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await page.screenshot({ path: join(root, realImage ? 'artifacts/photo-real-mobile.png' : 'artifacts/photo-mobile.png'), fullPage: true });
  if (realImage) {
    console.log(JSON.stringify({ realModel: true, realAnswer, modelCalls, catalogCalls, imageSize: size, candidatesShown: true, pageErrors: errors }));
  } else {
    await page.getByRole('button', { name: /Rechercher banana/i }).click();
    if (await page.locator('#food-query').inputValue() !== 'banana') throw new Error('Candidate is not editable search text');
    await page.locator('#food-query').fill('banane'); await page.locator('#search-food').click();
    await page.getByRole('button', { name: 'Choisir Produit test banane', exact: true }).click();
    await page.locator('#portion-quantity').fill('100'); await page.locator('#portion-unit').selectOption('g'); await page.locator('#save-food').click();
    await page.locator('#food-dialog').waitFor({ state: 'hidden' }); await page.waitForFunction(() => document.getElementById('total').textContent === '89');
    const exported = await page.evaluate(async () => (await fetch('/api/calories/export')).json());
    if (exported.entries.length !== 1 || JSON.stringify(exported).includes('base64') || exported.entries[0].nutrition.kcalPer100 !== 89) throw new Error('Image saved or source lost');
    await page.locator('#add-food').click(); mode = 'UNKNOWN'; await attach(); await analyze();
    await page.waitForFunction(() => document.getElementById('photo-status').textContent.includes('Aucun nom'));
    if (await page.locator('#photo-candidates button').count()) throw new Error('Invented fallback');
    mode = 'offline'; await analyze(); await page.waitForFunction(() => document.getElementById('photo-status').textContent.includes('ne répond pas'));
    await page.locator('#food-name').fill('Saisie manuelle test'); await page.locator('#food-kcal').fill('50'); await page.locator('#save-food').click();
    await page.locator('#food-dialog').waitFor({ state: 'hidden' }); await page.waitForFunction(() => document.getElementById('total').textContent === '139');
    await page.locator('#add-food').click(); mode = 'slow'; await attach(); await analyze();
    await page.locator('#cancel-photo').click(); await page.waitForFunction(() => document.getElementById('photo-status').textContent.includes('annulée'));
    await new Promise(resolve => setTimeout(resolve, 800));
    if (await page.locator('#photo-candidates button').count()) throw new Error('Late cancelled result');
    await analyze(); await page.locator('#cancel-food').click(); await page.locator('#add-food').click();
    await new Promise(resolve => setTimeout(resolve, 800));
    if (await page.locator('#photo-candidates button').count() || !await page.locator('#meal-photo-preview').isHidden()) throw new Error('Photo leaked into next entry');
    await page.locator('#photo-title').click();
    await page.locator('#meal-photo').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a photo') });
    await page.waitForFunction(() => document.getElementById('photo-status').textContent.includes('illisible'));
    mode = 'banana'; await attach(); await analyze(); await page.getByRole('button', { name: /Rechercher banana/i }).waitFor();
    await page.setViewportSize({ width: 1365, height: 1000 }); await page.screenshot({ path: join(root, 'artifacts/photo-desktop.png'), fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Desktop overflow');
    await page.locator('#remove-meal-photo').click();
    if (await page.locator('#photo-candidates button').count() || !await page.locator('#meal-photo-preview').isHidden()) throw new Error('Removal failed');
    await page.locator('#cancel-food').click(); await page.locator('#logout').click(); await page.locator('#login-panel:not([hidden])').waitFor();
    if (await page.locator('#food-list').textContent()) throw new Error('Data remains after logout');
    const files = await readdir(dataDir);
    if (files.some(name => !['calories.json', 'nutrition.sqlite'].includes(name))) throw new Error('Photo persisted');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ realModel: false, provider: 'simulated', widths: [360, 1365], explicitPhotoSend: true, strippedMetadata: true,
      resized: size, editableCandidate: true, explicitFoodSearch: true, confirmedPortion: true, sourceInJournal: true,
      noImageStored: true, noFoodFallback: true, modelOfflineManualWorks: true, cancelAndLateResult: true, removalAndLogout: true, pageErrors: errors }));
  }
} finally {
  await browser?.close();
  await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  await rm(dataDir, { recursive: true, force: true });
}
