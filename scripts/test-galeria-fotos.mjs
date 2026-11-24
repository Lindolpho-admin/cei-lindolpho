// v68: galeria de fotos por código (a foto digital é grátis) e pedido de impressão online com Pix.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-galeria-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org';
const hdr = user => ({Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {})});
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {...hdr(user), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, route + ' ' + await r.clone().text()); return r.json(); }
const raw = (route, user, bytes) => worker.fetch(new Request(origin + route, {method: 'POST', headers: hdr(user), body: bytes}), env);
const jpg = n => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(n).fill(7)]);
const uuid = () => crypto.randomUUID();

const ev0 = {nome: 'Fotos de fim de ano 2026', tabelas: {'10x15': [{de: 1, ate: null, valor: 800}], '15x21': [{de: 1, ate: null, valor: 1200}]}};
await json('/api/portal/fotos', admin, 'POST', {evento: ev0});
let d = await json('/api/portal/fotos', admin); const ev = d.eventos[0];
assert.deepEqual(ev.pix, {chave: '09303966000172', nome: 'APP CEI LINDOLPHO', cidade: 'ARAQUARI'}, 'Pix padrão da APP');
assert.equal((await call('/api/portal/fotos', admin, 'POST', {evento: {...ev0, pix: {chave: '', nome: 'X', cidade: 'Y'}}})).status, 400, 'Pix sem chave');

// Envio das fotos (só a administração).
async function enviar(crianca, turma, bytes = jpg(50)) {
  const id = uuid();
  assert.equal((await raw(`/api/portal/galeria-arquivo?id=${id}&t=o`, admin, bytes)).status, 200);
  assert.equal((await raw(`/api/portal/galeria-arquivo?id=${id}&t=t`, admin, jpg(10))).status, 200);
  await json('/api/portal/fotos', admin, 'POST', {galeriaFoto: {id, eventoId: ev.id, turma, crianca, bytes: bytes.length}});
  return id;
}
assert.equal((await raw('/api/portal/galeria-arquivo?id=' + uuid() + '&t=o', '', jpg(5))).status, 403, 'anônimo não envia');
assert.equal((await raw('/api/portal/galeria-arquivo?id=' + uuid() + '&t=o', admin, new TextEncoder().encode('<script>1</script>'))).status, 400, 'só JPG ou PNG');
assert.equal((await raw('/api/portal/galeria-arquivo?id=' + uuid() + '&t=t', admin, jpg(401 * 1024))).status, 400, 'miniatura grande demais');
const semMini = uuid(); await raw(`/api/portal/galeria-arquivo?id=${semMini}&t=o`, admin, jpg(5));
assert.equal((await call('/api/portal/fotos', admin, 'POST', {galeriaFoto: {id: semMini, eventoId: ev.id, turma: 'Maternal 2', crianca: 'X'}})).status, 400, 'sem miniatura não entra');
const f1 = await enviar('Lucas', 'Maternal 2'), f2 = await enviar('Maria', 'Maternal 2'), f3 = await enviar('Pedro', 'Jardim 1');
d = await json('/api/portal/fotos', admin);
assert.equal(d.galeria.length, 3); assert.equal(d.codigos.length, 2, 'um código por turma');
const cod = t => d.codigos.find(k => k.turma === t).codigo; const c1 = cod('Maternal 2'), c2 = cod('Jardim 1');
assert.match(c1, /^[A-Z0-9]{6}$/); assert.notEqual(c1, c2);

