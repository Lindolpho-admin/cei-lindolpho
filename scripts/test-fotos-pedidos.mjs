// v63: aba Fotos (pedidos): eventos com preço por faixa, pedidos, pagamento, anexos privados e acesso só da administração.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import worker from '../dist/server/index.js';
import {precoFoto} from '../dist/server/access.js';
import {DiskBucket} from './disk-bucket.mjs';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cei-fotos-'));
const env = {BUCKET: new DiskBucket(dir), AUTH_PROVIDER: 'chatgpt-sites', CEI_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.org'};
const origin = 'https://cei.test', admin = 'owner@example.org', teacher = 'prof@example.org';
const hdr = user => ({Origin: origin, ...(user ? {'oai-authenticated-user-id': 'uid-' + user, 'oai-authenticated-user-email': user} : {})});
const call = (route, user = '', method = 'GET', body) => worker.fetch(new Request(origin + route, {method, headers: {...hdr(user), ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})}), env);
async function json(route, user, method, body, status = 200) { const r = await call(route, user, method, body); assert.equal(r.status, status, await r.clone().text()); return r.json(); }
const raw = (route, user, method, bytes) => worker.fetch(new Request(origin + route, {method, headers: hdr(user), ...(bytes ? {body: bytes} : {})}), env);
await json('/api/portal/members', admin, 'POST', {email: teacher, role: 'teacher', name: 'Prof'});

// Acesso: só a administração.
assert.equal((await call('/api/portal/fotos')).status, 403, 'anônimo');
assert.equal((await call('/api/portal/fotos', teacher)).status, 403, 'professor não vê pedidos de fotos');
assert.equal((await call('/api/portal/fotos', teacher, 'POST', {evento: {nome: 'x', faixas: [{de: 1, ate: null, valor: 100}]}})).status, 403);

// Evento: faixas do exemplo (1 a 2 = R$ 10; 3 a 9 = R$ 7,50; 10+ = R$ 5).
const faixas = [{de: 1, ate: 2, valor: 1000}, {de: 3, ate: 9, valor: 750}, {de: 10, ate: null, valor: 500}];
for (const [bad, msg] of [[[], 'sem faixas'], [[{de: 2, ate: null, valor: 1000}], 'não começa em 1'], [[{de: 1, ate: 3, valor: 1000}, {de: 3, ate: null, valor: 500}], 'sobrepõe'], [[{de: 1, ate: 3, valor: 1000}, {de: 5, ate: null, valor: 500}], 'buraco'], [[{de: 1, ate: null, valor: 1000}, {de: 5, ate: null, valor: 500}], 'sem limite no meio'], [[{de: 1, ate: 0, valor: 1000}], 'ate menor que de'], [[{de: 1, ate: null, valor: -5}], 'valor negativo']])
  assert.equal((await call('/api/portal/fotos', admin, 'POST', {evento: {nome: 'Teste', faixas: bad}})).status, 400, msg);
assert.equal((await call('/api/portal/fotos', admin, 'POST', {evento: {nome: '', faixas}})).status, 400, 'sem nome');
await json('/api/portal/fotos', admin, 'POST', {evento: {nome: 'Fotos de fim de ano 2026', faixas: faixas.slice().reverse()}});
let d = await json('/api/portal/fotos', admin); assert.equal(d.eventos.length, 1);
const ev = d.eventos[0]; assert.equal(ev.faixas[0].de, 1, 'faixas ordenadas'); assert.equal(ev.aberto, true);
assert.equal(precoFoto(ev, 1), 1000); assert.equal(precoFoto(ev, 2), 1000); assert.equal(precoFoto(ev, 3), 750); assert.equal(precoFoto(ev, 9), 750); assert.equal(precoFoto(ev, 10), 500); assert.equal(precoFoto(ev, 120), 500);

