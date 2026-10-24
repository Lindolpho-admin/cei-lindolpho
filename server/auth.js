// Autenticação do CEI fora do ChatGPT Sites (v42): e-mail e senha cadastrados pela direção.
//
// Modos (variável AUTH_PROVIDER):
//  - "senha" (padrão fora do ChatGPT Sites): login próprio com e-mail e senha.
//      * CEI_BOOTSTRAP_ADMIN_EMAIL: e-mail da administração principal (recuperação).
//      * ADMIN_SENHA_INICIAL (segredo no painel do Cloudflare): senha do primeiro acesso dessa conta.
//        Trocar o valor desse segredo no painel permite um novo acesso de recuperação (uma vez por valor).
//      * A chave que assina as sessões é gerada automaticamente e guardada no R2 (cei/auth/chave-sessao).
//  - "chatgpt-sites": confia nos cabeçalhos oai-* da plataforma ChatGPT Sites
//      (assumido automaticamente quando o endereço termina em ".chatgpt.site").
//
// Senhas: PBKDF2-SHA256 com sal aleatório (iterações em PBKDF2_ITERATIONS, padrão 10000 por causa do limite
// de CPU do plano gratuito), bloqueio de 15 minutos após 5 tentativas erradas, sessão em cookie assinado (HMAC).
// O restante do sistema continua lendo a identidade dos cabeçalhos oai-authenticated-user-id/-email:
// prepareRequest() remove esses cabeçalhos vindos de fora e só os recoloca após validar a sessão.
import {activeBucket, withWriteLock, ensureInitial} from './host-storage.js';

const STATE_KEY = 'cei/state/current.json', SECRET_KEY = 'cei/auth/chave-sessao', ATTEMPTS = 'cei/auth/tentativas/';
const SESSION_COOKIE = 'cei_sessao', SESSION_HOURS = 12, MAX_FAILS = 5, LOCK_MINUTES = 15, MIN_PASSWORD = 8;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
const norm = email => String(email || '').trim().toLowerCase();
const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };

