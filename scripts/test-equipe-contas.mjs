// v51: equipe da instituição, fotos 3x4, composição pública dos colegiados e prestação de contas pública.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-equipe-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const call = (route, user = '', method = 'GET', body, type) => worker.fetch(new Request(origin + route, {method, headers: {Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {}), ...(type ? {'Content-Type': type} : body && !(body instanceof FormData) ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: body instanceof FormData || body instanceof Uint8Array ? body : JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200, type) { const r = await call(route, user, method, body, type); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
const form = fields => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, typeof v === 'object' ? JSON.stringify(v) : v); return f; };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const hoje = new Date().toISOString().slice(0, 10), ano = hoje.slice(0, 4);

await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
// fotos: só administração, só JPEG/PNG de verdade
assert.equal((await call('/api/portal/foto', teacher, 'POST', jpeg, 'image/jpeg')).status, 403);
assert.equal((await call('/api/portal/foto', admin, 'POST', new TextEncoder().encode('<svg onload=x>'), 'image/jpeg')).status, 400);
const f1 = (await json('/api/portal/foto', admin, 'POST', jpeg, 200, 'image/jpeg')).id, f2 = (await json('/api/portal/foto', admin, 'POST', jpeg, 200, 'image/jpeg')).id;
// equipe: importação sem duplicar, edição, pessoa oculta
await json('/api/portal/equipe', admin, 'POST', {importar: [{nome: 'Ana Souza', funcao: 'Professor(a) de Educação Infantil', categoria: 'professores', vinculo: 'ACT'}, {nome: 'Rosa Lina', funcao: 'Servente', categoria: 'apoio', vinculo: 'Efetivo'}]});
await json('/api/portal/equipe', admin, 'POST', {importar: [{nome: 'ANA SOUZA', funcao: 'x', categoria: 'professores'}]});
let eq = await json('/api/portal/equipe', admin);
assert.equal(eq.length, 2, 'importação não duplica pelo nome');
const ana = eq.find(e => e.nome === 'Ana Souza');
await json('/api/portal/equipe', admin, 'POST', {pessoa: {...ana, foto: f1, telefone: '(47) 99999-0000', email: 'ana@example.org'}});
await json('/api/portal/equipe', admin, 'POST', {pessoa: {nome: 'Pessoa Oculta', funcao: 'Apoio', categoria: 'apoio', publico: false}});
assert.equal((await call('/api/portal/equipe', admin, 'POST', {pessoa: {nome: 'Sem função'}})).status, 400);
assert.equal((await call('/api/portal/equipe', teacher)).status, 403);
// colegiado com foto própria e outro membro herdando a foto da equipe
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'conselho', chapa: {nome: 'Conselho Atual', inicio: `${ano}-01-01`, fim: `${Number(ano) + 1}-12-31`, membros: [{nome: 'Ana Souza', cargo: 'Conselheira', telefone: '(47) 98888-7777'}, {nome: 'João Pai', cargo: 'Presidente', foto: f2, email: 'joao@example.org'}]}});
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'app', chapa: {nome: 'APP oculta', publico: false, inicio: `${ano}-01-01`, fim: `${Number(ano) + 1}-12-31`, membros: [{nome: 'Fulano'}]}});
// financeiro + prestação de contas
await json('/api/app/arquivo', admin, 'POST', form({kind: 'lancamento', area: 'financeiro', date: `${ano}-01-01`, title: 'Saldo inicial', fin: {account: 'SICOOB', move: 'saldo_inicial', amount: 100000}}), 201);
await json('/api/app/arquivo', admin, 'POST', form({kind: 'repasse', area: 'app', date: `${ano}-03-10`, title: 'Festa junina', notes: 'NOTA INTERNA', fin: {account: 'SICOOB', move: 'entrada', amount: 250000, category: 'Evento / festa / rifa'}}), 201);
await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'app', date: `${ano}-04-02`, title: 'Brinquedos do parque', fin: {account: 'SICOOB', move: 'saida', amount: 120000, category: 'Material pedagógico', supplier: 'Loja Exemplo Ltda', docNumber: '123'}}), 201);
await json('/api/app/arquivo', admin, 'POST', form({kind: 'nota_fiscal', area: 'financeiro', date: `${ano}-05-02`, title: 'PDDE compra', fin: {account: 'PDDE_Basico', move: 'saida', amount: 5000, nature: 'custeio'}}), 201);
let home = await json('/api/public/home');
assert.equal(home.contas, null, 'nenhuma conta publicada por padrão');
assert.equal((await call('/api/portal/transparencia', teacher, 'POST', {contas: ['SICOOB']})).status, 403);
await json('/api/portal/transparencia', admin, 'POST', {contas: ['SICOOB', 'INVALIDA'], detalhar: true});
home = await json('/api/public/home');
const txt = JSON.stringify(home);
// equipe pública: só nome, função, categoria, atuação, foto
assert.deepEqual(home.equipe.map(e => e.nome).sort(), ['Ana Souza', 'Rosa Lina']);
assert.deepEqual(Object.keys(home.equipe[0]).sort(), ['atuacao', 'categoria', 'foto', 'funcao', 'id', 'nome']);
for (const s of ['99999-0000', 'ana@example.org', '98888-7777', 'joao@example.org', 'ACT', 'Efetivo', 'Pessoa Oculta', 'APP oculta', 'NOTA INTERNA', 'PDDE compra']) assert.ok(!txt.includes(s), 'não pode vazar: ' + s);
assert.equal(home.colegiados.conselho.membros.find(m => m.nome === 'Ana Souza').foto, f1, 'membro herda a foto da equipe');
assert.equal(home.colegiados.conselho.membros.find(m => m.nome === 'João Pai').foto, f2);
assert.equal(home.colegiados.app, undefined, 'composição marcada como não pública fica fora');
const c = home.contas.contas; assert.deepEqual(c.map(x => x.conta), ['SICOOB']);
const a = c[0].anos[0]; assert.equal(a.saldoInicial, 100000); assert.equal(a.entradas, 250000); assert.equal(a.saidas, 120000); assert.equal(a.saldo, 230000);
assert.deepEqual(a.porCategoria, [{categoria: 'Material pedagógico', valor: 120000}]);
assert.equal(a.lancamentos.length, 3); assert.equal(a.lancamentos[2].fornecedor, 'Loja Exemplo Ltda');
await json('/api/portal/transparencia', admin, 'POST', {contas: ['SICOOB'], detalhar: false});
assert.equal((await json('/api/public/home')).contas.contas[0].anos[0].lancamentos, undefined, 'sem detalhamento quando desmarcado');
// fotos públicas só quando referenciadas por algo público
assert.equal((await call('/api/public/foto/' + f1)).status, 200);
const solta = (await json('/api/portal/foto', admin, 'POST', jpeg, 200, 'image/jpeg')).id;
assert.equal((await call('/api/public/foto/' + solta)).status, 404, 'foto não usada não é pública');
assert.equal((await call('/api/portal/foto/' + solta, admin)).status, 200);
assert.equal((await call('/api/portal/foto/' + solta, teacher)).status, 404);
// ao ocultar a pessoa, a foto deixa de ser pública; ao excluir, a foto é apagada
await json('/api/portal/equipe', admin, 'POST', {pessoa: {...ana, foto: f1, publico: false}});
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'conselho', chapa: {...home.colegiados.conselho, id: (await json('/api/portal/colegiados', admin)).conselho[0].id, membros: [{nome: 'João Pai', cargo: 'Presidente', foto: f2}]}});
assert.equal((await call('/api/public/foto/' + f1)).status, 404);
await json('/api/portal/equipe', admin, 'POST', {id: ana.id, delete: true});
assert.equal((await call('/api/portal/foto/' + f1, admin)).status, 404, 'foto apagada junto com a pessoa');
// backup inclui as fotos
const bk = await json('/api/storage/backup', admin);
assert.ok(bk.fotos.some(f => f.id === f2 && f.mime === 'image/jpeg' && f.base64));
await fs.rm(dir, {recursive: true, force: true});
console.log('PASS: equipe (importação sem duplicar, oculta, validação), fotos 3x4 (só admin, só imagem real, públicas só se usadas, apagadas ao sair, no backup), colegiados públicos sem contatos e com foto herdada, prestação de contas (desligada por padrão, só contas marcadas, totais, categorias, detalhamento opcional, sem notas internas).');
