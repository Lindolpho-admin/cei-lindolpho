import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'cei-host-test-'));
const origin='https://cei.example',env={AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL:'test-admin@example.org',BUCKET:new DiskBucket(path.join(directory,'first'))};
globalThis.fetch=()=>{throw Error('No external storage calls permitted')};
const req=(route,method='GET',body,headers={})=>new Request(origin+route,{method,headers:{'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'test-admin@example.org',...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})});
const call=(route,method,body,environment=env,headers)=>worker.fetch(req(route,method,body,headers),environment);
async function json(route,method,body,environment=env){const response=await call(route,method,body,environment);assert.equal(response.status,200,await response.clone().text());return response.json()}
try{
 const initial=await json('/api/data/state');assert.equal(initial.data.books.length,588);
 const a=structuredClone(initial.data);a.books.push({id:'test-book',title:'Compartilhado'});a.generatedDocs.push({id:'test-doc',title:'Termo',values:{name:'Teste'}});
 await json('/api/data/state','PUT',{revision:initial.revision,data:a});
 const b=await json('/api/data/state');assert.equal(b.data.books.at(-1).title,'Compartilhado');assert.equal(b.data.generatedDocs.length,1);
 assert.equal((await call('/api/data/state','PUT',{revision:initial.revision,data:initial.data})).status,409);
 assert.equal((await call('/api/data/state','PUT',{revision:b.revision,data:a},env,{Origin:'https://other.example'})).status,403);
 assert.equal((await json('/api/app/me')).canEdit,true);
 const ataResponse=await call('/api/app/documents','POST',{kind:'ata',date:'2026-10-01',title:'Ata de teste',body:'Texto da reunião'});assert.equal(ataResponse.status,201);const ata=await ataResponse.json();
 const signed=new FormData();signed.set('file',new File(['%PDF-1.4 teste'], 'assinado.pdf',{type:'application/pdf'}));
 assert.equal((await worker.fetch(new Request(origin+'/api/app/documents/'+ata.id+'/signed',{method:'POST',headers:{Origin:origin,'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'test-admin@example.org'},body:signed}),env)).status,200);
 const photos=new FormData();photos.set('documentId','food-restore-test');photos.set('file',new File([new Uint8Array([255,216,255,224,0,0])],'foto.jpg',{type:'image/jpeg'}));
 const photoResponse=await worker.fetch(new Request(origin+'/api/app/document-photos',{method:'POST',headers:{Origin:origin,'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'test-admin@example.org'},body:photos}),env);assert.equal(photoResponse.status,201);const photo=await photoResponse.json();
 await json('/api/portal/members','POST',{email:'docente@example.org',role:'teacher',name:'Docente'});
 const central=new FormData();for(const [k,v] of Object.entries({kind:'nota_fiscal',area:'financeiro',date:'2026-09-10',title:'NF teste',processo:'Compra teste',fin:JSON.stringify({account:'PDDE_Basico',move:'saida',amount:12345,nature:'capital',category:'Material permanente / equipamento'})}))central.set(k,v);central.set('file',new File(['%PDF-1.4 nota'],'nota.pdf',{type:'application/pdf'}));
 const centralResponse=await worker.fetch(new Request(origin+'/api/app/arquivo',{method:'POST',headers:{Origin:origin,'oai-authenticated-user-id':'test-admin','oai-authenticated-user-email':'test-admin@example.org'},body:central}),env);assert.equal(centralResponse.status,201,await centralResponse.clone().text());
 const backup=await json('/api/storage/backup');assert.equal(backup.archive.records.length,3);assert.equal(backup.archive.files.length,3);
 for(const file of backup.archive.files){const response=await call('/api/storage/backup/file?'+new URLSearchParams({snapshot:backup.snapshot,id:file.recordId,field:file.field}));assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());file.base64=bytes.toString('base64');file.sha256=response.headers.get('X-Backup-SHA256');assert.equal(bytes.length,file.size)}
 assert.equal((await json('/api/storage/backup/check')).snapshot,backup.snapshot);
 const target={AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL:'test-admin@example.org',BUCKET:new DiskBucket(path.join(directory,'restored'))};await json('/api/data/state',undefined,undefined,target);
 const manifest=structuredClone(backup);manifest.archive.files.forEach(f=>delete f.base64);
 const bad=structuredClone(manifest);bad.archive.files.pop();assert.equal((await call('/api/storage/restore/start','POST',bad,target)).status,400);
 const job=await json('/api/storage/restore/start','POST',manifest,target);
 assert.equal((await call('/api/storage/restore/'+job.id+'/commit','POST',{},target)).status,400);
 for(let i=0;i<backup.archive.files.length;i++)await json('/api/storage/restore/'+job.id+'/file?index='+i,'POST',Buffer.from(backup.archive.files[i].base64,'base64'),target);
 await json('/api/storage/restore/'+job.id+'/commit','POST',{},target);
 const restored=await json('/api/data/state',undefined,undefined,target);assert.deepEqual(restored.data.books,b.data.books);assert.deepEqual(restored.data.generatedDocs,b.data.generatedDocs);assert.deepEqual(restored.data.portal,backup.state.portal);
 const docs=await json('/api/app/documents',undefined,undefined,target);assert.equal(docs.length,2);assert.equal(docs.find(x=>x.central).fin.amount,12345);assert.ok(!docs.some(x=>x.id===photo.id));
 for(const meta of backup.archive.files){const response=await call('/api/app/documents/'+meta.recordId+'/file'+(meta.field==='signedFile'?'?signed=1':''),'GET',undefined,target);assert.equal(response.status,200);assert.equal(Buffer.from(await response.arrayBuffer()).toString('base64'),meta.base64)}
 const reopened={AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL:'test-admin@example.org',BUCKET:new DiskBucket(path.join(directory,'restored'))};assert.equal((await json('/api/data/state',undefined,undefined,reopened)).revision,restored.revision);
 assert.equal((await call('/api/data/state','PUT',{revision:initial.revision,data:initial.data},target)).status,409);
 const concurrent=await json('/api/storage/restore/start','POST',manifest,target);const changed=structuredClone(restored.data);changed.readers.push({id:'new-reader',name:'Outra pessoa'});await json('/api/data/state','PUT',{revision:restored.revision,data:changed},target);assert.equal((await call('/api/storage/restore/'+concurrent.id+'/commit','POST',{},target)).status,409);
 // Verify client three-way merge preserves disjoint edits, additions and deletions.
 const source=await fs.readFile('dist/app.js','utf8');const fn=source.slice(source.indexOf('function mergeShared('),source.indexOf('function queueSharedSave('));
 const context=vm.createContext({Date,JSON,Map,Set,Error,sharedCollections:['books']});vm.runInContext(fn,context);
 const base={books:[{id:'a',title:'A'},{id:'b',title:'B'}],settings:{textCase:'title'}},local=structuredClone(base),remote=structuredClone(base);local.books[0].title='A2';remote.books[1].title='B2';const merged=context.mergeShared(base,local,remote);assert.equal(merged.books[0].title,'A2');assert.equal(merged.books[1].title,'B2');remote.books[0].title='A3';assert.throws(()=>context.mergeShared(base,local,remote));
 console.log('PASS: authorized administrative CRUD, stale-write protection, origin checks, 588 initial books, 3 attachments (finance note, signed minute and a form photograph) backed up and restored byte-for-byte, invalid/incomplete backup rejected, concurrent restore blocked, disk restart persistence, client merge conflict protection; no Google calls.');
}finally{await fs.rm(directory,{recursive:true,force:true})}
