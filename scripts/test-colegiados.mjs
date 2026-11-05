// v48: composição da APP e do Conselho Escolar (chapas com membros, contatos e validade).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-coleg-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {}), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }

await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
assert.deepEqual(await json('/api/portal/colegiados', admin), {app: [], conselho: []});
const chapa = {nome: 'Conselho Escolar — Mandato 2026–2027', inicio: '2026-03-01', fim: '2027-02-28', ata: 'Ata nº 01/2026',
  membros: [{nome: 'Maria Presidente', cargo: 'Presidente', segmento: 'Pais ou responsáveis', telefone: '(47) 99999-0000', email: 'Maria@Example.org'},
    {nome: 'João', cargo: 'Conselheiro(a)', segmento: 'Professores', condicao: 'suplente'}, {nome: '', cargo: 'vazio'}], extra: 'x'};
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'conselho', chapa});
let all = await json('/api/portal/colegiados', admin);
const c = all.conselho[0];
assert.equal(all.conselho.length, 1); assert.equal(c.membros.length, 2, 'linhas sem nome são ignoradas');
assert.equal(c.membros[0].email, 'maria@example.org'); assert.equal(c.membros[1].condicao, 'suplente'); assert.equal(c.extra, undefined);
// edição preserva o id; nova chapa da APP fica separada
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'conselho', chapa: {...chapa, id: c.id, nome: 'Conselho 2026–2027'}});
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'app', chapa: {...chapa, nome: 'Chapa União', inicio: '2024-01-01', fim: '2025-12-31'}});
all = await json('/api/portal/colegiados', admin);
assert.equal(all.conselho.length, 1); assert.equal(all.conselho[0].id, c.id); assert.equal(all.conselho[0].nome, 'Conselho 2026–2027'); assert.equal(all.app.length, 1);
// validações
const bad = async (orgao, ch, msg) => { const r = await call('/api/portal/colegiados', admin, 'POST', {orgao, chapa: ch}); assert.equal(r.status, 400, msg); };
await bad('outro', chapa, 'órgão inválido');
await bad('app', {...chapa, fim: '2025-01-01'}, 'fim antes do início');
await bad('app', {...chapa, inicio: '2026-02-31'}, 'data inexistente');
await bad('app', {...chapa, membros: [{nome: 'X', email: 'semarroba'}]}, 'e-mail inválido');
await bad('app', {...chapa, membros: [{nome: ''}]}, 'sem membros');
// permissões e privacidade
assert.equal((await call('/api/portal/colegiados', teacher)).status, 403);
assert.equal((await call('/api/portal/colegiados', teacher, 'POST', {orgao: 'app', chapa})).status, 403);
assert.equal((await call('/api/portal/colegiados')).status, 403);
const home = JSON.stringify(await json('/api/public/home'));
assert.ok(!home.includes('99999-0000') && !home.includes('maria@example.org'), 'contatos nunca aparecem na página pública');
const tstate = JSON.stringify(await json('/api/data/state', teacher));
assert.ok(!tstate.includes('Maria Presidente'), 'professores não recebem a composição');
// o salvamento da base pela administração não apaga a composição (portal é preservado)
const st = await json('/api/data/state', admin);
await json('/api/data/state', admin, 'PUT', {revision: st.revision, data: {...st.data, portal: {}}});
assert.equal((await json('/api/portal/colegiados', admin)).conselho.length, 1);
// exclusão
await json('/api/portal/colegiados', admin, 'POST', {orgao: 'app', id: all.app[0].id, delete: true});
assert.equal((await json('/api/portal/colegiados', admin)).app.length, 0);
await fs.rm(dir, {recursive: true, force: true});
console.log('PASS: composição da APP e do Conselho (cadastro, edição com mesmo id, órgãos separados, validações de datas/e-mail/membros, só administração, contatos fora da página pública e do espaço docente, preservada ao salvar a base, exclusão).');