/* ---------- Senhas ---------- */
export async function hashPassword(password, env, salt = crypto.getRandomValues(new Uint8Array(16)), iter) {
  const iterations = iter || Math.max(5000, Math.min(1000000, Number(env?.PBKDF2_ITERATIONS) || 10000));
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, key, 256);
  return {salt: b64url(salt), hash: b64url(bits), iter: iterations};
}
async function checkPassword(password, cred, env) {
  if (!cred?.salt || !cred?.hash) { await hashPassword(password, env); return false; } // tempo semelhante
  const test = await hashPassword(password, env, fromB64url(cred.salt), cred.iter);
  const a = fromB64url(test.hash), b = fromB64url(cred.hash);
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export function validatePassword(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD) fail(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  if (p.length > 200) fail('Senha muito longa.');
  if (/^(.)\1+$/.test(p) || /^(12345678|87654321|senha123|password|ceilindolpho)/i.test(p)) fail('Escolha uma senha menos óbvia.');
  return p;
}
// Credencial nova (cadastrada pela direção ou trocada pela própria pessoa).
export async function makeCredential(password, env, mustChange) {
  return {...await hashPassword(validatePassword(password), env), mustChange: !!mustChange, updatedAt: new Date().toISOString()};
}

/* ---------- Sessão assinada ---------- */
const keyCache = new Map();
async function sessionSecret(raw) {
  if (keyCache.has('secret')) return keyCache.get('secret');
  let obj = await raw.get(SECRET_KEY);
  if (!obj) {
    await raw.put(SECRET_KEY, hex(crypto.getRandomValues(new Uint8Array(32))), {onlyIf: new Headers({'If-None-Match': '*'})});
    obj = await raw.get(SECRET_KEY);
  }
  const secret = (await obj.text()).trim();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
  keyCache.set('secret', key);
  return key;
}
async function sign(payload, raw) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return body + '.' + b64url(await crypto.subtle.sign('HMAC', await sessionSecret(raw), enc.encode(body)));
}
async function verify(token, raw) {
  if (!token || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  try {
    if (!await crypto.subtle.verify('HMAC', await sessionSecret(raw), fromB64url(mac), enc.encode(body))) return null;
    const data = JSON.parse(dec.decode(fromB64url(body)));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return out;
}
const sessionCookie = (value, maxAge) => `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const safeReturn = v => (typeof v === 'string' && /^\/(?!\/)[^\s\\]*$/.test(v) && !v.startsWith('/entrar') && !v.startsWith('/trocar-senha') ? v : '/restrito');

export function authProvider(env, url) {
  const p = String(env.AUTH_PROVIDER || '').trim().toLowerCase();
  if (p === 'chatgpt-sites' || (!p && url.hostname.endsWith('.chatgpt.site'))) return 'chatgpt-sites';
  return 'senha';
}

// Devolve uma Request cuja identidade (cabeçalhos oai-*) só existe se foi validada.
export async function prepareRequest(request, env) {
  const url = new URL(request.url);
  if (authProvider(env, url) === 'chatgpt-sites') return request;
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (/^(x-)?oai-/i.test(name)) headers.delete(name);
  const token = cookies(request)[SESSION_COOKIE];
  if (token && env.BUCKET) {
    const session = await verify(token, env.BUCKET);
    if (session?.email && session?.pv) {
      // "senha:<versão>": access.js confere se a senha não foi trocada/redefinida depois desta sessão.
      headers.set('oai-authenticated-user-id', 'senha:' + session.pv);
      headers.set('oai-authenticated-user-email', norm(session.email));
    }
  }
  return new Request(request, {headers});
}

/* ---------- Estado (credenciais ficam em state.portal.credentials) ---------- */
async function readState(raw) {
  const bucket = await activeBucket(raw), obj = await bucket.get(STATE_KEY);
  return {bucket, data: obj ? JSON.parse(await obj.text()) : null};
}
async function saveState(bucket, data) { data.savedAt = new Date().toISOString(); await bucket.put(STATE_KEY, JSON.stringify(data), {httpMetadata: {contentType: 'application/json'}}); }
async function attempts(raw, email) {
  const key = ATTEMPTS + await sha256(email), obj = await raw.get(key);
  const value = obj ? JSON.parse(await obj.text()) : {fails: 0, until: 0};
  return {key, value};
}

/* ---------- Páginas de entrada ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const STYLE = '.access form{display:grid;gap:12px;text-align:left;margin:18px 0}.access label{display:grid;gap:5px;font-weight:650;font-size:14px}.access input{font:inherit;padding:11px 12px;border:1px solid #c9d3df;border-radius:8px}.access input:focus{outline:2px solid #9cc0ea;border-color:#164c81}.access .err{background:#fdecea;color:#9b1c13;border-radius:8px;padding:10px 12px;font-size:14px}.access .ok{background:#e8f6ee;color:#1f6b45;border-radius:8px;padding:10px 12px;font-size:14px}.access button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:8px;background:#2f56b0;color:#fff;cursor:pointer}.access .hint{font-size:13px}';
function page(title, inner, status = 200, extraHeaders = []) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | CEI Lindolpho</title><link rel="stylesheet" href="/portal-public.css"><style>${STYLE}</style></head><body><main class="access"><img src="/logo-lindolpho.png" alt="CEI Lindolpho"><p class="eyebrow">ÁREA RESTRITA</p><h1>${esc(title)}</h1>${inner}<p><a href="/">← Voltar à página pública</a></p></main></body></html>`,
    {status, headers: [['Content-Type', 'text/html; charset=utf-8'], ['Cache-Control', 'private, no-store, max-age=0'], ['Vary', 'Cookie'], ...extraHeaders]});
}
const loginForm = (to, message = '', email = '', note = '') => page('Entrar', `${note ? `<p class="err" role="status">${note}</p>` : ''}${message ? `<p class="err" role="alert">${esc(message)}</p>` : '<p>Use o e-mail e a senha cadastrados pela direção do CEI.</p>'}
  <form method="post" action="/entrar"><input type="hidden" name="return_to" value="${esc(to)}">
  <label>E-mail<input name="email" type="email" autocomplete="username" required value="${esc(email)}" autofocus></label>
  <label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>
  <button type="submit">Entrar</button></form>
  <p class="hint">Esqueceu a senha? Peça à direção para cadastrar uma nova senha para o seu e-mail.</p>`, message ? 401 : 200);
