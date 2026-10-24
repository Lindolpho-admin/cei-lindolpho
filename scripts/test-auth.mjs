// v42: login com e-mail e senha fora do ChatGPT Sites. Nenhuma chamada externa.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-auth-'));
const ADMIN = 'direcao@cei.example', PROF = 'maria@cei.example', INITIAL = 'Inicial#2026-CEI';
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'senha', CEI_BOOTSTRAP_ADMIN_EMAIL: ADMIN, ADMIN_SENHA_INICIAL: INITIAL};
const O = 'https://cei-lindolpho.exemplo.workers.dev';
const forged = {'oai-authenticated-user-id': 'hacker', 'oai-authenticated-user-email': ADMIN};
globalThis.fetch = () => { throw Error('Nenhuma chamada externa é permitida'); };
const call = (route, {headers = {}, method = 'GET', body, cookie} = {}) => worker.fetch(new Request(O + route, {method, redirect: 'manual', headers: {...(method !== 'GET' ? {Origin: O} : {}), ...(cookie ? {Cookie: cookie} : {}), ...headers}, ...(body ? {body} : {})}), env);
const form = obj => new URLSearchParams(obj);
const sess = r => (r.headers.getSetCookie?.() || [r.headers.get('set-cookie')]).map(c => c.split(';')[0]).find(c => c.startsWith('cei_sessao=') && c !== 'cei_sessao=');
const role = async cookie => (await (await call('/api/session', {cookie})).json()).role;
const login = (email, senha, to = '/restrito') => call('/entrar', {method: 'POST', body: form({email, senha, return_to: to}), headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
const json = async (route, cookie, body) => { const r = await call(route, {method: 'POST', cookie, body: JSON.stringify(body), headers: {'Content-Type': 'application/json'}}); return {status: r.status, data: await r.json()}; };

try {
  await call('/');  // prepara a base
  // 1) Sem sessão: cabeçalhos forjados não valem
  assert.equal(await role(undefined), 'anonymous');
  assert.equal((await (await call('/api/session', {headers: forged})).json()).role, 'anonymous');
  assert.equal((await call('/api/data/state', {headers: forged})).status, 401);
  assert.equal((await (await call('/api/auth/config')).json()).provider, 'senha');
  assert.match(await (await call('/entrar')).text(), /name="senha"/);
  assert.match(await (await call('/restrito')).text(), /Acesso da equipe/);
  // ChatGPT Sites continua funcionando no seu endereço
  assert.equal((await (await worker.fetch(new Request('https://x.diceflowsoftware.chatgpt.site/api/session', {headers: forged}), {...env, AUTH_PROVIDER: undefined})).json()).role, 'admin');
  // 2) Primeiro acesso da direção com ADMIN_SENHA_INICIAL → obriga troca
  assert.equal((await login(ADMIN, 'errada-123')).status, 401);
  let r = await login(ADMIN, INITIAL, '/restrito?entrada=2');
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/trocar-senha?return_to=%2Frestrito%3Fentrada%3D2');
  let c = sess(r); assert.ok(c); assert.equal(await role(c), 'admin');
  assert.ok((r.headers.getSetCookie?.() || []).some(x => /HttpOnly; Secure; SameSite=Lax/.test(x)));
  assert.match(await (await call('/trocar-senha', {cookie: c})).text(), /primeiro acesso/);
  // Troca de senha: validações
  const change = (cookie, atual, nova, confirmar = nova) => call('/trocar-senha', {method: 'POST', cookie, body: form({atual, nova, confirmar, return_to: '/restrito'}), headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
  assert.equal((await change(c, 'errada', 'NovaSenha#1')).status, 400);
  assert.equal((await change(c, INITIAL, 'curta')).status, 400);
  assert.equal((await change(c, INITIAL, 'NovaSenha#1', 'Outra#1234')).status, 400);
  assert.equal((await change(c, INITIAL, '12345678')).status, 400);
  r = await change(c, INITIAL, 'Diretora#Forte2026');
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/restrito');
  const oldCookie = c; c = sess(r);
  assert.equal(await role(oldCookie), 'anonymous', 'sessão anterior à troca deixa de valer');
  assert.equal(await role(c), 'admin');
  // A senha inicial não serve mais (já usada); a nova serve
  assert.equal((await login(ADMIN, INITIAL)).status, 401);
  r = await login(ADMIN, 'Diretora#Forte2026'); assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/restrito'); c = sess(r);
  // 3) Hashes nunca saem pela API
  const state = await (await call('/api/data/state', {cookie: c})).json();
  assert.ok(!state.data.portal?.credentials && !state.data.portal?.bootstrapSecretHash);
  // 4) Direção cadastra professora com senha inicial
  assert.equal((await json('/api/portal/members', c, {email: PROF, role: 'teacher', name: 'Maria', password: 'curta'})).status, 400);
  assert.equal((await json('/api/portal/members', c, {email: PROF, role: 'teacher', name: 'Maria', password: 'Maria#Inicial1'})).status, 200);
  const members = await (await call('/api/portal/members', {cookie: c})).json();
  const m = members.find(x => x.email === PROF); assert.equal(m.hasPassword, true); assert.equal(m.mustChange, true); assert.ok(!('salt' in m) && !('hash' in m));
  r = await login(PROF, 'Maria#Inicial1'); assert.match(r.headers.get('location'), /^\/trocar-senha/);
  let cp = sess(r); assert.equal(await role(cp), 'teacher');
  assert.equal((await call('/api/app/documents', {cookie: cp})).status, 403);
  assert.equal((await json('/api/portal/password', cp, {email: ADMIN, password: 'Tomada#2026x'})).status, 403, 'docente não redefine senhas');
  r = await change(cp, 'Maria#Inicial1', 'Maria#Pessoal99'); cp = sess(r); assert.equal(await role(cp), 'teacher');
  // Direção redefine a senha → sessão da professora cai
  assert.equal((await json('/api/portal/password', c, {email: PROF, password: 'Maria#Redef2026'})).status, 200);
  assert.equal(await role(cp), 'anonymous');
  assert.equal((await login(PROF, 'Maria#Pessoal99')).status, 401);
  assert.equal((await login(PROF, 'Maria#Redef2026')).status, 303);
  assert.equal((await json('/api/portal/password', c, {email: 'desconhecido@x.org', password: 'Qualquer#123'})).status, 400);
  // Bloqueio do acesso pela direção
  await json('/api/portal/members', c, {email: PROF, role: 'pending', name: 'Maria'});
  assert.equal(await role(sess(await login(PROF, 'Maria#Redef2026'))), 'pending');
  // 5) Bloqueio após 5 tentativas erradas
  for (let i = 0; i < 4; i++) assert.equal((await login(ADMIN, 'errada-' + i)).status, 401);
  assert.match(await (await login(ADMIN, 'errada-5')).text(), /bloqueado por 15 minutos/);
  assert.match(await (await login(ADMIN, 'Diretora#Forte2026')).text(), /Muitas tentativas/, 'bloqueado mesmo com a senha certa');
  // 6) Cookie adulterado e envio de outro site
  const [, value] = c.split('='); const [, mac] = value.split('.');
  const evil = Buffer.from(JSON.stringify({email: ADMIN, pv: 'x', exp: Date.now() + 1e7})).toString('base64url');
  assert.equal(await role(`cei_sessao=${evil}.${mac}`), 'anonymous');
  assert.equal((await call('/entrar', {method: 'POST', body: form({email: ADMIN, senha: 'x'}), headers: {'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://malicioso.example'}})).status, 403);
  // Retorno apenas para o próprio site
  assert.match(await (await call('/entrar?return_to=https://evil.example')).text(), /value="\/restrito"/);
  // 7) Recuperação: trocar ADMIN_SENHA_INICIAL no painel libera um novo primeiro acesso
  env.ADMIN_SENHA_INICIAL = 'Recupera#2027-CEI';
  await env.BUCKET.delete('cei/auth/tentativas/' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ADMIN)))].map(x => x.toString(16).padStart(2, '0')).join(''));
  r = await login(ADMIN, 'Recupera#2027-CEI'); assert.equal(r.status, 303); assert.match(r.headers.get('location'), /^\/trocar-senha/);
  assert.equal(await role(c), 'anonymous', 'sessões antigas encerradas na recuperação');
  // 8) Sair
  r = await call('/sair', {cookie: sess(r)}); assert.equal(r.status, 303); assert.ok((r.headers.getSetCookie?.() || []).some(x => /cei_sessao=;.*Max-Age=0/.test(x)));
  // 9) Senhas entram no backup completo (para restaurar o acesso da equipe)
  const admin2 = sess(await change(sess(await login(ADMIN, 'Recupera#2027-CEI')), 'Recupera#2027-CEI', 'Diretora#Nova2027'));
  const backup = await (await call('/api/storage/backup', {cookie: admin2})).json();
  assert.ok(backup.state.portal.credentials[PROF].hash);
  console.log('PASS: login por senha (primeiro acesso com segredo, troca obrigatória, validação de senha), cabeçalhos forjados e cookie adulterado rejeitados, sessões encerradas após troca/redefinição, cadastro e redefinição pela direção, docente sem poderes administrativos, bloqueio após 5 erros, origem e retorno seguros, recuperação pelo segredo, saída, hashes fora da API e dentro do backup; ChatGPT Sites preservado.');
} finally { await fs.rm(dir, {recursive: true, force: true}); }
