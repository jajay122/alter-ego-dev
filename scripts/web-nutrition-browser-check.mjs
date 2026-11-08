import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));const dataDir=await mkdtemp(join(tmpdir(),'alter-ego-web-browser-'));
const password=randomBytes(24).toString('hex');let calls=0;let hasPortion=true;
const source='https://www.bbcgoodfood.com/recipes/test-recipe';
const server=createApp({config:{dataDir,password,origin:''},fetchImpl:async url=>{
 calls++;if(String(url)!==source)throw new Error('Unexpected provider');
 return new Response(`<script type="application/ld+json">${JSON.stringify({'@type':'Recipe',name:'Recette web fictive',nutrition:{calories:'348 calories',...(hasPortion?{servingSize:'1 bol de référence'}:{})}})}</script>`,{headers:{'Content-Type':'text/html'}});
}});let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:360,height:800},locale:'fr-FR'});
 await page.addInitScript(()=>{window.open=url=>{window.previewOpenedUrl=url;return null;};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/calories');await page.locator('#password:not([disabled])').waitFor();await page.locator('#password').fill(password);await page.locator('#login-submit').click();
 await page.locator('#journal:not([hidden])').waitFor();await page.locator('#add-food').click();await page.locator('#food-source').selectOption('web');
 await page.locator('#food-query').fill('overnight oats');await page.locator('#find-web-source').click();
 const opened=await page.evaluate(()=>window.previewOpenedUrl);if(!opened?.startsWith('https://duckduckgo.com/?q='))throw new Error('Search discovery missing');
 if(calls)throw new Error('Automatic remote fetch during discovery');
 await page.locator('#web-source-url').fill('http://127.0.0.1/private');await page.locator('#search-food').click();
 await page.waitForFunction(()=>document.getElementById('search-status').textContent.includes('Source non prise'));
 if(calls)throw new Error('Unsafe source fetched');
 await page.locator('#web-source-url').fill(source);await page.locator('#search-food').click();await page.getByRole('button',{name:'Choisir Recette web fictive',exact:true}).click();
 await page.locator('#portion-quantity').fill('1.5');await page.locator('#portion-unit').selectOption('serving');
 if(await page.locator('#food-kcal').inputValue()!=='522')throw new Error('Incorrect per-serving calories');
 if(!await page.locator('#portion-unit option[value=g]').isDisabled()||!await page.locator('#portion-unit option[value=ml]').isDisabled())throw new Error('Implicit gram conversion possible');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.getElementById('food-dialog').scrollWidth>document.getElementById('food-dialog').clientWidth))throw new Error('Mobile overflow');
 await mkdir(join(root,'artifacts'),{recursive:true});await page.screenshot({path:join(root,'artifacts/web-source-mobile.png'),fullPage:true});
 await page.locator('#save-food').click();await page.locator('#food-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('total').textContent==='522');
 await page.locator('.entry-source').waitFor();if(await page.locator('.entry-source').getAttribute('href')!==source)throw new Error('Source lost');
 await page.reload();await page.locator('.entry-source').waitFor();
 const exported=await page.evaluate(async()=>(await fetch('/api/calories/export')).json());
 if(exported.entries[0].nutrition.kcalPerServing!==348||exported.entries[0].nutrition.quantity!==1.5)throw new Error('Snapshot not preserved');
 await page.setViewportSize({width:1365,height:1000});await page.screenshot({path:join(root,'artifacts/web-source-desktop.png'),fullPage:true});
 await page.locator('#add-food').click();await page.locator('#food-source').selectOption('web');hasPortion=false;await page.locator('#web-source-url').fill(source);await page.locator('#search-food').click();
 await page.waitForFunction(()=>document.getElementById('search-status').textContent.includes('Aucune énergie'));
 if(await page.locator('#search-results li').count())throw new Error('Unspecified portion became selectable');
 await page.locator('#cancel-food').click();await page.locator('#logout').click();await page.locator('#login-panel:not([hidden])').waitFor();
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(JSON.stringify({browser:'Chromium',widths:[360,1365],source:'simulated HTML',explicitDiscovery:true,unsafeUrlRefused:true,
  confirmedSourcePortion:true,kcal348times1point5:522,sourceAndExport:true,snapshotAfterReload:true,missingPortionRejected:true,remotePageCalls:calls,pageErrors:errors}));
}finally{await browser?.close();await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});await rm(dataDir,{recursive:true,force:true});}