const changeForm = (to, message = '', forced = false) => page('Trocar senha', `${message ? `<p class="err" role="alert">${esc(message)}</p>` : forced ? '<p class="ok">Este é o seu primeiro acesso (ou a senha foi redefinida). Crie uma senha pessoal para continuar.</p>' : '<p>Escolha uma nova senha, com pelo menos 8 caracteres.</p>'}
  <form method="post" action="/trocar-senha"><input type="hidden" name="return_to" value="${esc(to)}">
  <label>Senha atual<input name="atual" type="password" autocomplete="current-password" required></label>
  <label>Nova senha<input name="nova" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" required></label>
  <label>Repita a nova senha<input name="confirmar" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" required></label>
  <button type="submit">Salvar nova senha</button></form>`, message ? 400 : 200);

async function startSession(raw, email, cred, to) {
  const token = await sign({email, pv: cred.updatedAt, exp: Date.now() + SESSION_HOURS * 3600 * 1000}, raw);
  const next = cred.mustChange ? '/trocar-senha?return_to=' + encodeURIComponent(to) : to;
  return new Response(null, {status: 303, headers: [['Location', next], ['Set-Cookie', sessionCookie(token, SESSION_HOURS * 3600)], ['Cache-Control', 'no-store']]});
}

// Rotas de entrada e saída. Mantém os caminhos antigos (/signin-with-chatgpt, /signout-with-chatgpt) usados pelas telas.
export async function handleAuthRoute(request, env) {
  const url = new URL(request.url), path = url.pathname, provider = authProvider(env, url);
  if (path === '/api/auth/config') return Response.json({provider: provider === 'chatgpt-sites' ? 'chatgpt' : 'senha'}, {headers: {'Cache-Control': 'no-store'}});
  if (provider === 'chatgpt-sites') return null;
  const isSignin = path === '/entrar' || path === '/signin-with-chatgpt', isSignout = path === '/sair' || path === '/signout-with-chatgpt', isChange = path === '/trocar-senha';
  if (!isSignin && !isSignout && !isChange) return null;
  const raw = env.BUCKET;
  if (!raw) return page('Indisponível', '<p class="err">O armazenamento R2 (BUCKET) não está ligado a este Worker.</p>', 503);
  if (isSignout) return new Response(null, {status: 303, headers: [['Location', safeReturn(url.searchParams.get('return_to') || '/') === '/restrito' ? '/' : safeReturn(url.searchParams.get('return_to') || '/')], ['Set-Cookie', sessionCookie('', 0)], ['Cache-Control', 'no-store']]});
  const sameOrigin = request.headers.get('Origin') === url.origin;
  if (isSignin) {
    if (request.method === 'GET') {
      const missing = [!norm(env.CEI_BOOTSTRAP_ADMIN_EMAIL) && 'CEI_BOOTSTRAP_ADMIN_EMAIL (texto: e-mail da administração)', String(env.ADMIN_SENHA_INICIAL || '').length < MIN_PASSWORD && 'ADMIN_SENHA_INICIAL (segredo: senha do primeiro acesso, 8+ caracteres)'].filter(Boolean);
      const note = missing.length ? '<b>Configuração pendente.</b> No painel do Cloudflare, abra o Worker → Settings → Variables and Secrets e cadastre: ' + missing.map(esc).join('; ') + '.' : '';
      return loginForm(safeReturn(url.searchParams.get('return_to')), '', '', note);
    }
    if (request.method !== 'POST' || !sameOrigin) return page('Entrar', '<p class="err">Envio não permitido.</p>', 403);
    await ensureInitial(raw);
    const form = await request.formData();
    const email = norm(form.get('email')), password = String(form.get('senha') || ''), to = safeReturn(String(form.get('return_to') || ''));
    if (!email || !password) return loginForm(to, 'Informe e-mail e senha.', email);
    const att = await attempts(raw, email);
    if (att.value.until > Date.now()) return loginForm(to, `Muitas tentativas. Aguarde ${Math.ceil((att.value.until - Date.now()) / 60000)} minuto(s) e tente de novo.`, email);
    const {bucket, data} = await readState(raw);
    const portal = data?.portal || {}, creds = portal.credentials || {}, bootstrap = norm(env.CEI_BOOTSTRAP_ADMIN_EMAIL);
    let ok = false, cred = creds[email];
    const initial = String(env.ADMIN_SENHA_INICIAL || '');
    if (email === bootstrap && initial.length >= MIN_PASSWORD && password === initial) {
      // Primeiro acesso ou recuperação: vale uma vez para cada valor do segredo ADMIN_SENHA_INICIAL.
      const used = await sha256(initial);
      if (portal.bootstrapSecretHash !== used) {
        if (!data) return page('Aguarde', '<p>O site ainda está sendo preparado. Abra a <a href="/">página inicial</a> e tente de novo.</p>', 503);
        cred = await withWriteLock(raw, async () => {
          const fresh = await readState(raw);
          const p = fresh.data.portal = fresh.data.portal || {members: [], requests: [], publicIds: []};
          p.credentials = p.credentials || {};
          p.credentials[email] = {...await hashPassword(initial, env), mustChange: true, updatedAt: new Date().toISOString()};
          p.bootstrapSecretHash = used;
          await saveState(fresh.bucket, fresh.data);
          return p.credentials[email];
        });
        ok = true;
      }
    }
    if (!ok) ok = await checkPassword(password, cred, env);
    if (!ok) {
      const fails = att.value.fails + 1;
      await raw.put(att.key, JSON.stringify(fails >= MAX_FAILS ? {fails: 0, until: Date.now() + LOCK_MINUTES * 60000} : {fails, until: 0}));
      return loginForm(to, fails >= MAX_FAILS ? `E-mail ou senha incorretos. Por segurança, este e-mail ficou bloqueado por ${LOCK_MINUTES} minutos.` : 'E-mail ou senha incorretos.', email);
    }
    if (att.value.fails || att.value.until) await raw.delete(att.key);
    void bucket;
    return startSession(raw, email, cred, to);
  }
  // /trocar-senha
  const session = await verify(cookies(request)[SESSION_COOKIE], raw);
  const to = safeReturn(url.searchParams.get('return_to') || '');
  if (!session) return new Response(null, {status: 303, headers: {Location: '/entrar?return_to=' + encodeURIComponent('/trocar-senha'), 'Cache-Control': 'no-store'}});
  const email = norm(session.email);
  if (request.method === 'GET') { const {data} = await readState(raw); return changeForm(to, '', !!data?.portal?.credentials?.[email]?.mustChange); }
  if (request.method !== 'POST' || !sameOrigin) return page('Trocar senha', '<p class="err">Envio não permitido.</p>', 403);
  const form = await request.formData(), back = safeReturn(String(form.get('return_to') || ''));
  const atual = String(form.get('atual') || ''), nova = String(form.get('nova') || ''), confirmar = String(form.get('confirmar') || '');
  const {data} = await readState(raw), cred = data?.portal?.credentials?.[email];
  if (!cred || cred.updatedAt !== session.pv) return new Response(null, {status: 303, headers: [['Location', '/entrar'], ['Set-Cookie', sessionCookie('', 0)]]});
  if (!await checkPassword(atual, cred, env)) return changeForm(back, 'A senha atual não confere.', cred.mustChange);
  if (nova !== confirmar) return changeForm(back, 'A nova senha e a confirmação são diferentes.', cred.mustChange);
  if (nova === atual) return changeForm(back, 'A nova senha precisa ser diferente da atual.', cred.mustChange);
  let fresh;
  try {
    const made = await makeCredential(nova, env, false);
    fresh = await withWriteLock(raw, async () => {
      const st = await readState(raw); st.data.portal.credentials[email] = made; await saveState(st.bucket, st.data); return made;
    });
  } catch (error) { if (error.status === 400) return changeForm(back, error.message, cred.mustChange); throw error; }
  return startSession(raw, email, fresh, back);
}