// Anexos: imagem e PDF aceitos; outro tipo e arquivo grande não; só a administração lê.
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]), pdf = new TextEncoder().encode('%PDF-1.4 teste');
const up = await raw('/api/portal/anexo-pedido', admin, 'POST', jpg); assert.equal(up.status, 200); const a1 = (await up.json()).id;
const upPdf = await raw('/api/portal/anexo-pedido', admin, 'POST', pdf); assert.equal(upPdf.status, 200); const a2 = (await upPdf.json()).id;
assert.equal((await raw('/api/portal/anexo-pedido', admin, 'POST', new TextEncoder().encode('<script>alert(1)</script>'))).status, 400, 'só imagem ou PDF');
assert.equal((await raw('/api/portal/anexo-pedido', admin, 'POST', new Uint8Array(1500 * 1024 + 10).fill(0xff))).status, 400, 'acima de 1,5 MB');
assert.equal((await raw('/api/portal/anexo-pedido', teacher, 'POST', jpg)).status, 403, 'professor não envia');
assert.equal((await raw('/api/portal/anexo-pedido/' + a1, admin)).status, 200);
assert.equal((await raw('/api/portal/anexo-pedido/' + a1, teacher)).status, 404, 'professor não lê anexo');
assert.equal((await raw('/api/portal/anexo-pedido/' + a1, '')).status === 200, false, 'anônimo não lê anexo');
assert.equal((await raw('/api/public/foto/' + a1, '')).status, 404, 'anexo não é foto pública');

// Pedido: o servidor calcula tudo.
const base = {eventoId: ev.id, responsavel: 'Maria Souza', telefone: '(47) 9 9999-0001', crianca: 'João Souza', turma: 'Maternal II', itens: [{tam: '10x15', qtd: 2}, {tam: '15x21', qtd: 1}], pagamento: 'pago', forma: 'dinheiro', situacao: 'recebido', anexos: [{id: a1, nome: 'pedido.jpg', tipo: 'whatsapp'}]};
const ped = p => json('/api/portal/fotos', admin, 'POST', {pedido: p});
await ped({...base, total: 1, unitario: 1, recebido: 5});
d = await json('/api/portal/fotos', admin); let o = d.pedidos[0];
assert.equal(o.fotos, 3); assert.equal(o.unitario, 750, '3 fotos = faixa de R$ 7,50'); assert.equal(o.total, 2250, 'o servidor ignora total enviado'); assert.equal(o.recebido, 2250, 'pago = total');
assert.equal(o.forma, 'dinheiro'); assert.equal(o.eventoNome, 'Fotos de fim de ano 2026'); assert.equal(o.por, admin);
for (const [bad, msg] of [[{...base, responsavel: ''}, 'sem responsável'], [{...base, crianca: ''}, 'sem criança'], [{...base, telefone: '123'}, 'telefone curto'], [{...base, itens: []}, 'sem itens'], [{...base, itens: [{tam: '30x40', qtd: 1}]}, 'tamanho fora da lista'], [{...base, itens: [{tam: '10x15', qtd: 0}]}, 'quantidade zero'], [{...base, itens: [{tam: '10x15', qtd: 1.5}]}, 'quantidade quebrada'], [{...base, eventoId: 'nao-existe'}, 'evento inexistente'], [{...base, pagamento: 'parcial', recebido: 0}, 'parcial sem valor'], [{...base, pagamento: 'parcial', recebido: 99999}, 'parcial maior que o total'], [{...base, anexos: [{id: '00000000-0000-0000-0000-000000000000', nome: 'x', tipo: 'outro'}]}, 'anexo que não foi enviado'], [{...base, anexos: [{id: '../etc', nome: 'x'}]}, 'anexo inválido'], [{...base, data: '24/11/2026'}, 'data']])
  assert.equal((await call('/api/portal/fotos', admin, 'POST', {pedido: bad})).status, 400, msg);
