// v61: banco de horas (servidor), certificado de conclusão e lista de espera (telas).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {minutosBanco} from '../dist/server/access.js';
import {DiskBucket} from './disk-bucket.mjs';
// Cálculo: positivo = o CEI deve à pessoa; negativo = a pessoa deve ao CEI.
assert.equal(minutosBanco({tipo: 'entrada', escala: '07:30', real: '07:00'}), 30, 'chegou antes: ganha');
assert.equal(minutosBanco({tipo: 'entrada', escala: '07:30', real: '08:15'}), -45, 'atrasou: perde');
assert.equal(minutosBanco({tipo: 'saida', escala: '17:00', real: '18:30'}), 90, 'saiu depois: ganha');
assert.equal(minutosBanco({tipo: 'saida', escala: '17:00', real: '16:00'}), -60, 'saiu mais cedo: perde');
assert.equal(minutosBanco({tipo: 'saida_rapida', inicio: '09:00', fim: '10:30'}), -90, 'saída rápida: perde');
assert.equal(minutosBanco({tipo: 'saida_rapida', inicio: '09:00', fim: '10:30', abonado: true}), 0, 'saída abonada não desconta');
assert.equal(minutosBanco({tipo: 'saida_rapida', inicio: '10:30', fim: '09:00'}), null, 'volta antes da saída é inválida');
assert.equal(minutosBanco({tipo: 'extra', inicio: '18:00', fim: '21:00'}), 180);
assert.equal(minutosBanco({tipo: 'compensacao', inicio: '17:00', fim: '17:45', sentido: '+'}), 45, 'pessoa repôs: soma');
assert.equal(minutosBanco({tipo: 'compensacao', duracao: '8', sentido: '-'}), -480, 'CEI deu folga: retira');
assert.equal(minutosBanco({tipo: 'ajuste', duracao: '12:30', sentido: '+'}), 750);
assert.equal(minutosBanco({tipo: 'entrada', escala: '7:30', real: '07:00'}), null, 'horário mal escrito');

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-banco-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {}), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
await json('/api/portal/equipe', admin, 'POST', {importar: [{nome: 'Ana Paula Souza', funcao: 'Professora', categoria: 'professores'}, {nome: 'Bruna Lima', funcao: 'Professora', categoria: 'professores'}]});
const eq = await json('/api/portal/equipe', admin), ana = eq.find(e => e.nome.startsWith('Ana')).id, bruna = eq.find(e => e.nome.startsWith('Bruna')).id;
// Acesso: só a administração.
assert.equal((await call('/api/portal/banco-horas')).status, 403, 'anônimo');
assert.equal((await call('/api/portal/banco-horas', teacher)).status, 403, 'professor não vê o banco de ninguém');
assert.equal((await call('/api/portal/banco-horas', teacher, 'POST', {registro: {pessoaId: ana, data: '2026-11-10', tipo: 'extra', inicio: '18:00', fim: '19:00'}})).status, 403);
// Escala.
await json('/api/portal/banco-horas', admin, 'POST', {escala: {pessoaId: ana, entrada: '07:30', saida: '17:00', obs: '40 h'}});
assert.equal((await call('/api/portal/banco-horas', admin, 'POST', {escala: {pessoaId: ana, entrada: '17:00', saida: '07:30'}})).status, 400, 'saída antes da entrada');
assert.equal((await call('/api/portal/banco-horas', admin, 'POST', {escala: {pessoaId: 'x', entrada: '07:30'}})).status, 400);
// Registros.
const reg = r => json('/api/portal/banco-horas', admin, 'POST', {registro: r});
await reg({pessoaId: ana, data: '2026-11-10', tipo: 'saida', escala: '17:00', real: '18:30', obs: 'Reunião com famílias', minutos: -9999});
await reg({pessoaId: ana, data: '2026-11-12', tipo: 'saida_rapida', inicio: '09:00', fim: '10:00', motivo: 'consulta'});
await reg({pessoaId: bruna, data: '2026-11-11', tipo: 'entrada', escala: '07:30', real: '08:15'});
await reg({pessoaId: bruna, data: '2026-11-14', tipo: 'compensacao', inicio: '17:00', fim: '17:45', sentido: '+'});
for (const [bad, msg] of [[{pessoaId: 'nao-existe', data: '2026-11-10', tipo: 'extra', inicio: '18:00', fim: '19:00'}, 'pessoa fora da equipe'], [{pessoaId: ana, data: '10/11/2026', tipo: 'extra', inicio: '18:00', fim: '19:00'}, 'data'], [{pessoaId: ana, data: '2026-11-10', tipo: 'xyz'}, 'tipo'],
  [{pessoaId: ana, data: '2026-11-10', tipo: 'saida', escala: '17:00'}, 'sem horário real'], [{pessoaId: ana, data: '2026-11-10', tipo: 'ajuste', duracao: '4', sentido: '+'}, 'ajuste sem explicação'], [{pessoaId: ana, data: '2026-11-10', tipo: 'saida', escala: '00:00', real: '23:59'}, 'diferença absurda']])
  assert.equal((await call('/api/portal/banco-horas', admin, 'POST', {registro: bad})).status, 400, msg);
