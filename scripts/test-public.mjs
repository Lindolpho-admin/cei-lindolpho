// v40: página pública (categorias, avisos, informações da unidade) e limites de acesso.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-public-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER:'chatgpt-sites',CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {}), ...(body && !(body instanceof FormData) ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: body instanceof FormData ? body : JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
async function upload(fields) { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); f.set('file', new File(['%PDF-1.4 ' + fields.title], 'd.pdf', {type: 'application/pdf'})); return json('/api/app/arquivo', admin, 'POST', f, 201); }
const ymd = d => d.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});

try {
  await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});
  // Página pública vazia e padrão
  let home = await json('/api/public/home');
  assert.equal(home.materials.length, 0); assert.equal(home.notices.length, 0); assert.equal(home.info.phone, '(47) 3452-2185');
  assert.equal((await call('/')).status, 200);
  // Documentos: regimento, PPP, regimento do conselho, estatuto APP e uma ata interna (não publicada)
  const reg = await upload({kind: 'regimento', area: 'institucional', date: '2025-02-10', title: 'Regimento Interno'});
  const ppp = await upload({kind: 'ppp', area: 'institucional', date: '2026-03-01', title: 'PPP 2026'});
  const con = await upload({kind: 'estatuto', area: 'conselho', date: '2024-05-20', title: 'Regimento do Conselho Escolar'});
  const est = await upload({kind: 'estatuto', area: 'app', date: '2023-08-15', title: 'Estatuto'});
  const ata = await upload({kind: 'ata', area: 'reuniao_geral', date: '2026-10-01', title: 'Ata interna'});
  await json('/api/portal/publications', admin, 'POST', {id: reg.id, published: true, category: 'regimento'});
  await json('/api/portal/publications', admin, 'POST', {id: ppp.id, published: true, category: 'ppp', description: 'Aprovado em março'});
  await json('/api/portal/publications', admin, 'POST', {id: con.id, published: true});               // categoria sugerida: conselho
  await json('/api/portal/publications', admin, 'POST', {id: est.id, published: true, category: 'xx'}); // inválida → sugerida: app
  home = await json('/api/public/home');
  const byId = Object.fromEntries(home.materials.map(m => [m.id, m]));
  assert.equal(home.materials.length, 4); assert.ok(!byId[ata.id]);
  assert.equal(byId[reg.id].category, 'regimento'); assert.equal(byId[ppp.id].category, 'ppp'); assert.equal(byId[ppp.id].description, 'Aprovado em março');
  assert.equal(byId[con.id].category, 'conselho'); assert.equal(byId[est.id].category, 'app');
  assert.ok(home.materials.every(m => !('notes' in m) && !('fin' in m) && !('createdBy' in m)));
  // Arquivo publicado abre sem login; ata não publicada é bloqueada
  assert.equal((await call('/api/app/documents/' + reg.id + '/file?view=1')).status, 200);
  assert.equal((await call('/api/app/documents/' + ata.id + '/file?view=1')).status, 403);
  // Mudar seção mantém publicação; retirar remove da página e bloqueia o arquivo
  await json('/api/portal/publications', admin, 'POST', {id: est.id, published: true, category: 'outros'});
  assert.equal((await json('/api/public/home')).materials.find(m => m.id === est.id).category, 'outros');
  await json('/api/portal/publications', admin, 'POST', {id: est.id, published: false});
  assert.ok(!(await json('/api/public/home')).materials.some(m => m.id === est.id));
  assert.equal((await call('/api/app/documents/' + est.id + '/file')).status, 403);
  assert.ok(!(await json('/api/portal/public-settings', admin)).meta[est.id]);
  // Avisos: vigentes, fixados primeiro, encerrados ocultos para o público
  const tomorrow = ymd(new Date(Date.now() + 864e5)), yesterday = ymd(new Date(Date.now() - 864e5));
  await json('/api/portal/notices', admin, 'POST', {title: 'Campanha', body: 'Texto', until: tomorrow});
  await json('/api/portal/notices', admin, 'POST', {title: 'Reunião de pais', body: 'Às 18h', pinned: true});
  await json('/api/portal/notices', admin, 'POST', {title: 'Antigo', until: yesterday});
  await json('/api/portal/notices', admin, 'POST', {title: 'Data ruim', until: '2026-02-31'}, 400);
  await json('/api/portal/notices', admin, 'POST', {title: '', body: 'sem título'}, 400);
  home = await json('/api/public/home');
  assert.deepEqual(home.notices.map(n => n.title), ['Reunião de pais', 'Campanha']);
  assert.ok(home.notices.every(n => !('by' in n)));
  const settings = await json('/api/portal/public-settings', admin);
  assert.equal(settings.notices.length, 3);
  const old = settings.notices.find(n => n.title === 'Antigo');
  await json('/api/portal/notices', admin, 'POST', {id: old.id, delete: true});
  assert.equal((await json('/api/portal/public-settings', admin)).notices.length, 2);
  const camp = settings.notices.find(n => n.title === 'Campanha');
  await json('/api/portal/notices', admin, 'POST', {id: camp.id, title: 'Campanha do agasalho', body: 'Novo texto', until: tomorrow});
  const edited = (await json('/api/portal/public-settings', admin)).notices.filter(n => n.id === camp.id);
  assert.equal(edited.length, 1); assert.equal(edited[0].title, 'Campanha do agasalho'); assert.equal(edited[0].date, camp.date);
  // Informações da unidade
  await json('/api/portal/public-info', admin, 'POST', {phone: '(47) 3452-2185', whatsapp: '+55 (47) 3452-2185', email: 'cei@example.org', hours: 'Segunda a sexta, 7h às 19h', address: 'Rua X, 1', about: 'Sobre', vagas: 'Pela Secretaria'});
  await json('/api/portal/public-info', admin, 'POST', {email: 'invalido'}, 400);
  home = await json('/api/public/home');
  assert.equal(home.info.whatsapp, '554734522185'); assert.equal(home.info.hours, 'Segunda a sexta, 7h às 19h'); assert.equal(home.info.vagas, 'Pela Secretaria');
  // Somente a administração altera a página pública
  for (const [route, body] of [['/api/portal/notices', {title: 'x'}], ['/api/portal/public-info', {phone: '1'}], ['/api/portal/publications', {id: reg.id, published: false}]]) {
    assert.equal((await call(route, teacher, 'POST', body)).status, 403);
    assert.equal((await call(route, '', 'POST', body)).status, 403);
  }
  assert.equal((await call('/api/portal/public-settings', teacher)).status, 403);
  assert.equal((await call('/api/portal/public-settings')).status, 403);
  // Avisos, categorias e informações entram no backup completo
  const backup = await json('/api/storage/backup', admin);
  assert.equal(backup.state.portal.notices.length, 2); assert.equal(backup.state.portal.info.email, 'cei@example.org'); assert.equal(backup.state.portal.publicMeta[ppp.id].category, 'ppp');
  console.log('PASS: página pública (documentos por seção com categoria escolhida/sugerida, descrição, mudança de seção e retirada), arquivos públicos x internos, avisos com validade e fixação, informações da unidade, permissões exclusivas da administração e backup.');
} finally { await fs.rm(dir, {recursive: true, force: true}); }
