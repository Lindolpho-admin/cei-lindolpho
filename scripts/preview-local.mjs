// Pré-visualização LOCAL da área restrita, somente para testes no próprio computador.
//
//   node scripts/preview-local.mjs                 → entra como administração de teste
//   node scripts/preview-local.mjs professor       → entra como professor(a) de teste (ou PERFIL=professor)
//   Abra http://localhost:3000/restrito  (porta: PORT=3001 ...)
//
// Segurança:
// - Escuta apenas em 127.0.0.1 (não aceita conexões de outros computadores).
// - Usa uma identidade FIXA de teste, injetada aqui; cabeçalhos de identidade vindos do navegador são descartados.
// - Guarda os dados em ./dados-teste-local (separado do site publicado). Apague a pasta para recomeçar.
// - NÃO use este arquivo para hospedar o site. Para produção use o ChatGPT Sites ou scripts/portable-server.mjs
//   com autenticação real (ver documentacao/04_BACKUP_E_MIGRACAO.md).
import http from 'node:http';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {default: worker} = await import(path.join(root, 'dist/server/index.js'));
const {DiskBucket} = await import(path.join(root, 'scripts/disk-bucket.mjs'));

const port = Number(process.env.PORT || 3000);
const origin = `http://localhost:${port}`;
const ADMIN = 'administracao.teste@localhost.test', TEACHER = 'professora.teste@localhost.test';
const perfil = /^prof/i.test(process.argv[2] || process.env.PERFIL || '') ? 'professor' : 'administracao';
const dataDir = path.resolve(root, process.env.DATA_DIR || 'dados-teste-local');
// AUTH_PROVIDER 'chatgpt-sites' = confiar nos cabeçalhos de identidade; aqui eles são injetados por este script
// (os enviados pelo navegador são descartados acima). Nunca use esse modo num servidor exposto.
const env = {BUCKET: new DiskBucket(dataDir), CEI_BOOTSTRAP_ADMIN_EMAIL: ADMIN, AUTH_PROVIDER: 'chatgpt-sites'};

async function ensureTeacher() {
  // Cadastra a professora de teste para que o PERFIL=professor funcione.
  const req = new Request(origin + '/api/portal/members', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'preview-admin', 'oai-authenticated-user-email': ADMIN}, body: JSON.stringify({email: TEACHER, role: 'teacher', name: 'Professora de teste'})});
  const res = await worker.fetch(req, env, {waitUntil: p => p.catch(() => {})});
  if (!res.ok) console.warn('Aviso: não foi possível cadastrar a professora de teste:', await res.text());
}

const server = http.createServer(async (req, res) => {
  try {
    const remote = req.socket.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) { res.writeHead(403); return res.end('Somente acesso local.'); }
    const url = new URL(req.url, origin);
    if (url.pathname === '/signout-with-chatgpt' || url.pathname === '/signin-with-chatgpt') { res.writeHead(302, {Location: '/'}); return res.end(); }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      const n = name.toLowerCase();
      if (n.startsWith('oai-') || n.startsWith('x-oai-') || n === 'origin') continue;
      if (Array.isArray(value)) value.forEach(v => headers.append(name, v)); else if (value) headers.set(name, value);
    }
    if (req.headers.origin === origin) headers.set('Origin', origin);
    const email = perfil === 'professor' ? TEACHER : ADMIN;
    headers.set('oai-authenticated-user-id', 'preview-' + perfil);
    headers.set('oai-authenticated-user-email', email);
    const request = new Request(url, {method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? {body: Readable.toWeb(req), duplex: 'half'} : {})});
    const response = await worker.fetch(request, env, {waitUntil: p => p.catch(() => {})});
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (req.method === 'HEAD' || !response.body) res.end(); else Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error(error); res.writeHead(503, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('Erro no servidor de teste: ' + error.message);
  }
});

server.listen(port, '127.0.0.1', async () => {
  await ensureTeacher();
  console.log(`\nCEI Lindolpho — PRÉ-VISUALIZAÇÃO LOCAL (somente neste computador)`);
  console.log(`Perfil: ${perfil === 'professor' ? 'Professor(a) de teste' : 'Administração de teste'}   Dados: ${dataDir}`);
  console.log(`Página pública:  ${origin}/`);
  console.log(`Área restrita:   ${origin}/restrito`);
  console.log(`Para entrar como professor(a): node scripts/preview-local.mjs professor`);
  console.log(`Ctrl+C para encerrar.\n`);
});
