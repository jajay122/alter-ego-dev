import { getModelState,initModel,generateText,cancelGeneration } from './model-client.js';
const ROLES=[
 ['ARCHITECT','Architecture','Décris une architecture simple, les frontières et deux décisions techniques justifiées.'],
 ['PRODUCT','Produit','Précise le problème, les parcours et cinq critères d’acceptation observables.'],
 ['DESIGN','Design','Propose les écrans mobiles, navigation tactile, états vides et accessibilité.'],
 ['FRONTEND','Interfaces','Propose les composants et contrats d’interface, sans prétendre avoir écrit ou exécuté du code.'],
 ['BACKEND','Logique métier','Définis les opérations API, validation, erreurs et autorisations.'],
 ['DATABASE','Données','Propose tables, contraintes, sauvegarde et migration préservant les données.'],
 ['SECURITY','Sécurité','Identifie les risques concrets, gestion des accès et secrets ; ne génère aucune clé.'],
 ['QA','Validation','Propose les tests d’acceptation et cas limites. Aucun test n’a été exécuté : ne prétends jamais qu’il est réussi.'],
 ['DEVOPS','Mise en service','Prépare installation, surveillance et retour arrière ; production seulement après validation humaine.'],
 ['REVIEWER','Revue','Relève incohérences et priorités depuis ce brief. Aucun dépôt ni résultat de test réel à ta disposition.'],
];
let running;const listeners=new Set();const projectCache=new Map();const unsaved=new Map();
function announce(){for(const callback of listeners)callback();window.dispatchEvent(new CustomEvent('alter-ego-workshop',{detail:running?{title:running.project.title,role:running.role,done:running.project.deliverables.length}:null}));}
function fileDownload(project){
 const text=`# ${project.title}\n\n${project.brief}\n\nLivrables IA proposés, non exécutés.\n\n`+project.deliverables.map(d=>`## ${d.role}\n\n${d.text}\n\nModèle : ${d.model} · ${d.createdAt}`).join('\n\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='alter-ego-projet.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountWorkshop({root,api,toast}){
 root.innerHTML=`<div class="stack"><section class="card"><p class="eyebrow">ATELIER ALTER EGO</p><h2>Une idée. Dix regards.</h2><p class="muted">Les rôles spécialisés préparent des propositions à partir de votre brief avec le modèle local du navigateur. Le modèle léger peut se tromper, notamment en français : relisez ses propositions. Ces rôles ne modifient pas GitHub et n’exécutent aucun test.</p><p class="notice">Le calcul continue pendant la navigation dans cet onglet. Si le navigateur le suspend ou le ferme, les livrables déjà enregistrés restent disponibles ; vous pourrez reprendre les rôles restants.</p><a class="button button-secondary" href="/assistant" data-nav>Installer ou choisir l’IA</a></section><div class="form-grid"><section class="card stack"><h2>Nouveau projet</h2><form class="stack" data-project-form><label class="field"><span>Nom de l’application</span><input name="title" minlength="2" maxlength="100" required placeholder="Mon prochain outil"></label><label class="field"><span>Votre brief</span><textarea name="brief" rows="6" minlength="10" maxlength="2000" required placeholder="Pour qui, quel besoin, quelles fonctions ?"></textarea></label><button class="button button-primary">Enregistrer le brief</button></form></section><section class="card stack"><div class="section-heading"><h2>Mes projets</h2><button class="button button-ghost" data-refresh>Actualiser</button></div><div class="stack" data-projects></div></section></div><p role="status" class="notice" data-status hidden></p><section class="card stack" data-detail hidden><div class="section-heading"><div><p class="eyebrow">PROJET</p><h2 data-title></h2></div><span class="chip" data-count></span></div><p class="muted" data-brief></p><div class="row"><button class="button button-primary" data-run>Lancer les rôles restants</button><button class="button button-secondary" data-stop hidden>Arrêter</button><button class="button button-secondary" data-export>Exporter les livrables</button><button class="button button-ghost" data-reload>Recharger</button><button class="button button-danger" data-delete>Supprimer</button></div><p class="muted" data-run-state></p><div class="stack" data-deliverables></div></section></div>`;
 const $=s=>root.querySelector(s);let selected;let disposed=false;const controller=new AbortController();
 function status(message,error=false){if(disposed)return;const el=$('[data-status]');el.hidden=!message;el.textContent=message;el.className=`notice${error?' notice-error':''}`;}
 function currentProject(){return !selected?null:unsaved.get(selected.id)||(running?.project.id===selected.id?running.project:projectCache.get(selected.id)||selected);}
 function detail(){
  if(disposed||!selected)return;const p=currentProject();
  $('[data-detail]').hidden=false;$('[data-title]').textContent=p.title;$('[data-brief]').textContent=p.brief;$('[data-count]').textContent=`${p.deliverables.length}/10 livrables`;
  $('[data-run]').disabled=Boolean(running)||p.deliverables.length===10||unsaved.has(p.id);$('[data-stop]').hidden=running?.project.id!==p.id;
  $('[data-delete]').disabled=Boolean(running)||unsaved.has(p.id);$('[data-reload]').disabled=running?.project.id===p.id;
  $('[data-run-state]').textContent=unsaved.has(p.id)?'Un résultat reste local, sans confirmation de sauvegarde. Exportez-le avant de recharger le projet.':running?.project.id===p.id?`Travail local : ${running.role}. Chaque livrable est enregistré après génération.`:'Propositions IA à vérifier avant développement. Aucun résultat de test ou déploiement n’est exécuté par ces rôles.';
  const target=$('[data-deliverables]');target.replaceChildren();
  for(const [role,label] of ROLES){const d=p.deliverables.find(x=>x.role===role);const section=document.createElement('section');section.className='card';const title=document.createElement('h3');title.textContent=`${label} · ${role}`;const text=document.createElement('pre');text.style.whiteSpace='pre-wrap';text.style.fontFamily='inherit';text.style.overflowWrap='anywhere';text.textContent=d?d.text:'À préparer';section.append(title,text);target.append(section);}
 }
 async function list(){try{const data=await api('/api/workshop/projects',{signal:controller.signal});if(disposed)return;const target=$('[data-projects]');target.replaceChildren();if(!data.projects.length){const p=document.createElement('p');p.className='empty-state';p.textContent='Votre premier brief attend ici.';target.append(p);}for(const project of data.projects){const button=document.createElement('button');button.className='button button-secondary';button.textContent=`${project.title} · ${project.completed}/10`;button.addEventListener('click',async()=>{try{selected=await api(`/api/workshop/projects/${project.id}`,{signal:controller.signal});projectCache.set(selected.id,selected);detail();}catch(e){status(e.message,true);}});target.append(button);}}catch(e){if(e.name!=='AbortError')status(e.message,true);}}
 $('[data-project-form]').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{const form=new FormData(event.currentTarget);selected=await api('/api/workshop/projects',{method:'POST',body:{title:form.get('title'),brief:form.get('brief')},signal:controller.signal});event.target.reset();status('Brief enregistré dans votre espace privé.');detail();await list();}catch(e){status(e.message,true);}finally{button.disabled=false;}});
 $('[data-refresh]').addEventListener('click',list);$('[data-reload]').addEventListener('click',async()=>{if(!selected)return;try{if(unsaved.has(selected.id)&&!confirm('Recharger remplacera la copie locale non confirmée. Avez-vous exporté ce résultat ?'))return;const projectId=selected.id;const fresh=await api(`/api/workshop/projects/${projectId}`);unsaved.delete(projectId);selected=fresh;projectCache.set(selected.id,selected);detail();status('Projet rechargé.');}catch(e){status(e.message,true);}});
 $('[data-export]').addEventListener('click',()=>{if(selected)fileDownload(unsaved.get(selected.id)||(running?.project.id===selected.id?running.project:projectCache.get(selected.id)||selected));});
 $('[data-stop]').addEventListener('click',()=>{if(running?.project.id===selected?.id){running.controller.abort();cancelGeneration();}});
 $('[data-delete]').addEventListener('click',async()=>{const current=currentProject();if(!current||running||unsaved.has(current.id)||!confirm('Supprimer ce brief et ses livrables enregistrés ?'))return;try{await api(`/api/workshop/projects/${current.id}`,{method:'DELETE',body:{version:current.version}});selected=null;$('[data-detail]').hidden=true;await list();}catch(e){status(e.message,true);}});
 $('[data-run]').addEventListener('click',async()=>{
  const current=currentProject();
  if(!current||running||unsaved.has(current.id))return;
  if(getModelState().status==='generating'){status('Une autre tâche utilise déjà le modèle. Attendez sa fin.',true);return;}
  if(getModelState().status!=='ready'||getModelState().profile==='vision'){status('Activez d’abord le modèle texte dans Assistant IA, puis revenez lancer les rôles. Aucun téléchargement ne démarre ici.',true);return;}
  projectCache.set(current.id,current);
  const state={project:current,role:'Préparation',controller:new AbortController(),api};running=state;announce();status('');
  try{
   for(const [role,,instruction] of ROLES){
    if(state.controller.signal.aborted)break;if(state.project.deliverables.some(d=>d.role===role))continue;
    state.role=role;announce();
    const prompt=`Application : ${state.project.title}\nBrief : ${state.project.brief}\nRôle ${role} : ${instruction}\nRéponds en français, brièvement, avec des actions concrètes. Tu n’as aucun accès au dépôt, à des tests ou au déploiement. N’invente pas d’exécution.`;
    const text=await generateText(prompt,{signal:state.controller.signal,maxNewTokens:256,systemPrompt:'Tu aides à préparer une application personnelle simple et maintenable. Tes sorties sont des propositions, pas des actions effectuées.'});
    const model=getModelState().model;const deliverable={role,text,model,createdAt:new Date().toISOString()};
    const next=[...state.project.deliverables,deliverable];
    // Keep output locally if a version conflict occurs; never claim an unsuccessful save.
    const previous=state.project;state.project={...previous,deliverables:next};announce();
    state.project=await state.api(`/api/workshop/projects/${state.project.id}`,{method:'PUT',body:{version:previous.version,deliverables:next},signal:state.controller.signal});
    projectCache.set(state.project.id,state.project);unsaved.delete(state.project.id);selected=state.project;announce();
   }
   status(state.controller.signal.aborted?'Atelier arrêté. Les livrables enregistrés restent disponibles.':'Livrables enregistrés. Relisez-les avant toute création ou intégration.');
  }catch(e){status(e.name==='AbortError'?'Atelier interrompu. Le travail enregistré est conservé.':`${e.message} Exportez le résultat local si nécessaire.`,true);if(state.project.deliverables.length>(projectCache.get(state.project.id)?.deliverables.length??selected.deliverables.length))unsaved.set(state.project.id,state.project);selected=state.project;}
  finally{if(running===state)running=null;announce();detail();if(!disposed)await list();}
 });
 const update=()=>detail();listeners.add(update);if(running)selected=running.project;detail();list();
 return()=>{disposed=true;controller.abort();listeners.delete(update);};
}
