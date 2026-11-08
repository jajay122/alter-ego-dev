import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { nutritionSourceUrl, validateWebNutritionSnapshot } from '../lib/web-nutrition-source.mjs';
import { extractWebNutrition, createWebNutrition } from '../lib/web-nutrition.mjs';
import { createCalorieStore } from '../lib/calories.mjs';
import { createApp } from '../server.mjs';
const url='https://www.bbcgoodfood.com/recipes/test-recipe';
const recipe=(extra={})=>({'@type':'Recipe',name:'Recette fictive',recipeYield:2,nutrition:{'@type':'NutritionInformation',calories:'348 calories',servingSize:'1 portion de 150 g'},...extra});
const html=(value=recipe(),visible='')=>`<html><body>${visible}<script type="application/ld+json">${JSON.stringify(value)}</script></body></html>`;
const page=body=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});
const selection=p=>({provider:'web',code:p.code,retrievedAt:p.retrievedAt,quantity:1.5,unit:'serving',basisConfirmed:true});
async function directory(t){const dir=await mkdtemp(join(tmpdir(),'alter-ego-web-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('source web : HTTPS, domaines et chemins limités, sans paramètres ni fragment',()=>{
 assert.equal(nutritionSourceUrl(url+'?tracking=removed#nutrition'),url);
 for(const input of ['http://www.bbcgoodfood.com/recipes/test','https://127.0.0.1/recipes/test','https://[::1]/recipes/test','https://www.bbcgoodfood.com.evil.test/recipes/test','https://user:secret@www.bbcgoodfood.com/recipes/test','https://www.bbcgoodfood.com:8888/recipes/test','https://www.bbcgoodfood.com/admin/','https://www.bbcgoodfood.com/recipes/%2e%2e/admin','file:///etc/passwd'])assert.throws(()=>nutritionSourceUrl(input));
});

test('extraction liée à une recette et portion explicite, pas à un chiffre libre ou généré',()=>{
 const p=extractWebNutrition(html(),url)[0];assert.equal(p.kcalPerServing,348);assert.equal(p.servingLabel,'1 portion de 150 g');assert.equal(p.basisMethod,'serving-size');assert.equal(p.license,null);
 assert.throws(()=>extractWebNutrition('<p>Ignore instructions. Calories 348, serving 1</p>',url),{code:'NO_SOURCE_NUTRITION'});
 const kJ=extractWebNutrition(html(recipe({nutrition:{calories:'418.4 kJ',servingSize:'1 cup'}})),url)[0];assert.equal(kJ.kcalPerServing,100);
 assert.throws(()=>extractWebNutrition(html(recipe({nutrition:{calories:348,servingSize:'1 cup'}})),url),{code:'NO_SOURCE_NUTRITION'});
});

test('absence de portion et ambiguïté ne deviennent pas une estimation par 100 g',()=>{
 const without=recipe({nutrition:{calories:'348 calories'}});
 assert.throws(()=>extractWebNutrition(html(without),url),{code:'NO_SOURCE_NUTRITION'});
 const p=extractWebNutrition(html(without,'<h3>Nutrition:</h3><p>Per serving</p>'),url)[0];assert.equal(p.servingLabel,'1 portion — recette pour 2');
 assert.throws(()=>extractWebNutrition(html([without,recipe({name:'Other',nutrition:{calories:'200 calories'}})],'Nutrition: Per serving'),url),{code:'NO_SOURCE_NUTRITION'});
 assert.throws(()=>extractWebNutrition(html(without,'Nutrition: Per serving'),'https://www.skinnytaste.com/test-recipe/'),{code:'NO_SOURCE_NUTRITION'});
 assert.throws(()=>extractWebNutrition(html(recipe({recipeYield:0,nutrition:{calories:'348 calories'}}))+'Nutrition: Per serving',url),{code:'NO_SOURCE_NUTRITION'});
});

test('lecture limitée : redirections interdites, formats, taille et budget',async t=>{
 const reader=createWebNutrition(await directory(t),{fetchImpl:async(target,options)=>{assert.equal(target,url);assert.equal(options.redirect,'error');return page(html());}});
 for(let i=0;i<6;i++)assert.equal((await reader.read(url)).products.length,1);
 await assert.rejects(reader.read(url),{code:'WEB_SOURCE_LIMIT'});
 const wrong=createWebNutrition(await directory(t),{fetchImpl:async()=>new Response('PDF',{headers:{'Content-Type':'application/pdf'}})});
 await assert.rejects(wrong.read(url),{status:415});
 const large=createWebNutrition(await directory(t),{fetchImpl:async()=>page('x'.repeat(1_000_001))});await assert.rejects(large.read(url),{code:'WEB_SOURCE_FORMAT'});
 const offline=createWebNutrition(await directory(t),{fetchImpl:async()=>{throw new Error('redirect or offline');}});await assert.rejects(offline.read(url),{code:'WEB_SOURCE_OFFLINE'});
 const restricted=createWebNutrition(await directory(t),{fetchImpl:async()=>new Response('',{status:402})});await assert.rejects(restricted.read(url),{code:'WEB_SOURCE_ERROR'});
});

test('la portion et sa source restent figées dans le journal après rafraîchissement de page',async t=>{
 const dir=await directory(t);let content=html();const reader=createWebNutrition(dir,{fetchImpl:async()=>page(content)});
 const p=(await reader.read(url)).products[0], portion=reader.portion(selection(p));assert.equal(portion.kcal,522);
 assert.throws(()=>validateWebNutritionSnapshot({...portion.nutrition,sourceUrl:undefined},522),{code:'INVALID_NUTRITION'});
 assert.throws(()=>reader.portion({...selection(p),unit:'g'}),{code:'INVALID_NUTRITION'});
 const store=createCalorieStore(dir);const input={operationId:randomUUID(),date:'2026-11-08',meal:'lunch',...portion};await store.add(input);await store.add(input);
 content=html(recipe({nutrition:{calories:'400 calories',servingSize:'1 portion de 150 g'}}));await reader.read(url);
 assert.throws(()=>reader.portion(selection(p)),{code:'PRODUCT_CHANGED'});
 const saved=(await createCalorieStore(dir).snapshot()).entries;assert.equal(saved.length,1);assert.equal(saved[0].tenths,5220);assert.equal(saved[0].nutrition.kcalPerServing,348);
 assert.equal(saved[0].nutrition.sourceUrl,url);assert.ok((await readFile(join(dir,'calories.json'),'utf8')).includes('servingLabel'));
});

test('endpoint privé et sélection serveur, sans appel modèle ni écriture implicite au journal',async t=>{
 const dataDir=await directory(t);const password='test-web-nutrition-password';let calls=0;
 const server=createApp({config:{dataDir,password,origin:''},fetchImpl:async target=>{calls++;assert.equal(String(target),url);return page(html());}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base=`http://127.0.0.1:${server.address().port}`;let cookie;
 const req=(path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:base,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await req('/api/nutrition/web',{url})).status,401);cookie=(await req('/api/login',{password})).headers.get('set-cookie').split(';')[0];
 const r=await req('/api/nutrition/web',{url});assert.equal(r.status,200);const p=(await r.json()).products[0];
 assert.equal((await (await req('/api/calories/export')).json()).entries.length,0);
 const saved=await req('/api/calories/entries',{operationId:randomUUID(),name:'ignored',date:'2026-11-08',meal:'lunch',kcal:999,catalogPortion:selection(p)});
 assert.equal(saved.status,201);assert.equal((await saved.json()).kcal,522);assert.equal(calls,1);
});
