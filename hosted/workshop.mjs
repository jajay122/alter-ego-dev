import { AppError } from '../lib/assistant.mjs';
export const WORKSHOP_ROLES=['ARCHITECT','PRODUCT','DESIGN','FRONTEND','BACKEND','DATABASE','SECURITY','QA','DEVOPS','REVIEWER'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status,code,message)=>{throw new AppError(status,code,message);};
function output(value){
 if(!Array.isArray(value)||value.length>10)fail(400,'INVALID_DELIVERABLES','Dix livrables maximum.');
 const seen=new Set();
 return value.map(v=>{
  if(!v||!WORKSHOP_ROLES.includes(v.role)||seen.has(v.role)||typeof v.text!=='string'||!v.text.trim()||v.text.length>6000||typeof v.model!=='string'||v.model.length>150||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt)))fail(400,'INVALID_DELIVERABLES','Livrable invalide ou rôle dupliqué.');
  seen.add(v.role);return {role:v.role,text:v.text.trim(),model:v.model,createdAt:v.createdAt};
 });
}
function project(row){if(!row)return null;return {id:row.id,title:row.title,brief:row.brief,deliverables:JSON.parse(row.data),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at};}
export async function handleWorkshop(request,env,{owner,json,readBody,url}){
 const path=url.pathname, method=request.method;
 if(!owner)fail(401,'UNAUTHORIZED','Connexion requise.');
 const db=env.DB;
 if(path==='/api/workshop/projects'&&method==='GET'){
  const result=await db.prepare('SELECT * FROM atelier_projects WHERE owner=? ORDER BY updated_at DESC').bind(owner).all();
  return json({projects:result.results.map(row=>{const p=project(row);return {id:p.id,title:p.title,brief:p.brief,version:p.version,completed:p.deliverables.length,createdAt:p.createdAt,updatedAt:p.updatedAt};})});
 }
 if(path==='/api/workshop/projects'&&method==='POST'){
  const body=await readBody(request,16384),title=typeof body.title==='string'?body.title.trim():'',brief=typeof body.brief==='string'?body.brief.trim():'';
  if(title.length<2||title.length>100||brief.length<10||brief.length>2000)fail(400,'INVALID_PROJECT','Titre de 2 à 100 caractères et brief de 10 à 2 000 caractères.');
  const count=await db.prepare('SELECT count(*) AS n FROM atelier_projects WHERE owner=?').bind(owner).first();
  if(count.n>=50)fail(409,'PROJECT_LIMIT','La limite de 50 projets est atteinte. Exportez puis supprimez un ancien projet.');
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare('INSERT INTO atelier_projects(owner,id,title,brief,data,version,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)').bind(owner,id,title,brief,'[]',now,now).run();
  return json({id,title,brief,deliverables:[],version:1,createdAt:now,updatedAt:now},201);
 }
 const match=/^\/api\/workshop\/projects\/([a-f0-9-]{36})$/i.exec(path);
 if(!match||!UUID.test(match[1]))fail(404,'PROJECT_NOT_FOUND','Projet introuvable.');
 const row=await db.prepare('SELECT * FROM atelier_projects WHERE owner=? AND id=?').bind(owner,match[1]).first();
 if(!row)fail(404,'PROJECT_NOT_FOUND','Projet introuvable.');
 if(method==='GET')return json(project(row));
 const body=await readBody(request,80000);
 if(!Number.isInteger(body.version)||body.version<1)fail(400,'INVALID_VERSION','Rechargez la version du projet.');
 if(method==='DELETE'){
  const result=await db.prepare('DELETE FROM atelier_projects WHERE owner=? AND id=? AND version=?').bind(owner,row.id,body.version).run();
  if(!result.meta.changes)fail(409,'VERSION_CONFLICT','Projet modifié sur un autre appareil. Rechargez-le.');
  return json({deleted:true});
 }
 if(method==='PUT'){
  const deliverables=output(body.deliverables),now=new Date().toISOString();
  const result=await db.prepare('UPDATE atelier_projects SET data=?,version=version+1,updated_at=? WHERE owner=? AND id=? AND version=?').bind(JSON.stringify(deliverables),now,owner,row.id,body.version).run();
  if(!result.meta.changes)fail(409,'VERSION_CONFLICT','Projet modifié sur un autre appareil. Le résultat local peut être exporté avant de recharger.');
  return json({...project(row),deliverables,version:row.version+1,updatedAt:now});
 }
 fail(404,'NOT_FOUND','Opération inconnue.');
}
