// v45: atas com dados estruturados (tipo, horário, participantes, pauta, assinaturas, lista de presença).
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import worker from '../dist/server/index.js';import {DiskBucket} from './disk-bucket.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cei-atas-'));const env={BUCKET:new DiskBucket(dir),AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL:'a@x.org'};const O='https://cei.test';
const H={Origin:O,'Content-Type':'application/json','oai-authenticated-user-id':'u','oai-authenticated-user-email':'a@x.org'};
const call=(r,m='GET',b)=>worker.fetch(new Request(O+r,{method:m,headers:H,...(b?{body:JSON.stringify(b)}:{})}),env);
try{
 const meta={tipo:'conselho',numero:'03/2026',inicio:'18:30',fim:'25:99',local:'CEI Lindolpho José da Silva',conduzida:'Maria',secretario:'Joana',participantes:'Maria — Presidente\nJoana — Secretária',pauta:'Item 1\nItem 2',encaminhamentos:'Aprovado',assinantes:[{name:'Maria',role:'Presidente'},{name:'',role:''},...Array(20).fill({name:'X',role:'Y'})],listaPresenca:true,abertura:false,extra:'<script>'};
 let r=await call('/api/app/documents','POST',{central:true,area:'conselho',kind:'ata',date:'2026-10-20',title:'Ata nº 03/2026',body:'<p>Texto</p>',meta});assert.equal(r.status,201);const ata=await r.json();
 assert.equal(ata.meta.tipo,'conselho');assert.equal(ata.meta.inicio,'18:30');assert.equal(ata.meta.fim,'');assert.equal(ata.meta.assinantes.length,12);assert.equal(ata.meta.listaPresenca,true);assert.equal(ata.meta.abertura,false);assert.ok(!('extra' in ata.meta));
 r=await call('/api/app/documents','POST',{central:true,area:'outros',kind:'ata',date:'2026-10-20',title:'x',body:'<p>t</p>',meta:{tipo:'invalido'}});assert.equal((await r.json()).meta.tipo,'outra');
 r=await call('/api/app/documents/'+ata.id,'PUT',{central:true,area:'conselho',kind:'ata',date:'2026-10-21',title:'Ata nº 03/2026 rev',meta:{...meta,pauta:'Novo item'}});const ed=await r.json();
 assert.equal(ed.id,ata.id);assert.equal(ed.body,'<p>Texto</p>');assert.equal(ed.meta.pauta,'Novo item');
 r=await call('/api/app/documents/'+ata.id,'PUT',{central:true,area:'conselho',kind:'ata',date:'2026-10-21',title:'sem meta'});assert.equal((await r.json()).meta.pauta,'Novo item','meta preservada quando não enviada');
 const list=await (await call('/api/app/documents')).json();assert.equal(list.find(x=>x.id===ata.id).meta.numero,'03/2026');
 const backup=await (await call('/api/storage/backup')).json();assert.equal(backup.archive.records.find(x=>x.id===ata.id).meta.tipo,'conselho');
 console.log('PASS: atas com tipo, número, horário validado, participantes, pauta, encaminhamentos, assinaturas (limite 12), lista de presença e abertura; campos desconhecidos descartados; edição preserva ID/texto; dados no backup.');
}finally{await fs.rm(dir,{recursive:true,force:true})}
