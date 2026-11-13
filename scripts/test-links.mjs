// v60: links úteis (cadastro pela administração; exibição na área restrita, no Espaço do Professor e na página pública).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-links-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {}), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
assert.deepEqual((await json('/api/public/home')).links, [], 'sem links, nada público');
assert.equal((await call('/api/portal/links')).status, 403, 'anônimo não lê a lista interna');
// Cadastro: só a administração.
assert.equal((await call('/api/portal/links', teacher, 'POST', {link: {titulo: 'X', url: 'https://x.com'}})).status, 403);
await json('/api/portal/links', admin, 'POST', {link: {titulo: 'Ponto eletrônico', url: 'ponto.araquari.sc.gov.br', icone: 'relogio', cor: 'verde', descricao: 'Registro de frequência', professores: true}});
await json('/api/portal/links', admin, 'POST', {link: {titulo: 'Portal da Prefeitura', url: 'https://www.araquari.sc.gov.br', icone: 'predio', cor: 'roxo', professores: true, publico: true, extra: 'x'}});
await json('/api/portal/links', admin, 'POST', {link: {titulo: 'Contabilidade da APP', url: 'contato@exemplo.org', icone: 'nada que exista!', cor: '#ff0000'}});
for (const [bad, msg] of [[{titulo: 'A', url: 'javascript:alert(1)'}, 'javascript:'], [{titulo: 'A', url: 'data:text/html,x'}, 'data:'], [{titulo: '', url: 'https://a.com'}, 'sem nome'], [{titulo: 'A', url: ''}, 'sem endereço'], [{titulo: 'A', url: 'abc'}, 'sem domínio']])
  assert.equal((await call('/api/portal/links', admin, 'POST', {link: bad})).status, 400, msg);
let adm = await json('/api/portal/links', admin);
assert.deepEqual(adm.map(l => l.titulo), ['Ponto eletrônico', 'Portal da Prefeitura', 'Contabilidade da APP'], 'ordem de cadastro');
assert.equal(adm[0].url, 'https://ponto.araquari.sc.gov.br/', 'endereço sem https recebe https://');
assert.equal(adm[2].url, 'mailto:contato@exemplo.org', 'e-mail vira mailto:');
assert.equal(adm[2].icone, 'link'); assert.equal(adm[2].cor, 'azul'); assert.equal(adm[1].extra, undefined);
assert.equal(adm[2].professores, false); assert.equal(adm[2].publico, false);
// Professor vê só os marcados para professores, sem dados internos.
let prof = await json('/api/portal/links', teacher);
assert.deepEqual(prof.map(l => l.titulo), ['Ponto eletrônico', 'Portal da Prefeitura']);
assert.deepEqual(Object.keys(prof[0]).sort(), ['cor', 'descricao', 'icone', 'id', 'titulo', 'url']);
// Página pública vê só os públicos.
let pub = (await json('/api/public/home')).links;
assert.deepEqual(pub.map(l => l.titulo), ['Portal da Prefeitura']); assert.ok(!('por' in pub[0]) && !('professores' in pub[0]));
// Edição: o endereço, o ícone e onde aparece mudam, o atalho (id) continua o mesmo.
const id = adm[0].id, criado = adm[0].criadoEm;
await json('/api/portal/links', admin, 'POST', {link: {id, titulo: 'Ponto eletrônico', url: 'https://novoponto.araquari.sc.gov.br/login', icone: 'chave', cor: 'laranja', professores: true, publico: true}});
adm = await json('/api/portal/links', admin);
assert.equal(adm.length, 3); assert.equal(adm[0].id, id); assert.equal(adm[0].url, 'https://novoponto.araquari.sc.gov.br/login'); assert.equal(adm[0].icone, 'chave'); assert.equal(adm[0].criadoEm, criado);
assert.deepEqual((await json('/api/public/home')).links.map(l => l.titulo), ['Ponto eletrônico', 'Portal da Prefeitura']);
assert.equal((await call('/api/portal/links', admin, 'POST', {link: {id: 'inexistente-123', titulo: 'A', url: 'https://a.com'}})).status, 404, 'editar link apagado');
// Reordenar e excluir.
await json('/api/portal/links', admin, 'POST', {ordem: [adm[2].id, adm[1].id, adm[0].id]});
assert.deepEqual((await json('/api/portal/links', admin)).map(l => l.titulo), ['Contabilidade da APP', 'Portal da Prefeitura', 'Ponto eletrônico']);
await json('/api/portal/links', admin, 'POST', {id: adm[1].id, delete: true});
assert.deepEqual((await json('/api/portal/links', admin)).map(l => l.titulo), ['Contabilidade da APP', 'Ponto eletrônico']);
assert.deepEqual((await json('/api/public/home')).links.map(l => l.titulo), ['Ponto eletrônico']);
assert.equal((await call('/api/portal/links', teacher, 'POST', {id, delete: true})).status, 403);
// Biblioteca de ícones: todos válidos, links inseguros nunca viram href.
const ctx = {window: {}, URL}; vm.runInNewContext(await fs.readFile('dist/link-icons.js', 'utf8'), ctx);
const I = ctx.window.LinkIcones;
assert.ok(Object.keys(I.ICONES).length >= 60);
for (const [k, ic] of Object.entries(I.ICONES)) { assert.match(k, /^[a-z0-9-]{1,30}$/); assert.ok(ic.n && ic.d, k); assert.match(I.svg(k), /^<svg[^>]*><path d="[^"<>]+"\/>/); }
assert.equal(I.svg('naoexiste'), I.svg('link'));
assert.equal(I.seguro('javascript:alert(1)'), ''); assert.equal(I.seguro('https://a.com'), 'https://a.com');
assert.equal(I.cor('verde'), '#1f8a4c'); assert.equal(I.cor('url(x)'), '#1d5fb8');
assert.equal(I.host('https://www.araquari.sc.gov.br/x'), 'araquari.sc.gov.br'); assert.equal(I.host('mailto:a@b.com'), 'a@b.com');
// Telas: funções chamadas em onclick precisam existir em window (não em constantes internas).
const central = await fs.readFile('dist/central.js', 'utf8');
for (const f of ['cxLinkForm', 'cxLinkSave', 'cxLinkDel', 'cxLinkMove', 'cxLinkPrev', 'cxLinkBusca']) assert.match(central, new RegExp(`window\\.${f} = `), f);
const html = await fs.readFile('dist/public.html', 'utf8');
assert.match(html, /data-tab="links"/); assert.match(html, /link-icons\.js\?v=/); assert.match(await fs.readFile('dist/index.html', 'utf8'), /link-icons\.js\?v=[^"]+"><\/script><script src="central\.js/);
await fs.rm(dir, {recursive: true, force: true});
console.log('PASS: links úteis (só administração cadastra, https/mailto automáticos, bloqueio de javascript:, professor e público veem só o que foi marcado, edição mantém o atalho, ordem e exclusão, ícones válidos).');