// Família: só com o código certo.
assert.equal((await call('/api/public/galeria?c=ZZZZZZ')).status, 404, 'código errado');
assert.equal((await call('/api/public/galeria')).status, 404, 'sem código');
const g = await json('/api/public/galeria?c=' + c1.toLowerCase().replace(/^(...)/, '$1-'));
assert.equal(g.turma, 'Maternal 2'); assert.equal(g.fotos.length, 2, 'só a turma do código'); assert.deepEqual(g.fotos.map(x => x.crianca), ['Lucas', 'Maria']);
assert.equal(g.evento.pix.chave, '09303966000172'); assert.ok(g.evento.tabelas['10x15']); assert.equal(JSON.stringify(g).includes('owner@example.org'), false, 'nada interno');
const mini = await call(`/api/public/galeria/img/${f1}?c=${c1}`); assert.equal(mini.status, 200); assert.equal(mini.headers.get('content-type'), 'image/jpeg'); assert.equal((await mini.arrayBuffer()).byteLength, 14);
const orig = await call(`/api/public/galeria/img/${f1}?c=${c1}&t=o&dl=1`); assert.equal(orig.status, 200); assert.match(orig.headers.get('content-disposition'), /^attachment/); assert.equal((await orig.arrayBuffer()).byteLength, 54, 'original sem perda');
assert.equal((await call(`/api/public/galeria/img/${f3}?c=${c1}`)).status, 404, 'foto de outra turma');
assert.equal((await call(`/api/public/galeria/img/${f1}?c=${c2}`)).status, 404);
assert.equal((await call(`/api/public/galeria/img/${f1}`)).status, 404, 'sem código');
assert.equal((await call(`/api/portal/galeria-arquivo/${f1}`)).status, 404, 'rota do admin fechada');
assert.equal((await call(`/api/portal/galeria-arquivo/${f1}?t=o`, admin)).status, 200);
assert.equal((await call('/api/portal/fotos', '', 'POST', {codigo: {eventoId: ev.id, turma: 'Maternal 2', acao: 'novo'}})).status, 403, 'família não mexe nos códigos');
const pg = await call('/fotos'); assert.equal(pg.status, 200); assert.match(pg.headers.get('x-robots-tag'), /noindex/);

// Comprovante enviado pela família.
const anx = async (bytes, c = c1) => raw('/api/public/galeria/anexo?c=' + c, '', bytes);
const a1 = await anx(jpg(30)); assert.equal(a1.status, 200); const anexoId = (await a1.json()).id;
assert.equal((await anx(new TextEncoder().encode('<html>'))).status, 400, 'só imagem ou PDF');
assert.equal((await anx(jpg(1500 * 1024 + 5))).status, 400, 'acima de 1,5 MB');
assert.equal((await anx(jpg(30), 'ZZZZZZ')).status, 404, 'sem código não envia');

// Pedido online: o servidor recalcula o preço.
const base = {c: c1, responsavel: 'Ana Paula', telefone: '(47) 99999-0000', anexo: {id: anexoId, nome: 'pix.jpg'}, itens: [{fotoId: f1, tam: '10x15', qtd: 2}, {fotoId: f2, tam: '15x21', qtd: 1}], total: 1, preco: 1};
for (const [mut, msg] of [[{responsavel: ''}, 'sem nome'], [{telefone: '123'}, 'telefone curto'], [{itens: []}, 'sem fotos'], [{itens: [{fotoId: f3, tam: '10x15', qtd: 1}]}, 'foto de outra turma'], [{itens: [{fotoId: f1, tam: '30x40', qtd: 1}]}, 'tamanho inválido'], [{itens: [{fotoId: f1, tam: '10x15', qtd: 0}]}, 'quantidade zero'], [{anexo: null}, 'sem comprovante'], [{anexo: {id: uuid()}}, 'comprovante inexistente'], [{c: 'ZZZZZZ'}, 'código errado'], [{itens: [{fotoId: f1, tam: '20x25', qtd: 1}]}, 'tamanho que o evento não vende']])
  assert.ok([400, 404].includes((await call('/api/public/galeria/pedido', '', 'POST', {...base, ...mut})).status), msg);
assert.equal((await json('/api/portal/fotos', admin)).pedidos.length, 0, 'pedidos inválidos não gravam nada');
const ok = await json('/api/public/galeria/pedido', '', 'POST', base);
assert.equal(ok.total, 2 * 800 + 1200, 'preço do servidor, não do navegador'); assert.match(ok.pedido, /^[A-F0-9]{6}$/);
d = await json('/api/portal/fotos', admin); const ped = d.pedidos[0];
assert.equal(ped.origem, 'online'); assert.equal(ped.pagamento, 'pendente'); assert.equal(ped.forma, 'pix'); assert.equal(ped.recebido, 0); assert.equal(ped.crianca, 'Lucas, Maria'); assert.equal(ped.turma, 'Maternal 2');
assert.equal(ped.anexos[0].id, anexoId); assert.equal(ped.anexos[0].tipo, 'comprovante'); assert.equal(ped.escolhidas.length, 2); assert.equal(ped.fotos, 3);
assert.equal((await call(`/api/portal/anexo-pedido/${anexoId}`, admin)).status, 200); assert.equal((await call(`/api/portal/anexo-pedido/${anexoId}`)).status, 404, 'comprovante só para a administração');

