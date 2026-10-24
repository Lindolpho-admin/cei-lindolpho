import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import worker from '../dist/server/index.js';import {DiskBucket} from './disk-bucket.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cei-access-'));const env={BUCKET:new DiskBucket(dir),AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL:'owner@example.org'};const origin='https://cei.test';
async function call(route,user='',method='GET',data){return worker.fetch(new Request(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(user?{'oai-authenticated-user-id':'uid-'+user,'oai-authenticated-user-email':user}: {})},...(data?{body:JSON.stringify(data)}:{})}),env)}
async function json(route,user,method,data){const r=await call(route,user,method,data);assert.equal(r.status,200,await r.clone().text());return r.json()}
const admin='owner@example.org',t='teacher@example.org',other='other@example.org';
try{
 for(const route of ['/restrito','/admin','/docentes','/index.html','/access.html']){
  const anonymous=await call(route);assert.match(anonymous.headers.get('Cache-Control'),/no-store/);assert.equal(anonymous.headers.get('Vary'),'Cookie');
  const authorized=await call(route,admin);assert.match(authorized.headers.get('Cache-Control'),/no-store/);
 }
 const entry=await (await call('/restrito?entrada=2')).text();assert.ok(!entry.includes('location.replace'));assert.match(entry,/return_to=%2Frestrito%3Fentrada%3D2/);
 assert.equal((await call('/')).status,200);assert.equal((await call('/api/data/state')).status,401);assert.equal((await call('/api/storage/export')).status,401);
 assert.equal((await json('/api/session',other)).role,'pending');
 await json('/api/portal/members',admin,'POST',{email:t,name:'Docente Teste',role:'teacher'});await json('/api/portal/members',admin,'POST',{email:other,name:'Outro Docente',role:'teacher'});
 assert.equal((await call('/api/portal/members',t)).status,403);assert.equal((await call('/api/portal/members',t,'POST',{email:t,role:'admin'})).status,403);
 let a=await json('/api/data/state',admin);a.data.generatedDocs.push({id:'private-admin',template:'relatorioAvaliativo',data:{child:'Confidencial'}});await json('/api/data/state',admin,'PUT',a);
 let teacher=await json('/api/data/state',t);assert.equal(teacher.data.generatedDocs.length,0);assert.equal(teacher.data.readers.length,0);assert.equal(teacher.data.books.length,588);
 teacher.data.generatedDocs.push({id:'own-report',template:'relatorioAvaliativo',data:{child:'Teste'}});teacher.data.books=[];teacher.data.loans=[{id:'forged'}];await json('/api/data/state',t,'PUT',teacher);
 a=await json('/api/data/state',admin);assert.equal(a.data.books.length,588);assert.equal(a.data.loans.length,0);assert.equal(a.data.generatedDocs.find(d=>d.id==='own-report').ownerEmail,t);assert.equal(a.data.generatedDocs.length,2);
 assert.equal((await json('/api/data/state',other)).data.generatedDocs.length,0);
 teacher=await json('/api/data/state',t);teacher.data.generatedDocs.push({id:'private-admin',template:'relatorioAvaliativo'});assert.equal((await call('/api/data/state',t,'PUT',teacher)).status,403);
 teacher=await json('/api/data/state',t);teacher.data.generatedDocs.push({id:'bad',template:'oficio'});assert.equal((await call('/api/data/state',t,'PUT',teacher)).status,403);
 assert.equal((await call('/api/app/documents',t)).status,403);assert.equal((await call('/public-app-files/any.pdf')).status,403);
 const book=a.data.books[0];await json('/api/portal/requests',t,'POST',{bookId:book.id});assert.equal((await call('/api/portal/requests',t,'POST',{bookId:book.id})).status,409);
 const requests=await json('/api/portal/requests',admin);assert.equal(requests.length,1);assert.equal((await json('/api/portal/requests',other)).length,0);
 const decision={id:requests[0].id,status:'approved',due:'2099-12-31'};assert.equal((await call('/api/portal/decision',t,'POST',decision)).status,403);await json('/api/portal/decision',admin,'POST',decision);assert.equal((await call('/api/portal/decision',admin,'POST',decision)).status,409);
 teacher=await json('/api/data/state',t);assert.equal(teacher.data.loans.length,1);assert.equal(teacher.data.books[0].unavailable,1);assert.equal((await json('/api/data/state',other)).data.loans.length,0);
 {const f=new FormData();for(const [k,v] of Object.entries({kind:'estatuto',area:'app',date:'2026-03-01',title:'Estatuto da APP'}))f.set(k,v);f.set('file',new File(['%PDF-1.4 estatuto'],'estatuto.pdf',{type:'application/pdf'}));
  const up=await worker.fetch(new Request(origin+'/api/app/arquivo',{method:'POST',headers:{Origin:origin,'oai-authenticated-user-id':'uid-'+admin,'oai-authenticated-user-email':admin},body:f}),env);assert.equal(up.status,201,await up.clone().text());
  const tf=new FormData();for(const [k,v] of Object.entries({kind:'ata',area:'app',date:'2026-03-01',title:'x'}))tf.set(k,v);tf.set('file',new File(['%PDF-1.4'],'x.pdf',{type:'application/pdf'}));
  assert.equal((await worker.fetch(new Request(origin+'/api/app/arquivo',{method:'POST',headers:{Origin:origin,'oai-authenticated-user-id':'uid-'+t,'oai-authenticated-user-email':t},body:tf}),env)).status,403);}
 const publications=await json('/api/portal/publications',admin),doc=publications.records.find(r=>r.file);assert.equal((await call('/api/app/documents/'+doc.id+'/file')).status,403);
 await json('/api/portal/publications',admin,'POST',{id:doc.id,published:true});assert.equal((await json('/api/public/materials')).length,1);assert.equal((await call('/api/app/documents/'+doc.id+'/file')).status,200);
 await json('/api/portal/publications',admin,'POST',{id:doc.id,published:false});assert.equal((await call('/api/app/documents/'+doc.id+'/file')).status,403);
 await json('/api/portal/members',admin,'POST',{email:t,role:'pending'});assert.equal((await call('/api/data/state',t)).status,403);
 const html=await (await call('/restrito',admin)).text();assert.match(html,/window.CEI_SESSION=/);assert.match(html,/owner@example.org/);assert.match(await (await call('/restrito')).text(),/Entrar com ChatGPT/);
 console.log('Passed: anonymous blocking, roles, private document isolation, forbidden mutations, loan approval/duplicate prevention, public opt-in/revocation and account revocation.');
}finally{await fs.rm(dir,{recursive:true,force:true})}
