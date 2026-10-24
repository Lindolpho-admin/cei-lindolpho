import { initialBooks } from './bootstrap.js';
const POINTER='cei/host-active.json', LOCK='cei/host-lock.json';
const STATE='cei/state/current.json';
export const collections=['docs','books','loans','readers','generatedDocs','waitlist','oficios','encaminhamentosMeimei'];
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const problem=(message,status=400)=>{throw Object.assign(Error(message),{status})};
export function validateState(data){if(data?.app!=='CEI Admin'||collections.some(k=>!Array.isArray(data[k])))problem('Base de dados inválida.');if(JSON.stringify(data).length>20*1024*1024)problem('Base de registros acima de 20 MB.',413)}
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function withWriteLock(raw,fn){
 const existing=await raw.get(LOCK);if(existing&&JSON.parse(await existing.text()).expires>Date.now())problem('Outra gravação está em andamento. Tente novamente em instantes.',423);
 const token=crypto.randomUUID(),value=JSON.stringify({token,expires:Date.now()+180000});
 const locked=await raw.put(LOCK,value,{onlyIf:existing?{etagMatches:existing.etag}:new Headers({'If-None-Match':'*'})});
 if(!locked)problem('Outra gravação está em andamento. Tente novamente.',423);
 try{return await fn()}finally{const lock=await raw.get(LOCK);if(lock&&JSON.parse(await lock.text()).token===token)await raw.delete(LOCK)}
}
export async function activeBucket(raw){
 const pointer=await raw.get(POINTER),id=pointer?JSON.parse(await pointer.text()).id:'';
 const prefix=id?'datasets/'+id+'/':'';
 return {includeSeeds:!id,generation:id||'original',raw,
 get:key=>raw.get(prefix+key),put:(key,value,options)=>raw.put(prefix+key,value,options),delete:key=>raw.delete(prefix+key),
 async list(options={}){const page=await raw.list({...options,prefix:prefix+(options.prefix||'')});return {...page,objects:page.objects.map(x=>({...x,key:x.key.slice(prefix.length)}))}}
 };
}
export async function ensureInitial(raw){
 if(await raw.get('cei/host-initialized.json'))return;
 await withWriteLock(raw,async()=>{
 if(await raw.get('cei/host-initialized.json'))return;
 const bucket=await activeBucket(raw),obj=await bucket.get(STATE);let data=obj?JSON.parse(await obj.text()):null;
 if(!data||collections.every(k=>!(data[k]||[]).length)){
 data={app:'CEI Admin',schemaVersion:4,savedAt:new Date().toISOString(),settings:{textCase:'title'},...Object.fromEntries(collections.map(k=>[k,[]])),books:initialBooks};
 await bucket.put(STATE,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});
 }
 await raw.put('cei/host-initialized.json',JSON.stringify({at:new Date().toISOString()}));
 });
}
export async function signature(bucket){let cursor,objects=[];do{const page=await bucket.list({prefix:'',cursor});objects.push(...page.objects.filter(x=>x.key===STATE||x.key.startsWith('app/')).map(x=>[x.key,x.etag]));cursor=page.truncated?page.cursor:undefined}while(cursor);objects.sort((a,b)=>a[0].localeCompare(b[0]));return digest(new TextEncoder().encode(JSON.stringify([bucket.generation,objects])))}
export async function storageApi(request,raw,{records,assets}){
 const url=new URL(request.url),path=url.pathname.replace('/api/storage/',''),bucket=await activeBucket(raw);
 if(path==='status'&&request.method==='GET')return json({mode:'hosting',shared:true});
 if(path==='backup'&&request.method==='GET'){
 const before=await signature(bucket),state=JSON.parse(await (await bucket.get(STATE)).text()),catalog=await records(bucket),files=[];
 for(const record of catalog)for(const field of ['file','signedFile'])if(record[field])files.push({recordId:record.id,field,...record[field]});
 if(before!==await signature(bucket))problem('A base mudou durante a leitura. Tente novamente.',409);
 return json({format:'cei-admin-complete-backup',version:2,createdAt:new Date().toISOString(),snapshot:before,state,archive:{records:catalog,files}});
 }
 if(path==='backup/check'&&request.method==='GET')return json({snapshot:await signature(bucket)});
 if(path==='backup/file'&&request.method==='GET'){
 if(url.searchParams.get('snapshot')!==await signature(bucket))problem('A base mudou durante o backup. Tente novamente.',409);
 const catalog=await records(bucket),record=catalog.find(x=>x.id===url.searchParams.get('id')),field=url.searchParams.get('field');
 if(!['file','signedFile'].includes(field)||!record?.[field])problem('Anexo não encontrado.',404);
 const meta=record[field],asset=record.seeded?assets[meta.key]:null,obj=asset?null:await bucket.get(meta.key);
 if(!asset&&!obj)problem('Anexo ausente. Backup interrompido.',404);
 const bytes=asset?Uint8Array.from(atob(asset.base64),x=>x.charCodeAt(0)):new Uint8Array(await obj.arrayBuffer());
 return new Response(bytes,{headers:{'Content-Type':meta.mime,'Cache-Control':'no-store','X-Backup-SHA256':await digest(bytes)}});
 }
 if(path==='restore/start'&&request.method==='POST'){
 const input=await request.json();validateState(input.state);
 if(input.format!=='cei-admin-complete-backup'||input.version!==2||!Array.isArray(input.archive?.records)||!Array.isArray(input.archive?.files))problem('Selecione um backup completo versão 2.');
 const ids=new Set(),expected=new Set();
 for(const r of input.archive.records){if(!/^[a-f0-9-]{36}$/.test(r.id)||ids.has(r.id))problem('Identificação de documento inválida ou repetida.');ids.add(r.id);for(const field of ['file','signedFile'])if(r[field])expected.add(r.id+':'+field)}
 for(const f of input.archive.files){const key=f.recordId+':'+f.field;if(!expected.delete(key)||!Number.isInteger(f.size)||f.size<1||f.size>20*1024*1024||!/^[a-f0-9]{64}$/.test(f.sha256))problem('Lista de anexos inválida.');delete f.base64}
 if(expected.size)problem('Backup incompleto: faltam anexos.');
 const id=crypto.randomUUID(),job={...input,id,source:await signature(bucket),expires:Date.now()+86400000};
 await raw.put('restore/'+id+'.json',JSON.stringify(job));return json({id,files:job.archive.files.length});
 }
 const match=path.match(/^restore\/([a-f0-9-]{36})\/(file|commit)$/);
 if(match&&request.method==='POST'){
 const jobObj=await raw.get('restore/'+match[1]+'.json');if(!jobObj)problem('Restauração não encontrada.',404);const job=JSON.parse(await jobObj.text());if(job.expires<Date.now())problem('Restauração expirada. Reinicie o envio.');
 const prefix='datasets/'+job.id+'/';
 if(match[2]==='file'){
 const index=Number(url.searchParams.get('index')),meta=job.archive.files[index];if(!Number.isInteger(index)||!meta)problem('Anexo inválido.');
 if(Number(request.headers.get('Content-Length')||0)>20*1024*1024)problem('Anexo acima de 20 MB.',413);
 const bytes=await request.arrayBuffer();if(bytes.byteLength!==meta.size||await digest(bytes)!==meta.sha256)problem('O anexo não corresponde ao backup.');
 await raw.put(prefix+'app/files/'+meta.recordId+'/'+meta.field,bytes,{httpMetadata:{contentType:meta.mime},customMetadata:{sha256:meta.sha256}});return json({uploaded:true});
 }
 return withWriteLock(raw,async()=>{
 const current=await activeBucket(raw);if(await signature(current)!==job.source)problem('A base foi alterada durante o envio. Reinicie a restauração para não perder alterações recentes.',409);
 for(const meta of job.archive.files){const object=await raw.get(prefix+'app/files/'+meta.recordId+'/'+meta.field);if(!object||object.size!==meta.size||await digest(await object.arrayBuffer())!==meta.sha256)problem('Há anexos ausentes ou corrompidos. A base atual foi preservada.');}
 for(const record of job.archive.records){record.seeded=false;for(const field of ['file','signedFile'])if(record[field])record[field].key='app/files/'+record.id+'/'+field;await raw.put(prefix+'app/records/'+record.id+'.json',JSON.stringify(record));}
 job.state.savedAt=new Date().toISOString();await raw.put(prefix+STATE,JSON.stringify(job.state));
 await raw.put(POINTER,JSON.stringify({id:job.id,restoredAt:new Date().toISOString(),previous:current.generation}));
 await raw.delete('restore/'+job.id+'.json');return json({restored:true});
 });
 }
 return json({error:'Operação não encontrada.'},404);
}