// Foto que está em pedido não sai; antispam; honeypot.
assert.equal((await call('/api/portal/fotos', admin, 'POST', {galeriaExcluir: f1})).status, 400, 'foto em pedido');
const hp = await json('/api/public/galeria/pedido', '', 'POST', {...base, site: 'http://spam'}); assert.equal(hp.ok, true); assert.equal((await json('/api/portal/fotos', admin)).pedidos.length, 1, 'honeypot não grava');
for (let i = 0; i < 4; i++) { const a = (await (await anx(jpg(20))).json()).id; await json('/api/public/galeria/pedido', '', 'POST', {...base, anexo: {id: a}}); }
const a6 = (await (await anx(jpg(20))).json()).id; assert.equal((await call('/api/public/galeria/pedido', '', 'POST', {...base, anexo: {id: a6}})).status, 429, 'mais de 5 pendentes do mesmo telefone');

// Conferência: a administração confirma o pagamento pelo fluxo que já existe.
const pedAdm = {...d.pedidos[0], pagamento: 'pago', forma: 'pix'};
await json('/api/portal/fotos', admin, 'POST', {pedido: pedAdm});
const dep = (await json('/api/portal/fotos', admin)).pedidos.find(o => o.id === ped.id); assert.equal(dep.pagamento, 'pago'); assert.equal(dep.recebido, dep.total); assert.equal(dep.origem, 'online', 'editar não perde a origem'); assert.equal(dep.escolhidas.length, 2, 'editar não perde as fotos escolhidas');

// Códigos: gerar outro invalida o antigo; desativar fecha.
await json('/api/portal/fotos', admin, 'POST', {codigo: {eventoId: ev.id, turma: 'Maternal 2', acao: 'novo'}});
assert.equal((await call('/api/public/galeria?c=' + c1)).status, 404, 'código antigo morreu');
d = await json('/api/portal/fotos', admin); const novo = d.codigos.find(k => k.turma === 'Maternal 2').codigo; assert.notEqual(novo, c1); assert.equal((await call('/api/public/galeria?c=' + novo)).status, 200);
await json('/api/portal/fotos', admin, 'POST', {codigo: {eventoId: ev.id, turma: 'Maternal 2', acao: 'desativar'}}); assert.equal((await call('/api/public/galeria?c=' + novo)).status, 404);
await json('/api/portal/fotos', admin, 'POST', {codigo: {eventoId: ev.id, turma: 'Maternal 2', acao: 'ativar'}});

// Evento encerrado: ainda baixa, mas não pede.
await json('/api/portal/fotos', admin, 'POST', {evento: {...d.eventos[0], aberto: false}});
const enc = await json('/api/public/galeria?c=' + novo); assert.equal(enc.evento.aberto, false); assert.equal(enc.fotos.length, 2);
assert.equal((await call('/api/public/galeria/pedido', '', 'POST', {...base, c: novo})).status, 400, 'evento encerrado');
assert.equal((await raw('/api/public/galeria/anexo?c=' + novo, '', jpg(20))).status, 404, 'evento encerrado não recebe comprovante');
await json('/api/portal/fotos', admin, 'POST', {evento: {...d.eventos[0], aberto: true}});

// Apagar foto livre limpa os arquivos; evento com fotos não pode ser excluído.
await json('/api/portal/fotos', admin, 'POST', {galeriaExcluir: f3});
assert.equal(await env.BUCKET.get('cei/galeria/' + f3), null); assert.equal(await env.BUCKET.get('cei/galeria/' + f3 + '-t'), null);
assert.equal((await call('/api/portal/fotos', admin, 'POST', {excluirEvento: ev.id})).status, 400);
await json('/api/portal/fotos', admin, 'POST', {galeriaEditar: {id: f2, crianca: 'Maria Clara', turma: 'Maternal 2'}});
assert.equal((await json('/api/portal/fotos', admin)).galeria.find(x => x.id === f2).crianca, 'Maria Clara');
console.log('PASS: galeria de fotos por código e pedido online');
