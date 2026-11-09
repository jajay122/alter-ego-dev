import { mkdir,readFile,writeFile,readdir,rm,copyFile,cp } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve,join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function collectAssets({cataloguePath}={}){
 const assets={};const html=await readFile(join(root,'public/v2/app.html'),'utf8');
 for(const path of ['/','/calories','/calories/','/assistant','/assistant/','/atelier','/atelier/'])assets[path]={body:html,type:'text/html; charset=utf-8'};
 for(const name of await readdir(join(root,'public/v2'))){if(!/\.(?:js|css)$/.test(name))continue;assets['/v2/'+name]={body:await readFile(join(root,'public/v2',name),'utf8'),type:name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};}
 assets['/icon.svg']={body:await readFile(join(root,'public/icon.svg'),'utf8'),type:'image/svg+xml'};
 let body;
 if(cataloguePath)body=await readFile(cataloguePath,'utf8');
 else {try{body=await readFile(join(root,'reference/usda-catalog.json'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;const db=new DatabaseSync(join(root,'.data/usda.sqlite'),{readOnly:true});try{body=JSON.stringify(db.prepare('SELECT data FROM foods').all().map(r=>JSON.parse(r.data)));}finally{db.close();}}}
 const catalogue=JSON.parse(body);if(!Array.isArray(catalogue)||catalogue.length<8000||catalogue.length>20000||catalogue.some(p=>p.provider!=='usda'))throw new Error('Importer les références USDA vérifiées avant de construire le Site.');
 assets['/catalogue/usda.json']={body:JSON.stringify(catalogue),type:'application/json; charset=utf-8'};
 return assets;
}
export async function buildHosted(output,{cataloguePath,projectId='appgprj_6af02c9979648191a6559b395dc578df'}={}){
 const assets=await collectAssets({cataloguePath});await mkdir(output,{recursive:true});
 const builddir=join(output,'.build');await mkdir(builddir,{recursive:true});
 const generated=join(builddir,'assets.generated.mjs');await writeFile(generated,'export const assets = '+JSON.stringify(assets)+';\n');
 const esbuild=await import(process.env.ALTER_EGO_ESBUILD_MODULE?pathToFileURL(process.env.ALTER_EGO_ESBUILD_MODULE).href:'esbuild');
 const dist=join(output,'dist');await rm(dist,{recursive:true,force:true});await mkdir(join(dist,'server'),{recursive:true});
 await esbuild.build({entryPoints:[join(root,'hosted/worker.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:join(dist,'server/index.js'),minify:true,legalComments:'eof',plugins:[{name:'public-assets',setup(build){build.onResolve({filter:/assets\.generated\.mjs$/},()=>({path:generated}));}}]});
 let previous={};try{previous=JSON.parse(await readFile(join(output,'.openai/hosting.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(previous.project_id&&previous.project_id!==projectId)throw new Error('Le manifeste appartient à un autre Site. Aucun changement d’identité autorisé.');
 const manifest={...previous,project_id:projectId,d1:previous.d1||'DB',r2:previous.r2??null};delete manifest.static;
 await mkdir(join(output,'.openai'),{recursive:true});await writeFile(join(output,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
 await mkdir(join(dist,'.openai'),{recursive:true});await copyFile(join(output,'.openai/hosting.json'),join(dist,'.openai/hosting.json'));
 await rm(join(output,'drizzle'),{recursive:true,force:true});await cp(join(root,'hosted/migrations'),join(output,'drizzle'),{recursive:true});
 await cp(join(root,'hosted/migrations'),join(dist,'drizzle'),{recursive:true});
 // Source-visible public reference data supports deterministic rebuilds; never copy calories.json.
 await mkdir(join(output,'reference'),{recursive:true});await writeFile(join(output,'reference/usda-catalog.json'),assets['/catalogue/usda.json'].body);
 return {assets:Object.keys(assets).length,foods:JSON.parse(assets['/catalogue/usda.json'].body).length,output:dist};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=resolve(process.argv[2]||join(root,'.build/site'));
 const result=await buildHosted(output,{cataloguePath:process.env.USDA_REFERENCE_JSON});console.log(JSON.stringify(result));
}