// Pagamento em parte e pendente; mudar a quantidade muda a faixa.
await ped({...base, id: o.id, pagamento: 'parcial', recebido: 1000, itens: [{tam: '20x30', qtd: 10}], anexos: [{id: a1, nome: 'pedido.jpg', tipo: 'whatsapp'}, {id: a2, nome: 'pix.pdf', tipo: 'comprovante'}]});
d = await json('/api/portal/fotos', admin); o = d.pedidos[0]; assert.equal(d.pedidos.length, 1, 'editar não duplica');
assert.equal(o.unitario, 500, '10 fotos = R$ 5 cada'); assert.equal(o.total, 5000); assert.equal(o.recebido, 1000); assert.equal(o.pagamento, 'parcial'); assert.equal(o.anexos.length, 2);
await ped({...base, id: o.id, pagamento: 'pendente', recebido: 777});
d = await json('/api/portal/fotos', admin); o = d.pedidos[0]; assert.equal(o.recebido, 0, 'pendente zera o recebido'); assert.equal(o.anexos.length, 1);
assert.equal((await raw('/api/portal/anexo-pedido/' + a2, admin)).status, 404, 'anexo removido do pedido é apagado do armazenamento');
assert.equal((await raw('/api/portal/anexo-pedido/' + a1, admin)).status, 200, 'anexo mantido continua');
// Evento: encerrado não aceita pedido novo; com pedidos não se exclui; mudar o nome atualiza os pedidos.
await json('/api/portal/fotos', admin, 'POST', {evento: {id: ev.id, nome: 'Fotos 2026', faixas, aberto: false}});
assert.equal((await call('/api/portal/fotos', admin, 'POST', {pedido: {...base, anexos: []}})).status, 400, 'evento encerrado');
await ped({...base, id: o.id}); d = await json('/api/portal/fotos', admin); assert.equal(d.pedidos[0].eventoNome, 'Fotos 2026'); assert.equal(d.pedidos.length, 1, 'pedido antigo ainda pode ser editado');
assert.equal((await call('/api/portal/fotos', admin, 'POST', {excluirEvento: ev.id})).status, 400, 'evento com pedidos');
// Excluir o pedido apaga os anexos.
await json('/api/portal/fotos', admin, 'POST', {id: o.id, delete: true}); d = await json('/api/portal/fotos', admin); assert.equal(d.pedidos.length, 0);
assert.equal((await raw('/api/portal/anexo-pedido/' + a1, admin)).status, 404, 'anexo apagado junto com o pedido');
await json('/api/portal/fotos', admin, 'POST', {excluirEvento: ev.id}); assert.equal((await json('/api/portal/fotos', admin)).eventos.length, 0);

// Dados de crianças e telefones nunca saem na página pública nem no espaço do professor.
await json('/api/portal/fotos', admin, 'POST', {evento: {nome: 'Outro', faixas}});
const ev2 = (await json('/api/portal/fotos', admin)).eventos[0]; await ped({...base, eventoId: ev2.id, anexos: []});
const pub = JSON.stringify(await json('/api/public/home')); assert.ok(!pub.includes('João Souza') && !pub.includes('9999-0001') && !pub.includes('Maria Souza'));
const prof = JSON.stringify(await json('/api/data/state', teacher)); assert.ok(!prof.includes('João Souza') && !prof.includes('9999-0001') && !prof.includes('pedidos-fotos'));
await fs.rm(dir, {recursive: true, force: true});

// Telas: as funções chamadas em onclick existem em window; a aba está no menu e no ＋ Novo; o script é carregado.
const central = await fs.readFile('dist/central.js', 'utf8'), fotos = central;
for (const f of ['cxFoAba', 'cxFoFiltro', 'cxFoZap', 'cxFoForm', 'cxFoZapForm', 'cxFoSalvar', 'cxFoExcluir', 'cxFoAddItem', 'cxFoRemItem', 'cxFoAnexar', 'cxFoRemAnexo', 'cxFoEvForm', 'cxFoEvSalvar', 'cxFoEvAdd', 'cxFoEvRemover', 'cxFoEvExcluir', 'cxFoVerPedidos', 'cxFoReciboId', 'cxFoReciboForm', 'cxFoLerItens', 'cxFoResumo', 'cxFoRedesenhar', 'cxFoEvLer'])
  assert.match(fotos, new RegExp(`window\\.${f} = `), f);
assert.match(central, /make\('fotos'/); assert.match(central, /find\('fotos'\)/); assert.match(central, /state\.view === 'fotos'/); assert.match(central, /Novo pedido de foto/);
// Recibo: valor por extenso.
const ext = new Function(fotos.match(/function cxExtenso[\s\S]*?\n}\n/)[0] + ';return cxExtenso')();
assert.equal(ext(2250), 'vinte e dois reais e cinquenta centavos'); assert.equal(ext(100), 'um real'); assert.equal(ext(15000), 'cento e cinquenta reais'); assert.equal(ext(105000), 'mil e cinquenta reais'); assert.equal(ext(123456), 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
assert.match(fotos, /Presidente da APP/); assert.match(fotos, /cxLetterhead\(/);
console.log('PASS: fotos (pedidos): preço por faixa, pagamento (dinheiro, Pix, parcial), anexos privados e apagados junto, só administração, nada na página pública + telas, menu e recibo.');
