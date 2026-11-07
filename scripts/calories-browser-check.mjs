import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'alter-ego-calories-browser-'));
const password = randomBytes(24).toString('hex');
const url = 'http://127.0.0.1:3301';
await mkdir(join(root, 'artifacts'), { recursive: true });
let server;
let browser;
async function start() {
  server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env,
    ASSISTANT_PASSWORD: password, HOST: '127.0.0.1', PORT: '3301', CALORIES_DATA_DIR: directory,
    MODEL_URL: 'http://127.0.0.1:1' }, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw new Error('Server failed to start');
    try { if ((await fetch(url + '/api/session')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server startup timed out');
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => { server.once('exit', resolve); server.kill('SIGTERM'); });
}
try {
  await start();
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-11-07T23:30:00.000Z') });
  await page.goto(url);
  await page.getByRole('heading', { name: 'Mes applications', exact: true }).waitFor();
  if (await page.locator('.app-card').count() !== 2) throw new Error('Portal must show two real applications');
  await page.waitForFunction(() => !document.getElementById('portal-status').textContent.includes('Vérification'));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Portal mobile overflow');
  await page.screenshot({ path: join(root, 'artifacts/portal-mobile.png'), fullPage: true });
  await page.locator('.app-open[href="/calories"]').click();
  if (await page.locator('#day').inputValue() !== '2026-11-08') throw new Error('Calendar uses UTC instead of local day');
  async function login() {
    await page.locator('#password:not([disabled])').waitFor();
    await page.locator('#password').fill(password);
    await page.locator('#login-submit').click();
    await page.locator('#journal:not([hidden])').waitFor();
  }
  async function total(value) { await page.waitForFunction(v => document.getElementById('total').textContent === v, value); }
  async function add(name, kcal, meal) {
    await page.locator('#add-food').click();
    await page.locator('#food-name').fill(name);
    await page.locator('#food-kcal').fill(String(kcal));
    await page.locator('#food-meal').selectOption(meal);
    await page.locator('#save-food').click();
    await page.locator('#food-dialog').waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name, exact: true }).waitFor();
  }
  await login(); await total('0');
  await page.getByText('La journée commence ici.').waitFor();
  if (!await page.locator('#goal-progress').isHidden()) throw new Error('A goal is imposed by default');
  await add('Yaourt nature', 125, 'breakfast'); await total('125');
  await add('Déjeuner maison', 450.5, 'lunch'); await total('575,5');
  await page.getByRole('button', { name: 'Modifier Yaourt nature', exact: true }).click();
  await page.locator('#food-kcal').fill('140'); await page.locator('#save-food').click();
  await page.locator('#food-dialog').waitFor({ state: 'hidden' }); await total('590,5');
  await page.locator('#set-goal').click(); await page.locator('#goal-input').fill('1500'); await page.locator('#save-goal').click();
  await page.locator('#goal-dialog').waitFor({ state: 'hidden' }); await page.getByText('Repère personnel : 1 500 kcal').waitFor();
  await page.locator('#previous-day').click(); await total('0');
  await add('Pomme', 80, 'snack'); await total('80');
  await page.locator('#next-day').click(); await total('590,5');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow at 360 pixels');
  await page.screenshot({ path: join(root, 'artifacts/calories-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1365, height: 1000 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow on desktop');
  await page.screenshot({ path: join(root, 'artifacts/calories-desktop.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  if (exported.entries.length !== 3 || exported.goal !== 1500) throw new Error('Export does not contain the saved journal');
  await stop(); await start();
  await page.reload(); await page.locator('#login-panel:not([hidden])').waitFor();
  await login(); await total('590,5');
  await page.getByRole('button', { name: 'Supprimer Yaourt nature', exact: true }).click();
  await page.locator('#cancel-delete').click();
  await total('590,5');
  await page.getByRole('button', { name: 'Supprimer Yaourt nature', exact: true }).click();
  await page.locator('#confirm-delete').click(); await page.locator('#delete-dialog').waitFor({ state: 'hidden' }); await total('450,5');
  await page.locator('#set-goal').click(); await page.locator('#goal-input').fill(''); await page.locator('#save-goal').click();
  await page.locator('#goal-dialog').waitFor({ state: 'hidden' }); await page.getByText('Aucun objectif défini').waitFor();
  await page.locator('#logout').click(); await page.locator('#login-panel:not([hidden])').waitFor();
  if (await page.locator('#food-list').textContent()) throw new Error('Private data remains after logout');
  await login();
  await page.goto(url);
  await page.locator('#portal-logout:not([hidden])').waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Portal desktop overflow');
  await page.screenshot({ path: join(root, 'artifacts/portal-desktop.png'), fullPage: true });
  await page.locator('#portal-logout').click();
  await page.getByText('Votre espace est verrouillé. Les données restent privées.').waitFor();
  const privateStatus = await page.evaluate(async () => (await fetch('/api/calories/export')).status);
  if (privateStatus !== 401) throw new Error('Portal logout does not revoke journal access');
  await page.locator('.app-open[href="/assistant"]').click();
  if (await page.title() === 'ALTER EGO — Mes applications') throw new Error('Assistant link returns to portal');
  if (errors.length) throw new Error(errors.join('\n'));
  const summary = { browser: 'Chromium', widths: [360, 1365], localDate: '2026-11-08 (Paris)',
    portalNavigation: true, portalLogoutRevokesAccess: true, additions: true, decimalTotals: true, edit: true, daySeparation: true, export: true,
    actualServerRestart: true, deleteConfirmation: true, optionalGoal: true, logoutClearsData: true,
    horizontalOverflow: false, modelRunningRequired: false, pageErrors: errors };
  await writeFile(join(root, 'artifacts/calories-browser-check.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await browser?.close(); await stop(); await rm(directory, { recursive: true, force: true }); }
