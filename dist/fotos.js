/* v68: página das famílias. A foto digital é grátis; a impressa é paga por Pix. Acesso por código da turma. */
(() => {
  'use strict';
  const TAMS = ['10x15', '15x21', '20x25', '20x30'], app = document.getElementById('app');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const money = c => (c / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  const tamTxt = t => t.replace('x', ' × ') + ' cm';
  const S = {c: '', dados: null, itens: [], tela: 'codigo', erro: '', enviando: false, ok: null, comp: null, ultimo: '10x15'};
  try { S.ultimo = localStorage.getItem('cei-fotos-tam') || '10x15'; if (!TAMS.includes(S.ultimo)) S.ultimo = '10x15'; } catch (e) {}

  /* ---------- Pix (BR Code) ---------- */
  const crc16 = s => { let c = 0xffff; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c.toString(16).toUpperCase().padStart(4, '0'); };
  const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function chavePix(k) { const t = String(k || '').trim(); return /^[\d.\-\/\s]+$/.test(t) && [11, 14].includes(t.replace(/\D/g, '').length) ? t.replace(/\D/g, '') : t; }
  function pixPayload(pix, centavos, txid) {
    const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chavePix(pix.chave));
    const corpo = campo('00', '01') + campo('01', '11') + campo('26', conta) + campo('52', '0000') + campo('53', '986') + (centavos > 0 ? campo('54', (centavos / 100).toFixed(2)) : '') + campo('58', 'BR') + campo('59', pix.nome) + campo('60', pix.cidade) + campo('62', campo('05', txid || '***')) + '6304';
    return corpo + crc16(corpo);
  }
  window.cxPixPayload = pixPayload;

  /* ---------- Preços (o servidor confere de novo) ---------- */
  const tamanhos = ev => ev.tabelas ? TAMS.filter(t => ev.tabelas[t]) : TAMS;
  function unit(ev, tam, q) { const fx = ev.tabelas ? ev.tabelas[tam] : ev.faixas; if (!fx) return null; const f = fx.find(x => q >= x.de && (x.ate == null || q <= x.ate)); return f ? f.valor : null; }
  function calcula() {
    const ev = S.dados.evento, por = {}; let fotos = 0;
    for (const i of S.itens) { por[i.tam] = (por[i.tam] || 0) + i.qtd; fotos += i.qtd; }
    const un = {}; let total = 0, falta = false;
    for (const [tam, q] of Object.entries(por)) { const u = unit(ev, tam, ev.tabelas ? q : fotos); if (u == null) { falta = true; un[tam] = null; } else { un[tam] = u; total += u * q; } }
    return {por, un, total, fotos, falta};
  }

  /* ---------- Chamadas ---------- */
  async function api(url, opt) { const r = await fetch(url, opt); let j = {}; try { j = await r.json(); } catch (e) {} if (!r.ok) throw new Error(j.error || 'Não foi possível concluir. Tente de novo.'); return j; }
  const norm = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  async function abrir(codigo) {
    S.erro = ''; S.c = norm(codigo);
    try { S.dados = await api('/api/public/galeria?c=' + encodeURIComponent(S.c)); S.tela = 'galeria'; history.replaceState(null, '', '#c=' + S.c); }
    catch (e) { S.erro = e.message; S.tela = 'codigo'; }
    desenha();
  }
  const imgUrl = (id, o, dl) => `/api/public/galeria/img/${id}?c=${S.c}${o ? '&t=o' : ''}${dl ? '&dl=1' : ''}`;

  /* ---------- Telas ---------- */
  function telaCodigo() {
    return `<h1>Fotos de fim de ano</h1><div class="card"><h2>Digite o código da turma</h2><p class="mut">A professora ou a secretaria enviou um código com letras e números. As fotos digitais são um presente do CEI para as famílias.</p>
      ${S.erro ? `<div class="erro" role="alert">${esc(S.erro)}</div>` : ''}
      <form id="fCod"><label for="cod">Código da turma</label><input id="cod" type="text" autocomplete="off" autocapitalize="characters" maxlength="14" value="${esc(S.c)}" style="text-transform:uppercase;letter-spacing:.12em;font-size:20px"><p style="margin:14px 0 0"><button class="pri" type="submit">Ver as fotos</button></p></form></div>`;
  }
  function cartaoFoto(f, ev) {
    const no = S.itens.some(i => i.id === f.id);
    return `<div class="foto"><img src="${imgUrl(f.id)}" alt="Foto de ${esc(f.crianca)}" loading="lazy"><div class="nm">${esc(f.crianca)}</div><div class="bt">
      <a class="btn" href="${imgUrl(f.id, 1, 1)}" download>Baixar foto (grátis)</a>
      ${ev.aberto ? `<button data-a="tog" data-id="${f.id}" class="${no ? 'pri' : 'out'}" aria-pressed="${no}">${no ? 'No pedido (tirar)' : 'Pedir impressão'}</button>` : ''}</div></div>`;
  }
  function carrinho() {
    const ev = S.dados.evento, c = calcula();
    if (!S.itens.length) return `<h2>Impressão</h2><p class="mut">Se quiser a foto revelada, toque em “Pedir impressão” na foto. A versão digital continua grátis.</p>`;
    const nome = id => S.dados.fotos.find(f => f.id === id)?.crianca || '';
    return `<h2>Seu pedido de impressão</h2>${S.itens.map(i => { const u = unit(ev, i.tam, ev.tabelas ? c.por[i.tam] : c.fotos);
      return `<div class="it"><b>${esc(nome(i.id))}</b><div class="tam" role="group" aria-label="Tamanho">${tamanhos(ev).map(t => `<button data-a="tam" data-id="${i.id}" data-t="${t}" class="${t === i.tam ? 'sel' : ''}" aria-pressed="${t === i.tam}">${t.replace('x', '×')}</button>`).join('')}</div>
        <div class="row"><div class="qt"><button data-a="menos" data-id="${i.id}" aria-label="Menos uma">−</button><b aria-live="polite">${i.qtd}</b><button data-a="mais" data-id="${i.id}" aria-label="Mais uma">+</button></div><span class="mut">${u == null ? 'sem preço' : money(u) + ' cada'}</span><b>${u == null ? '—' : money(u * i.qtd)}</b></div></div>`; }).join('')}
      <div class="row tot"><span>Total</span><span>${c.falta ? '—' : money(c.total)}</span></div>
      ${c.falta ? '<div class="erro">O evento não tem preço para essa quantidade neste tamanho. Mude a quantidade ou o tamanho.</div>' : ''}
      <p style="margin:12px 0 0"><button class="pri" style="width:100%" data-a="ir" ${c.falta ? 'disabled' : ''}>Continuar para o pagamento</button></p>`;
  }
  function telaGaleria() {
    const d = S.dados, ev = d.evento, n = S.itens.reduce((s, i) => s + i.qtd, 0), c = S.itens.length ? calcula() : null;
    return `<h1>${esc(ev.nome)}</h1><p class="mut" style="margin:0 0 8px">Turma: <b>${esc(d.turma)}</b></p>
      <div class="aviso">As fotos digitais são um presente do CEI: baixe quantas quiser, sem custo. <b>Só a foto impressa é paga.</b> Estas fotos são das crianças da turma; por favor, não publique na internet.</div>
      ${ev.aberto ? '' : '<div class="erro" style="margin-top:12px">Os pedidos de impressão deste evento já foram encerrados. Você ainda pode baixar as fotos.</div>'}
      <div class="dois" style="margin-top:14px"><section><div class="grid">${d.fotos.map(f => cartaoFoto(f, ev)).join('') || '<p>Ainda não há fotos nesta turma.</p>'}</div></section>
      ${ev.aberto ? `<aside id="carrinho" class="card" style="margin-top:0">${carrinho()}</aside>` : ''}</div>
      ${n && c && !c.falta ? `<div class="barra"><span><b>${n}</b> foto(s) · <b>${money(c.total)}</b></span><a class="btn pri" href="#carrinho" data-a="rolar">Ver pedido</a></div>` : ''}`;
  }
  function telaPedido() {
    const d = S.dados, ev = d.evento, c = calcula(), payload = pixPayload(ev.pix, c.total, 'FOTOS' + String(Date.now()).slice(-8));
    S.payload = payload;
    return `<p><button data-a="voltar">← Voltar às fotos</button></p><h1>Pagamento por Pix</h1>
      ${S.erro ? `<div class="erro" role="alert">${esc(S.erro)}</div>` : ''}
      <div class="card"><h2>Resumo</h2>${Object.entries(c.por).map(([t, q]) => `<div class="row"><span>${q} × foto ${tamTxt(t)}</span><b>${money(c.un[t] * q)}</b></div>`).join('')}<div class="row tot"><span>Total</span><span>${money(c.total)}</span></div></div>
      <div class="card"><h2>1. Pague pelo aplicativo do seu banco</h2><div class="pix"><canvas id="qr" width="220" height="220" aria-label="QR code do Pix"></canvas>
        <div style="flex:1 1 240px"><p class="mut" style="margin:0">Quem recebe</p><b>${esc(ev.pix.nome)}</b><p class="mut" style="margin:8px 0 0">Valor</p><b style="font-size:22px">${money(c.total)}</b>
        <p class="mut">Aponte a câmera do banco para o QR code ou copie o código e use “Pix copia e cola”.</p></div></div>
        <label for="cc">Pix copia e cola</label><textarea id="cc" class="copia" readonly>${esc(payload)}</textarea><p style="margin:8px 0 0"><button data-a="copiar">Copiar código Pix</button> <span id="cp" class="mut" role="status"></span></p></div>
      <div class="card"><h2>2. Seus dados e o comprovante</h2><form id="fPed" novalidate>
        <label for="rs">Nome do pai, mãe ou responsável</label><input id="rs" type="text" autocomplete="name" maxlength="100">
        <label for="tl">Telefone com DDD (para avisar quando ficar pronto)</label><input id="tl" type="tel" inputmode="tel" autocomplete="tel" maxlength="20">
        <label for="cp2">Comprovante do Pix (foto ou PDF)</label><input id="cp2" type="file" accept="image/*,application/pdf"><p class="mut" id="cpn" style="margin:6px 0 0">${S.comp ? 'Anexado: ' + esc(S.comp.name) : 'Depois de pagar, anexe aqui o comprovante.'}</p>
        <div class="hp" aria-hidden="true"><label>Não preencha<input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>
        <p style="margin:16px 0 0"><button class="pri" style="width:100%" type="submit" ${S.enviando ? 'disabled' : ''}>${S.enviando ? 'Enviando…' : 'Enviar pedido'}</button></p></form>
        <p class="mut">O pedido só é aceito depois que a escola conferir o Pix. Avisaremos pelo telefone informado.</p></div>`;
  }
  function telaOk() {
    return `<h1>Pedido recebido!</h1><div class="card"><p>Número do pedido: <b style="font-size:22px">${esc(S.ok.pedido)}</b></p><p>Total: <b>${money(S.ok.total)}</b></p>
      <p>A escola vai conferir o Pix e preparar as fotos. Avisaremos pelo telefone que você informou quando ficarem prontas.</p><p><button class="pri" data-a="voltar">Voltar às fotos</button></p></div>`;
  }
  function desenha() {
    app.innerHTML = S.tela === 'codigo' ? telaCodigo() : S.tela === 'galeria' ? telaGaleria() : S.tela === 'pedido' ? telaPedido() : telaOk();
    if (S.tela === 'pedido') qrNoCanvas(); window.scrollTo(0, 0);
  }
  function redesenhaParcial() { // atualiza só a parte que muda, sem pular a rolagem
    const y = window.scrollY; app.innerHTML = telaGaleria(); window.scrollTo(0, y);
  }
  function qrNoCanvas() {
    const cv = document.getElementById('qr'); if (!cv || !window.cxQR) return;
    try { const m = window.cxQR(S.payload), q = 4, k = Math.floor(cv.width / (m.length + 2 * q)), ctx = cv.getContext('2d'), off = Math.floor((cv.width - k * m.length) / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#000'; m.forEach((r, y) => r.forEach((b, x) => { if (b) ctx.fillRect(off + x * k, off + y * k, k, k); })); }
    catch (e) { cv.style.display = 'none'; }
  }

  /* ---------- Comprovante (reduz a imagem; PDF até 1,5 MB) ---------- */
  async function reduzir(file) {
    if (file.type === 'application/pdf') { if (file.size > 1500 * 1024) throw new Error('O PDF passa de 1,5 MB. Envie uma foto ou print do comprovante.'); return {blob: file, name: file.name}; }
    if (!/^image\//.test(file.type)) throw new Error('Anexe uma foto, um print ou um PDF.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Não consegui abrir a imagem.')); i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      let blob = null; for (const q of [0.82, 0.68, 0.5]) { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= 1400 * 1024) break; }
      if (!blob || blob.size > 1500 * 1024) throw new Error('A imagem ficou grande demais.');
      return {blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg'};
    } finally { URL.revokeObjectURL(url); }
  }
  async function enviar(form) {
    const rs = form.querySelector('#rs').value.trim(), tl = form.querySelector('#tl').value.trim(), site = form.querySelector('[name=site]').value;
    S.erro = '';
    try {
      if (!rs) throw new Error('Informe o nome do responsável.');
      if (tl.replace(/\D/g, '').length < 10) throw new Error('Informe o telefone com DDD.');
      if (!S.comp) throw new Error('Anexe o comprovante do Pix.');
      S.enviando = true; app.querySelector('button[type=submit]').disabled = true;
      const up = await api('/api/public/galeria/anexo?c=' + S.c, {method: 'POST', body: S.comp.blob});
      const r = await api('/api/public/galeria/pedido', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({c: S.c, responsavel: rs, telefone: tl, site, anexo: {id: up.id, nome: S.comp.name}, itens: S.itens.map(i => ({fotoId: i.id, tam: i.tam, qtd: i.qtd}))})});
      S.ok = r; S.itens = []; S.comp = null; S.tela = 'ok';
    } catch (e) { S.erro = e.message; const v = {rs, tl}; S.enviando = false; desenha(); app.querySelector('#rs').value = v.rs; app.querySelector('#tl').value = v.tl; window.scrollTo(0, 0); return; }
    S.enviando = false; desenha();
  }

  /* ---------- Eventos ---------- */
  const achar = id => S.itens.find(i => i.id === id);
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
    if (a === 'tog') { if (achar(id)) S.itens = S.itens.filter(i => i.id !== id); else S.itens.push({id, tam: tamanhos(S.dados.evento).includes(S.ultimo) ? S.ultimo : tamanhos(S.dados.evento)[0], qtd: 1}); redesenhaParcial(); }
    else if (a === 'tam') { achar(id).tam = b.dataset.t; S.ultimo = b.dataset.t; try { localStorage.setItem('cei-fotos-tam', S.ultimo); } catch (x) {} redesenhaParcial(); }
    else if (a === 'mais') { const i = achar(id); i.qtd = Math.min(50, i.qtd + 1); redesenhaParcial(); }
    else if (a === 'menos') { const i = achar(id); i.qtd = Math.max(1, i.qtd - 1); redesenhaParcial(); }
    else if (a === 'ir') { S.tela = 'pedido'; S.erro = ''; desenha(); }
    else if (a === 'voltar') { S.tela = 'galeria'; S.erro = ''; desenha(); }
    else if (a === 'rolar') { e.preventDefault(); document.getElementById('carrinho')?.scrollIntoView({behavior: 'smooth'}); }
    else if (a === 'copiar') { const t = document.getElementById('cc'), msg = document.getElementById('cp'); const ok = () => { msg.textContent = 'Código copiado.'; };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(S.payload).then(ok, () => { t.select(); document.execCommand('copy'); ok(); }); else { t.select(); document.execCommand('copy'); ok(); } }
  });
  app.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'fCod') abrir(e.target.querySelector('#cod').value); else if (e.target.id === 'fPed' && !S.enviando) enviar(e.target); });
  app.addEventListener('change', async e => {
    if (e.target.id !== 'cp2' || !e.target.files[0]) return; const nota = document.getElementById('cpn');
    try { S.comp = await reduzir(e.target.files[0]); nota.textContent = 'Anexado: ' + S.comp.name; } catch (x) { S.comp = null; e.target.value = ''; nota.textContent = x.message; }
  });
  const m = location.hash.match(/c=([A-Za-z0-9-]+)/); if (m) abrir(m[1]); else desenha();
})();
