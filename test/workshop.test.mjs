import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorker } from '../hosted/worker.mjs';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../hosted/schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){const p=sqlite.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return p.get(...args)||null;},async all(){return{results:p.all(...args)};},async run(){const r=p.run(...args);return{meta:{changes:r.changes}};}};}};
 const worker=createWorker();
 return {close:()=>sqlite.close(),async call(path,{user='alice',method='GET',body}={}){const headers={'oai-authenticated-user-id':user};if(method!=='GET'){headers.origin='https://example.test';headers['content-type']='application/json';}const r=await worker.fetch(new Request('https://example.test'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{DB});return{status:r.status,data:await r.json()};}};
}
const brief={title:'Mon application',brief:'Un outil privé pour organiser mes projets sur téléphone.'};
const d={role:'ARCHITECT',text:'Proposition à vérifier, aucun test exécuté.',model:'test-local-model',createdAt:'2026-11-09T00:00:00.000Z'};
test('atelier : projets privés, identité owner et versions de livrables',async()=>{
 const f=fixture();try{
  const made=await f.call('/api/workshop/projects',{method:'POST',body:brief});assert.equal(made.status,201);const id=made.data.id;
  assert.equal((await f.call('/api/workshop/projects',{user:'bob'})).data.projects.length,0);
  assert.equal((await f.call('/api/workshop/projects/'+id,{user:'bob'})).status,404);
  const saved=await f.call('/api/workshop/projects/'+id,{method:'PUT',body:{version:1,deliverables:[d]}});assert.equal(saved.data.version,2);
  assert.equal((await f.call('/api/workshop/projects/'+id,{method:'PUT',body:{version:1,deliverables:[]}})).status,409);
  assert.equal((await f.call('/api/workshop/projects/'+id)).data.deliverables[0].text,d.text);
 }finally{f.close();}
});
test('atelier : données bornées, rôles uniques et refus de suppression obsolète',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('/api/workshop/projects',{method:'POST',body:{title:'x',brief:'short'}})).status,400);
  const p=(await f.call('/api/workshop/projects',{method:'POST',body:brief})).data;
  assert.equal((await f.call('/api/workshop/projects/'+p.id,{method:'PUT',body:{version:1,deliverables:[d,d]}})).status,400);
  assert.equal((await f.call('/api/workshop/projects/'+p.id,{method:'PUT',body:{version:1,deliverables:[{...d,text:'x'.repeat(6001)}]}})).status,400);
  assert.equal((await f.call('/api/workshop/projects/'+p.id,{method:'DELETE',body:{version:2}})).status,409);
  assert.equal((await f.call('/api/workshop/projects/'+p.id,{method:'DELETE',body:{version:1}})).status,200);
  assert.equal((await f.call('/api/workshop/projects/'+p.id)).status,404);
 }finally{f.close();}
});