let d = await json('/api/portal/banco-horas', admin);
const saldo = id => d.registros.filter(r => r.pessoaId === id).reduce((s, r) => s + r.minutos, 0);
assert.equal(d.registros.length, 4); assert.equal(saldo(ana), 30, 'Ana: +1h30 −1h'); assert.equal(saldo(bruna), 0, 'Bruna: −45 + 45');
assert.deepEqual(d.escalas[ana], {entrada: '07:30', saida: '17:00', obs: '40 h'});
const r1 = d.registros.find(r => r.tipo === 'saida');
assert.equal(r1.minutos, 90, 'o servidor recalcula (ignora minutos enviados)'); assert.equal(r1.pessoaNome, 'Ana Paula Souza'); assert.equal(r1.por, admin);
// Editar e excluir.
await reg({...r1, real: '17:30'}); d = await json('/api/portal/banco-horas', admin); assert.equal(saldo(ana), -30); assert.equal(d.registros.length, 4);
await json('/api/portal/banco-horas', admin, 'POST', {id: r1.id, delete: true}); d = await json('/api/portal/banco-horas', admin); assert.equal(saldo(ana), -60);
// Quem sai da equipe mantém o histórico.
await json('/api/portal/equipe', admin, 'POST', {id: bruna, delete: true}); d = await json('/api/portal/banco-horas', admin);
assert.equal(d.registros.filter(r => r.pessoaId === bruna).length, 2);
// Nada disso aparece na página pública.
const pub = JSON.stringify(await json('/api/public/home'));
assert.ok(!pub.includes('banco') && !pub.includes('08:15') && !pub.includes('Reunião com famílias'));
await fs.rm(dir, {recursive: true, force: true});

// Telas: funções chamadas em onclick existem em window.
const central = await fs.readFile('dist/central.js', 'utf8'), app = await fs.readFile('dist/app.js', 'utf8');
for (const f of ['cxBhForm', 'cxBhNovo', 'cxBhSalvar', 'cxBhCancelar', 'cxBhDel', 'cxBhEscala', 'cxBhEscSalvar', 'cxBhExtrato', 'cxBhFecharExtrato', 'cxBhAba', 'cxBhFiltro', 'cxBhTipo', 'cxBhPrev', 'cxBhPessoaMudou', 'cxBhImprimirExtrato', 'cxBhImprimirLista'])
  assert.match(central, new RegExp(`window\\.${f} = `), f);
for (const f of ['certAddSigner', 'certRemoverSigner', 'certMoverSigner', 'certNomeMudou', 'setWaitEtapa', 'waitBuscar', 'limparWaitFiltros', 'openWaitModal', 'saveWaitRecord', 'deleteWaitRecord', 'openHistoryModal', 'waitSitMudou', 'deleteWaitHistory', 'addWaitHistory'])
  assert.match(app, new RegExp(`window\\.${f}=`), f);
assert.match(app, /certificado:\{icon:'🎓'/); assert.match(app, /openDocGen\('certificado'\)/);
// O certificado guarda quem assinou para o próximo; sobrescrever reopenGenerated só depois de ele existir.
assert.ok(app.indexOf('const _reopenGeneratedBase=window.reopenGenerated') > app.indexOf('window.reopenGenerated=id=>{const g='));
assert.match(app, /function today\(\)\{return new Date\(\)\.toLocaleDateString\('en-CA',\{timeZone:'America\/Sao_Paulo'\}\)\}/);
await fs.access('dist/certificado-logo.png');
console.log('PASS: banco de horas (cálculo de ganhos e perdas, saídas rápidas, abono, pagamentos, só administração, servidor recalcula, histórico preservado) + telas do certificado e da lista de espera.');
