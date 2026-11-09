import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve,join } from 'node:path';
const build=resolve(process.argv[2]||'.build/site');
const {default:worker}=await import(pathToFileURL(join(build,'dist/server/index.js')).href);
const sqlite=new DatabaseSync(':memory:');
const journal=JSON.parse(await readFile(join(build,'drizzle/meta/_journal.json'),'utf8'));
for(const entry of journal.entries)sqlite.exec(await readFile(join(build,'drizzle',entry.tag+'.sql'),'utf8'));
const DB={prepare(sql){const p=sqlite.prepare(sql);let args=[];return{bind(...v){args=v;return this;},async first(){return p.get(...args)??null;},async all(){return{results:p.all(...args)};},async run(){const r=p.run(...args);return{meta:{changes:r.changes}};}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const call=async(path,{user='build-check',method='GET',body}={})=>{
 const headers={};if(user)headers['oai-authenticated-user-id']=user;if(method!=='GET'){headers.origin='https://example.test';headers['content-type']='application/json';}
 return worker.fetch(new Request('https://example.test'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{DB});
};
try{
 assert.equal((await call('/',{user:null})).status,401);
 for(const path of ['/','/calories','/calories/','/assistant','/atelier']){const response=await call(path);assert.equal(response.status,200,path);assert.match(await response.text(),/\/v2\/app.js/);}
 for(const path of ['/v2/app.js','/v2/ai.js','/v2/model-client.js','/v2/model-worker.js','/v2/calories.js','/v2/workshop.js'])assert.equal((await call(path)).status,200,path);
 const catalogue=await(await call('/api/nutrition/catalogs')).json();assert.equal(catalogue.usda.count,8217);
 const products=(await(await call('/api/nutrition/search?source=usda&q=banana%20raw')).json()).products;
 const p=products.find(p=>p.code==='173944');assert.ok(p,'Real USDA raw banana is searchable');
 const added=await call('/api/calories/entries',{method:'POST',body:{operationId:'00000000-0000-4000-8000-000000000001',date:'2026-11-09',meal:'snack',catalogPortion:{provider:'usda',code:p.code,revision:p.revision,retrievedAt:p.retrievedAt,quantity:125,unit:'g',basisConfirmed:true}}});
 assert.equal(added.status,201,await added.clone().text());assert.equal((await added.json()).kcal,111.3);
 assert.equal((await(await call('/api/calories/export',{user:'another-user'})).json()).entries.length,0);
 assert.equal((await(await call('/api/calories/day?date=2026-11-09')).json()).total,111.3);
 const project=await call('/api/workshop/projects',{method:'POST',body:{title:'Projet de contrôle',brief:'Un projet synthétique utilisé seulement dans la base en mémoire du test de build.'}});assert.equal(project.status,201);
 assert.equal((await(await call('/api/workshop/projects',{user:'another-user'})).json()).projects.length,0);
 console.log(JSON.stringify({compiledWorker:true,migrationTables:6,routes:5,modules:6,realUsdaFoods:8217,portion125g:111.3,ownerIsolation:true,workshop:true}));
}finally{sqlite.close();}
