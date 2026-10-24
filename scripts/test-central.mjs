// v39: Arquivo central, lançamentos financeiros, atas redigidas, papel timbrado docente e cálculo de saldos.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-central-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org', other = 'outra@example.org';
const headers = user => ({Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {})});
const call = (route, user = admin, method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {...headers(user), ...(body && !(body instanceof FormData) ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: body instanceof FormData ? body : JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
const form = (fields, file) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, typeof v === 'object' ? JSON.stringify(v) : v); if (file) f.set('file', new File([file], 'doc.pdf', {type: 'application/pdf'})); return f; };

try {
  await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
  await json('/api/portal/members', admin, 'POST', {email: other, role: 'teacher', name: 'Outra'});
  // Envio com tipo, pasta e processo
  const orc = await json('/api/app/arquivo', admin, 'POST', form({kind: 'orcamento', area: 'compras', date: '2026-08-20', title: 'Orçamento A', processo: 'Ventiladores'}, '%PDF-1.4 a'), 201);
  assert.equal(orc.central, true); assert.equal(orc.area, 'compras'); assert.match(orc.file.name, /^2026_08_20_Compras_Orcamento_Orcamento_A\.pdf$/);
  // Nota fiscal com lançamento
  const nf = await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: '2026-09-10', title: 'NF 10', processo: 'Ventiladores', fin: {account: 'PDDE_Basico', move: 'saida', amount: 90000, nature: 'capital', category: 'Material permanente / equipamento', supplier: 'Loja'}}, '%PDF-1.4 nf'), 201);
  assert.equal(nf.fin.amount, 90000); assert.equal(nf.program, 'PDDE_Basico');
  // Lançamentos sem arquivo
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'repasse', area: 'financeiro', date: '2026-05-02', title: 'Repasse capital', fin: {account: 'PDDE_Basico', move: 'entrada', amount: 500000, nature: 'capital'}}), 201);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'repasse', area: 'financeiro', date: '2026-05-02', title: 'Repasse custeio', fin: {account: 'PDDE_Basico', move: 'entrada', amount: 300000, nature: 'custeio'}}), 201);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'lancamento', area: 'financeiro', date: '2026-01-01', title: 'Saldo inicial', fin: {account: 'PDDE_Basico', move: 'saldo_inicial', amount: 10000, nature: 'custeio'}}), 201);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'extrato', area: 'financeiro', date: '2026-09-30', title: 'Extrato CC', fin: {account: 'PDDE_Basico', move: 'saldo_extrato', amount: 720000, statementType: 'conta_corrente'}}, '%PDF ex'), 201);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'extrato', area: 'financeiro', date: '2026-09-30', title: 'Extrato aplicação', fin: {account: 'PDDE_Basico', move: 'saldo_extrato', amount: 1000, statementType: 'investimentos'}}, '%PDF ap'), 201);
  // Validações
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: '2026-09-10', title: 'Sem arquivo'}), 400);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: '2026-09-10', title: 'Negativo', fin: {account: 'SICOOB', move: 'saida', amount: -10}}), 400);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'inexistente', date: '2026-09-10', title: 'x'}, '%PDF'), 400);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: '2026-02-31', title: 'x'}, '%PDF'), 400);
  await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: '2026-09-10', title: 'Conta falsa', fin: {account: 'XYZ', move: 'saida', amount: 10}}), 400);
  // Docentes e contas não cadastradas não acessam o arquivo
  await json('/api/app/arquivo', teacher, 'POST', form({kind: 'ata', area: 'app', date: '2026-03-01', title: 'x'}, '%PDF'), 403);
  assert.equal((await call('/api/app/documents', teacher)).status, 403);
  assert.equal((await call('/api/app/documents', 'ninguem@example.org')).status, 403);
  assert.equal((await call('/api/app/documents/' + nf.id + '/file', teacher)).status, 403);
  // Ata redigida no arquivo central, edição preserva ID e texto, anexo assinado
  const ata = await json('/api/app/documents', admin, 'POST', {central: true, area: 'conselho', kind: 'ata', date: '2026-10-01', title: 'Ata 03/2026', body: '<p>Texto</p>', presentes: 'Fulano'}, 201);
  assert.equal(ata.typed, true); assert.equal(ata.body, '<p>Texto</p>');
  const ata2 = await json('/api/app/documents/' + ata.id, admin, 'PUT', {central: true, area: 'conselho', kind: 'ata', date: '2026-10-02', title: 'Ata 03/2026 revisada', processo: 'Mandato 2026'});
  assert.equal(ata2.id, ata.id); assert.equal(ata2.body, '<p>Texto</p>'); assert.equal(ata2.date, '2026-10-02');
  await json('/api/app/documents/' + ata.id, admin, 'PUT', {central: true, area: 'conselho', kind: 'nota_fiscal', date: '2026-10-02', title: 'x'}, 400);
  await json('/api/app/documents', admin, 'POST', {central: true, area: 'compras', kind: 'orcamento', date: '2026-10-01', title: 'x', body: 'y'}, 400);
  const signed = new FormData(); signed.set('file', new File(['%PDF-1.4 assinado'], 'a.pdf', {type: 'application/pdf'}));
  assert.equal((await call('/api/app/documents/' + orc.id + '/signed', admin, 'POST', signed)).status, 200);
  // Ata antiga (formato APP) convertida para o arquivo central
  const legacy = await json('/api/app/documents', admin, 'POST', {kind: 'ata', date: '2025-05-05', title: 'Ata APP antiga', body: 'Texto simples'}, 201);
  const converted = await json('/api/app/documents/' + legacy.id, admin, 'PUT', {central: true, area: 'app', kind: 'ata', date: '2025-05-05', title: 'Ata APP antiga'});
  assert.equal(converted.central, true); assert.equal(converted.body, 'Texto simples');
  // Edição de metadados financeiros
  const nf2 = await json('/api/app/documents/' + nf.id, admin, 'PUT', {central: true, area: 'financeiro', kind: 'nota_fiscal', date: '2026-09-10', title: 'NF 10', processo: 'Ventiladores', fin: {account: 'PDDE_Basico', move: 'saida', amount: 80000, nature: 'capital'}});
  assert.equal(nf2.fin.amount, 80000); assert.ok(nf2.file);
  // Publicação explícita de um documento do arquivo
  await json('/api/portal/publications', admin, 'POST', {id: orc.id, published: true});
  assert.equal((await json('/api/public/materials', '')).length, 1);
  assert.equal((await call('/api/app/documents/' + orc.id + '/file', '')).status, 200);
  assert.equal((await call('/api/app/documents/' + nf.id + '/file', '')).status, 403);

  // Papel timbrado do docente: grava no estado, com dono, invisível para outro docente
  let t = await json('/api/data/state', teacher);
  t.data.generatedDocs.push({id: 'timb-1', template: 'documentoTimbrado', name: 'Bilhete', data: {model: 'bilhete', title: 'Bilhete', bodyHtml: '<p>Oi</p>', date: '2026-10-23'}});
  await json('/api/data/state', teacher, 'PUT', t);
  const a = await json('/api/data/state', admin);
  assert.equal(a.data.generatedDocs.find(d => d.id === 'timb-1').ownerEmail, teacher);
  assert.equal((await json('/api/data/state', other)).data.generatedDocs.length, 0);
  t = await json('/api/data/state', other); t.data.generatedDocs.push({id: 'timb-1', template: 'documentoTimbrado', data: {}});
  assert.equal((await call('/api/data/state', other, 'PUT', t)).status, 403);

  // Cálculo de saldos (mesma função usada na tela Financeiro)
  const records = await json('/api/app/documents', admin);
  const source = await fs.readFile('dist/central.js', 'utf8');
  const win = {CEI_SESSION: {role: 'admin', email: admin}};
  const ctx = vm.createContext({window: win, state: {}, titles: {}, render() {}, document: {readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelectorAll: () => []}, setTimeout() {}, Intl, Date, Math, JSON, Number, String, Object, Array, Set, Map, crypto: globalThis.crypto, localStorage: {getItem: () => null}});
  vm.runInContext(source, ctx);
  const fin = win.cxFinanceCalc('2026', records);
  const pdde = fin.accounts.find(x => x.account === 'PDDE_Basico');
  assert.equal(pdde.initial, 10000); assert.equal(pdde.inflow, 800000); assert.equal(pdde.outflow, 80000);
  assert.equal(pdde.balance, 730000);
  assert.equal(pdde.nat.capital, 420000); assert.equal(pdde.nat.custeio, 310000);
  assert.equal(pdde.recon.bank, 721000); assert.equal(pdde.recon.diff, 9000); assert.deepEqual([...pdde.recon.types].sort(), ['conta_corrente', 'investimentos']);
  assert.equal(fin.accounts.find(x => x.account === 'SICOOB').count, 0);
  // Backup completo inclui os registros do arquivo central e os anexos
  const backup = await json('/api/storage/backup', admin);
  assert.ok(backup.archive.records.some(r => r.id === nf.id && r.fin.amount === 80000));
  assert.equal(backup.archive.files.filter(f => f.recordId === orc.id).length, 2);
  console.log('PASS: arquivo central (envio com tipo/pasta/processo, validações, permissões), lançamentos financeiros, atas redigidas e convertidas, anexo assinado, publicação explícita, papel timbrado docente isolado, cálculo de saldos (custeio/capital, conferência com extrato corrente + aplicação) e backup.');
} finally { await fs.rm(dir, {recursive: true, force: true}); }
