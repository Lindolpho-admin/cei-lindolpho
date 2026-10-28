// CEI Lindolpho v39 — Arquivo central, Financeiro (saldos), papel timbrado livre,
// painel inicial com pendências, menu agrupado e menu no celular.
// Carregado depois de app.js, portal.js, child-report.js e food-practice.js.
(() => {
const CX_VERSION = '47';
window.CEI_VERSION = CX_VERSION;
const CX_SESSION = window.CEI_SESSION || {};
const CX_TEACHER = CX_SESSION.role === 'teacher';
const CX_ADMIN = CX_SESSION.role === 'admin';

/* ---------- Catálogos ---------- */
const CX_AREAS = {
  institucional: {label: 'Documentos institucionais', hint: 'Regimento, PPP, calendário'},
  reuniao_geral: {label: 'Reuniões gerais e outras', hint: 'Equipe, assembleias, outras'},
  pedagogica: {label: 'Reuniões pedagógicas', hint: 'Planejamento, formação'},
  familias: {label: 'Reuniões com famílias', hint: 'Crianças e responsáveis'},
  conselho: {label: 'Conselho Escolar', hint: 'Atas, mandatos, editais'},
  app: {label: 'APP', hint: 'Estatuto, diretoria, atas'},
  compras: {label: 'Compras e orçamentos', hint: 'Orçamentos, aprovações'},
  financeiro: {label: 'Financeiro', hint: 'Notas, extratos, repasses'},
  secretaria: {label: 'Secretaria e direção', hint: 'Ofícios, documentos'},
  outros: {label: 'Outros', hint: 'Demais registros'},
};
const CX_KINDS = {
  ata: 'Ata de reunião', ata_compra: 'Ata de aprovação de compra', lista_presenca: 'Lista de presença',
  pauta: 'Pauta / convocação / edital', orcamento: 'Orçamento', pesquisa_precos: 'Pesquisa / mapa de preços',
  nota_fiscal: 'Nota fiscal', recibo: 'Recibo', comprovante: 'Comprovante de pagamento',
  extrato: 'Extrato bancário', repasse: 'Repasse / crédito recebido', lancamento: 'Lançamento sem documento',
  contrato: 'Contrato', oficio_recebido: 'Ofício recebido', oficio_enviado: 'Ofício enviado',
  comunicado: 'Comunicado', relatorio: 'Relatório', projeto: 'Projeto', plano: 'Plano de aplicação / plano',
  termo: 'Termo / autorização', regimento: 'Regimento interno', ppp: 'Projeto Político-Pedagógico (PPP)', calendario: 'Calendário escolar', cardapio: 'Cardápio', estatuto: 'Estatuto / regimento de colegiado', foto: 'Registro fotográfico', outro: 'Outro documento',
};
// Tipos antigos do acervo da APP (exibição)
const CX_LEGACY_KINDS = {cotacao: 'Orçamento', resolucao: 'Resolução', parecer: 'Parecer', demonstrativo: 'Demonstrativo', conciliacao: 'Conciliação bancária'};
const CX_KIND_AREA = {ata_compra: 'compras', orcamento: 'compras', pesquisa_precos: 'compras', nota_fiscal: 'financeiro', recibo: 'financeiro', comprovante: 'financeiro', extrato: 'financeiro', repasse: 'financeiro', lancamento: 'financeiro', regimento: 'institucional', ppp: 'institucional', calendario: 'institucional', cardapio: 'institucional', estatuto: 'app', oficio_recebido: 'secretaria', oficio_enviado: 'secretaria'};
const CX_KIND_MOVE = {nota_fiscal: 'saida', recibo: 'saida', comprovante: 'saida', repasse: 'entrada', extrato: 'saldo_extrato', lancamento: 'saida'};
const CX_ACCOUNTS = {
  SICOOB: {label: 'Sicoob · APP', sub: 'Recursos próprios da APP', natures: false},
  PDDE_Basico: {label: 'PDDE Básico (Base)', sub: 'Banco do Brasil', natures: true},
  PDDE_Qualidade: {label: 'PDDE Qualidade', sub: 'Banco do Brasil · outras ações', natures: true},
  Educacao_Conectada: {label: 'Educação Conectada', sub: 'Banco do Brasil · PDDE Qualidade', natures: true},
  OUTRA: {label: 'Outra conta / recurso', sub: 'Outros recursos', natures: true},
};
const CX_MOVES = {entrada: 'Entrada (crédito)', saida: 'Saída (despesa)', saldo_extrato: 'Saldo informado no extrato', saldo_inicial: 'Saldo inicial / reprogramado do ano'};
const CX_NATURES = {'': 'Não se aplica', custeio: 'Custeio', capital: 'Capital'};
const CX_STATEMENTS = {conta_corrente: 'Conta corrente', investimentos: 'Aplicação / investimento', consolidado: 'Consolidado (corrente + aplicação)'};
const CX_CATS = {
  saida: ['Material de consumo', 'Material permanente / equipamento', 'Material pedagógico', 'Limpeza e higiene', 'Manutenção e pequenos reparos', 'Serviços de terceiros (pessoa jurídica)', 'Serviços de terceiros (pessoa física)', 'Alimentação e eventos', 'Tecnologia e internet', 'Tarifa bancária', 'Devolução / estorno', 'Outras despesas'],
  entrada: ['Repasse FNDE', 'Repasse municipal', 'Rendimento de aplicação', 'Contribuição das famílias', 'Evento / festa / rifa', 'Doação', 'Estorno / devolução recebida', 'Outras receitas'],
};
const CX_GEN_KIND = {oficio: 'Ofício', meimei: 'Encaminhamento Meimei', verdes: 'Encaminhamento Verdes Mares', encaminhamento: 'Encaminhamento', declaracao: 'Declaração', usoImagem: 'Termo de uso de imagem', solicitacaoMateriais: 'Solicitação de materiais', relatorioAvaliativo: 'Relatório avaliativo', praticaAlimentar: 'Registro de prática alimentar', documentoTimbrado: 'Documento timbrado'};
const CX_GEN_AREA = {relatorioAvaliativo: 'pedagogica', praticaAlimentar: 'pedagogica'};
const CX_MODELS = {
  comunicado: {ico: '📣', label: 'Comunicado às famílias', hint: 'Avisos gerais para pais e responsáveis', title: 'Comunicado', recipient: 'Senhores pais e responsáveis', body: '<p>Senhores pais e responsáveis,</p><p>Comunicamos que </p><p>Contamos com a colaboração de todos.</p>', sign: true, date: true},
  bilhete: {ico: '✉️', label: 'Bilhete', hint: 'Recado curto para a família', title: 'Bilhete', recipient: '', body: '<p>Família de ______________________,</p><p></p>', sign: true, date: true},
  autorizacao: {ico: '✅', label: 'Autorização', hint: 'Passeio, atividade, evento — com canhoto', title: 'Autorização', recipient: '', body: '<p>Senhores pais e responsáveis,</p><p>No dia ___/___/______, realizaremos </p><p>Solicitamos que preencham e devolvam a autorização abaixo até ___/___/______.</p>', sign: true, date: true, slip: true},
  convite: {ico: '🎉', label: 'Convite', hint: 'Festas, reuniões, apresentações', title: 'Convite', recipient: '', body: '<p style="text-align:center">Temos a alegria de convidar sua família para</p><p style="text-align:center"><b></b></p><p style="text-align:center">Data: ___/___/______ · Horário: ______ · Local: CEI Lindolpho José da Silva</p>', sign: true, date: false},
  atividade: {ico: '🖍️', label: 'Atividade / material', hint: 'Folha de atividade ou material pedagógico', title: 'Atividade', recipient: '', body: '<p>Nome: ________________________________ Turma: __________</p><p></p>', sign: false, date: false},
  livre: {ico: '📄', label: 'Documento livre', hint: 'Qualquer texto no papel timbrado', title: '', recipient: '', body: '<p></p>', sign: true, date: true},
};
const CX_PUBCATS = {
  regimento: {label: 'Regimento interno', ico: '📘'}, ppp: {label: 'Projeto Político-Pedagógico (PPP)', ico: '🎯'},
  conselho: {label: 'Conselho Escolar', ico: '🤝'}, app: {label: 'APP — Associação de Pais e Professores', ico: '👨‍👩‍👧'},
  calendario: {label: 'Calendário escolar', ico: '📅'}, cardapio: {label: 'Cardápio', ico: '🍎'},
  comunicados: {label: 'Comunicados e informativos', ico: '📣'}, outros: {label: 'Outros documentos', ico: '📄'},
};
function cxGuessPub(r) {
  const t = cxNorm(r.title);
  if (r.kind === 'ppp' || /\bppp\b|projeto politico/.test(t)) return 'ppp';
  if (r.kind === 'calendario' || /calendario/.test(t)) return 'calendario';
  if (r.kind === 'cardapio' || /cardapio/.test(t)) return 'cardapio';
  if (r.area === 'conselho' || /conselho/.test(t)) return 'conselho';
  if (r.area === 'app' || /\bapp\b|associacao de pais/.test(t)) return 'app';
  if (r.kind === 'regimento' || /regimento/.test(t)) return 'regimento';
  if (r.kind === 'comunicado') return 'comunicados';
  return 'outros';
}
const CX_SLIP = 'Eu, ____________________________________________, responsável pela criança ____________________________________________, da turma ______________, ( ) autorizo ( ) não autorizo a participação descrita acima.';

/* ---------- Utilidades ---------- */
const cxEsc = v => (typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m])));
const cxNorm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
const cxToday = () => new Date().toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
const cxBR = iso => { const [y, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${y}` : (iso || ''); };
const cxMonthName = m => new Intl.DateTimeFormat('pt-BR', {month: 'long', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, Number(m) - 1, 1)));
const cxLongDate = iso => { const [y, m, d] = String(iso || '').split('-').map(Number); return y && m && d ? new Intl.DateTimeFormat('pt-BR', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(Date.UTC(y, m - 1, d))) : ''; };
const cxMoney = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const cxParseMoney = v => { let s = String(v || '').replace(/[^\d,.-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const cxMoneyInput = cents => cents || cents === 0 ? (Number(cents) / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '';
const cxId = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const cxToast = msg => (typeof notify === 'function' ? notify(msg) : null);
async function cxRequest(url, options = {}) {
  const r = await fetch(url, {cache: 'no-store', ...options});
  let data = {}; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
const cxViewable = f => f && ['application/pdf', 'image/jpeg', 'image/png'].includes(f.mime);

/* ---------- Dados do arquivo ---------- */
const cx = {records: [], loaded: false, loading: null, loadedAt: 0, publicIds: new Set(), requests: [],
  filter: {q: '', area: '', kind: '', year: '', processo: '', source: ''}, finYear: String(new Date().getFullYear()), finAccount: '', finFilter: {nature: '', category: '', move: ''}};
window.cxState = cx;
window.cxLoad = (...a) => cxLoad(...a);
window.cxFinanceCalc = (...a) => cxFinance(...a);

function cxAreaOf(r) {
  if (r.central && CX_AREAS[r.area]) return r.area;
  if (['cotacao', 'pesquisa_precos'].includes(r.kind)) return 'compras';
  if (r.kind === 'ata' || r.kind === 'resolucao' || r.kind === 'parecer' || /estatuto/i.test(r.title || '') || (r.section && r.section !== 'financeiro')) return 'app';
  return 'financeiro';
}
const cxKindLabel = r => CX_KINDS[r.kind] || CX_LEGACY_KINDS[r.kind] || 'Documento';
async function cxLoad(force = false) {
  if (!CX_ADMIN) return [];
  if (!force && cx.loaded && Date.now() - cx.loadedAt < 30000) return cx.records;
  if (cx.loading) return cx.loading;
  cx.loading = (async () => {
    try {
      const [records, pubs] = await Promise.all([cxRequest('/api/app/documents'), cxRequest('/api/portal/publications').catch(() => ({ids: []}))]);
      cx.records = records; cx.publicIds = new Set(pubs.ids || []); cx.publicMeta = pubs.meta || {}; cx.loaded = true; cx.loadedAt = Date.now();
      cxRequest('/api/portal/requests').then(list => { cx.requests = list; cxUpdateBadges(); }).catch(() => {});
      return records;
    } finally { cx.loading = null; }
  })();
  return cx.loading;
}
function cxGeneratedItems() {
  const out = [];
  (state.oficios || []).forEach(o => out.push({src: 'gen', gen: 'oficio', id: o.id, title: `Ofício nº ${o.numero || ''}/${o.ano || ''} — ${o.assunto || o.destinatario || ''}`, date: o.data || (o.createdAt || '').slice(0, 10), area: 'secretaria', notes: o.destinatario || '', signed: !!o.signedPdfData}));
  (state.generatedDocs || []).filter(g => g.template !== 'oficio').forEach(g => {
    const iso = g.data?.date || g.data?.data || (g.createdAt || '').slice(0, 10);
    out.push({src: 'gen', gen: g.template, id: g.id, title: g.name || CX_GEN_KIND[g.template] || 'Documento', date: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : (g.createdAt || '').slice(0, 10), area: CX_GEN_AREA[g.template] || 'secretaria', notes: [g.reference && g.reference !== '—' ? g.reference : '', g.template === 'documentoTimbrado' && g.ownerEmail ? 'Autor: ' + g.ownerEmail : ''].filter(Boolean).join(' · ')});
  });
  return out;
}
function cxAllItems() {
  const files = cx.records.map(r => ({src: 'rec', id: r.id, r, title: r.title, date: r.date || (r.competence ? r.competence + '-01' : ''), area: cxAreaOf(r), kind: r.kind, notes: r.notes || '', processo: r.processo || ''}));
  return files.concat(cxGeneratedItems());
}
function cxHaystack(x) {
  const r = x.r || {};
  const [y, m] = String(x.date || '').split('-');
  return cxNorm([x.title, x.notes, x.processo, r.tags, cxKindLabel(r), CX_GEN_KIND[x.gen], CX_AREAS[x.area]?.label, r.file?.originalName, r.file?.name, cxBR(x.date), m ? cxMonthName(m) : '', y,
    r.fin ? [CX_ACCOUNTS[r.fin.account]?.label, r.fin.category, r.fin.supplier, r.fin.docNumber, cxMoney(r.fin.amount), CX_NATURES[r.fin.nature]] : '', r.program].flat().join(' '));
}

/* ---------- Menu agrupado, rodapé e celular ---------- */
function cxBuildNav() {
  const nav = document.getElementById('nav'); if (!nav) return;
  const aside = nav.closest('aside');
  // Rodapé do menu (substitui o rodapé simples)
  const oldFooter = nav.nextElementSibling;
  if (oldFooter && !oldFooter.classList.contains('cx-nav-footer')) oldFooter.remove();
  const footer = document.createElement('div'); footer.className = 'cx-nav-footer';
  footer.innerHTML = `<div class="cx-who">${cxEsc(CX_SESSION.email || '')}</div><span class="cx-role">${CX_ADMIN ? 'Administração' : 'Professor(a)'}</span><div class="cx-links"><button type="button" onclick="retryShared()">↻ Reconectar</button>${location.hostname.endsWith('.chatgpt.site') ? '' : '<a href="/trocar-senha?return_to=%2Frestrito">Trocar senha</a>'}<a href="/">Área pública</a><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sair</a></div><div style="margin-top:10px;font-size:11px;opacity:.7">Sistema CEI · versão ${CX_VERSION}</div>`;
  nav.after(footer);
  const brand = aside?.querySelector('.brand span');
  if (brand && CX_TEACHER) brand.innerHTML = 'Espaço do <b>Professor</b><small>CEI Lindolpho</small>';
  else if (brand) brand.innerHTML = 'CEI <b>Lindolpho</b><small>Administração escolar</small>';
  // Botão do menu no celular
  const main = document.querySelector('main');
  if (main && !document.getElementById('cxMenuBtn')) {
    const btn = document.createElement('button'); btn.id = 'cxMenuBtn'; btn.className = 'cx-menu-btn'; btn.type = 'button';
    btn.innerHTML = '☰ Menu'; btn.setAttribute('aria-label', 'Abrir menu'); btn.onclick = () => document.body.classList.add('cx-nav-open');
    main.prepend(btn);
    const scrim = document.createElement('div'); scrim.className = 'cx-scrim'; scrim.onclick = () => document.body.classList.remove('cx-nav-open');
    document.body.append(scrim);
  }
  nav.addEventListener('click', e => { if (e.target.closest('button')) document.body.classList.remove('cx-nav-open'); });
  if (CX_TEACHER) {
    nav.innerHTML = '';
    const items = [['dashboard', '⌂ Início'], ['timbrado', '📄 Papel timbrado'], ['documentos', '▣ Relatórios e registros'], ['biblioteca', '📚 Biblioteca'], ['enturmacao', '🎂 Ver enturmação']];
    for (const [view, label] of items) { const b = document.createElement('button'); b.dataset.view = view; b.textContent = label; b.onclick = () => { state.view = view; render(); }; nav.append(b); }
    return;
  }
  if (!CX_ADMIN) return;
  const byView = v => nav.querySelector(`button[data-view="${v}"]`);
  const byText = t => [...nav.querySelectorAll('button')].find(b => b.textContent.includes(t));
  const make = (view, label, preset) => { const b = document.createElement('button'); b.dataset.view = view; if (preset) b.dataset.cxPreset = JSON.stringify(preset); b.innerHTML = label; b.onclick = () => cxGo(view, preset); return b; };
  const acessos = byText('Acessos e publicações'), solic = byText('Solicitações de empréstimo');
  if (acessos) { acessos.dataset.view = 'acessos'; acessos.innerHTML = '⚙ Equipe, acessos e publicações'; }
  if (solic) { solic.dataset.view = 'solicitacoes'; solic.innerHTML = '⇄ Pedidos de empréstimo <span class="cx-count" id="cxReqCount" hidden></span>'; }
  const doc = byView('documentos'); if (doc) doc.innerHTML = '✎ Emitir documentos';
  const dash = byView('dashboard'); if (dash) dash.innerHTML = '⌂ Início';
  const bib = byView('biblioteca'); if (bib) bib.innerHTML = '📚 Biblioteca';
  const esp = byView('espera'); if (esp) esp.innerHTML = '♙ Lista de espera';
  const seg = byView('seguranca'); if (seg) seg.innerHTML = '🛡 Backup e segurança';
  const hidden = ['agenda', 'pendencias', 'relatorios', 'atas', 'conselho', 'app'].map(byView).filter(Boolean);
  hidden.forEach(b => { b.hidden = true; });
  const group = t => { const d = document.createElement('div'); d.className = 'cx-nav-group'; d.textContent = t; return d; };
  const frag = document.createDocumentFragment();
  frag.append(dash || make('dashboard', '⌂ Início'));
  frag.append(group('Arquivo e documentos'), make('arquivo', '🗂 Arquivo central', {}), make('atas', '✎ Atas de reunião'), make('arquivo', '🛒 Compras e orçamentos', {area: 'compras'}));
  if (doc) frag.append(doc); frag.append(make('timbrado', '📄 Papel timbrado'));
  frag.append(group('Financeiro'), make('financeiro', '💰 Saldos e lançamentos'));
  frag.append(group('Colegiados'), make('arquivo', '◇ Conselho Escolar', {area: 'conselho'}), make('arquivo', '◉ APP', {area: 'app'}));
  frag.append(group('Secretaria'), make('enturmacao', '🎂 Ver enturmação'));
  if (esp) frag.append(esp); if (bib) frag.append(bib); if (solic) frag.append(solic);
  frag.append(group('Sistema'), make('publica', '🌐 Página pública'));
  if (acessos) frag.append(acessos); if (seg) frag.append(seg);
  hidden.forEach(b => frag.append(b));
  nav.innerHTML = ''; nav.append(frag);
}
function cxUpdateBadges() {
  const el = document.getElementById('cxReqCount'); if (!el) return;
  const n = (cx.requests || []).filter(r => r.status === 'pending').length;
  el.hidden = !n; el.textContent = n;
}
function cxMarkActive() {
  const preset = JSON.stringify(cx.navPreset || {});
  document.querySelectorAll('#nav button').forEach(b => {
    let on = b.dataset.view === state.view;
    if (on && state.view === 'arquivo') on = (b.dataset.cxPreset || '{}') === preset;
    b.classList.toggle('active', on);
  });
}
window.cxGo = (view, preset) => {
  state.view = view;
  if (view === 'arquivo') {
    cx.navPreset = preset || {};
    cx.filter = {q: '', area: '', kind: '', year: '', processo: '', source: '', ...(preset || {})};
  }
  render();
  window.scrollTo({top: 0});
};

/* ---------- Render principal (intercepta as novas telas) ---------- */
titles.arquivo = ['Arquivo central', 'Todos os documentos da administração em um só lugar'];
titles.financeiro = ['Financeiro', 'Saldos por conta, custeio e capital, com conferência pelo extrato'];
titles.enturmacao = ['Ver enturmação', 'Em qual turma a criança deve estudar, pela data de nascimento'];
titles.atas = ['Atas de reunião', 'Pedagógicas, com famílias, Conselho Escolar, APP e outras'];
titles.publica = ['Página pública', 'O que famílias e comunidade veem no site, sem login'];
titles.timbrado = ['Papel timbrado', 'Comunicados, bilhetes, autorizações e documentos no padrão do CEI'];
const cxBaseRender = render;
render = function () {
  const a = document.getElementById('app');
  if (!CX_SESSION.role) return cxNoServer();
  const setHead = v => { document.getElementById('title').textContent = titles[v][0]; document.getElementById('subtitle').textContent = titles[v][1]; };
  if (state.view === 'timbrado') { setHead('timbrado'); cxMarkActive(); return cxRenderTimbrado(a); }
  if (CX_ADMIN && state.view === 'arquivo') { setHead('arquivo'); cxMarkActive(); return cxRenderArchive(a); }
  if (state.view === 'enturmacao') { setHead('enturmacao'); cxMarkActive(); return cxRenderEnturmacao(a); }
  if (CX_ADMIN && state.view === 'atas') { setHead('atas'); cxMarkActive(); return cxRenderAtas(a); }
  if (CX_ADMIN && state.view === 'publica') { setHead('publica'); cxMarkActive(); return cxRenderPublic(a); }
  if (CX_ADMIN && state.view === 'financeiro') { setHead('financeiro'); cxMarkActive(); return cxRenderFinance(a); }
  if (CX_TEACHER && state.view === 'dashboard') { cxBaseRender(); cxMarkActive(); return cxRenderTeacherHome(a); }
  cxBaseRender();
  cxMarkActive();
  if (CX_ADMIN && state.view === 'dashboard') cxRenderDashboard(a);
  if (CX_TEACHER && state.view === 'documentos') {
    document.getElementById('title').textContent = 'Relatórios e registros';
    const intro = document.createElement('div'); intro.className = 'panel';
    intro.innerHTML = '<div class="cx-head"><div><h2>Relatórios e registros pedagógicos</h2><p>Relatórios avaliativos e registros de prática alimentar. Para comunicados, bilhetes e atividades, use o Papel timbrado.</p></div><button class="cx-btn" onclick="cxGo(\'timbrado\')">📄 Abrir papel timbrado</button></div>';
    a.prepend(intro);
  }
};

/* ---------- Painel inicial (administração) ---------- */
function cxRenderDashboard(a) {
  document.getElementById('title').textContent = 'Início';
  document.getElementById('subtitle').textContent = 'O que precisa de atenção hoje';
  const hoje = cxToday();
  a.innerHTML = `<section class="cx-hero"><h2>Olá! O que você procura?</h2><p>Atas, orçamentos, notas, extratos, ofícios, encaminhamentos — tudo é pesquisado no Arquivo central.</p>
    <form class="cx-search" onsubmit="event.preventDefault();cxGo('arquivo',{});cx_setQuery(this.q.value)"><input name="q" type="search" placeholder="Ex.: ata conselho março, orçamento ventilador, nota fiscal Sicoob…" aria-label="Pesquisar no arquivo"></form>
    <div class="cx-btns"><button class="cx-btn" onclick="cxOpenUpload()">⬆ Enviar documentos</button><button class="cx-btn" onclick="cxGo('atas')">✎ Redigir ata</button><button class="cx-btn" onclick="cxOpenUpload({kind:'nota_fiscal',area:'financeiro'})">🧾 Lançar nota fiscal</button><button class="cx-btn" onclick="cxOpenTimbrado('comunicado')">📄 Novo comunicado</button><button class="cx-btn" onclick="cxGoDecl()">🕒 Declaração de comparecimento</button><button class="cx-btn" onclick="newOficio()">✉ Novo ofício</button></div></section>
    <div class="cx-cols"><div class="panel" style="margin-top:0"><h2>Precisa de atenção</h2><ul class="cx-todo" id="cxTodo"><li class="muted">Carregando…</li></ul></div>
    <div class="panel" style="margin-top:0"><div class="cx-head"><h2>Saldos ${cxEsc(cx.finYear)}</h2><button class="cx-btn small" onclick="cxGo('financeiro')">Ver financeiro</button></div><div id="cxDashSaldos" class="muted">Carregando…</div></div></div>
    <div class="panel"><div class="cx-head"><h2>Enviados recentemente</h2><button class="cx-btn small" onclick="cxGo('arquivo',{})">Abrir arquivo</button></div><div id="cxRecent" class="muted">Carregando…</div></div>
    <div class="cx-stats"><div class="cx-stat"><small>Livros no acervo</small><b>${(state.books || []).length}</b></div><div class="cx-stat"><small>Empréstimos ativos</small><b>${(state.loans || []).filter(l => !l.returned).length}</b></div><div class="cx-stat"><small>Vagas na lista de espera</small><b>${(state.waitlist || []).length}</b></div><div class="cx-stat"><small>Documentos emitidos</small><b>${(state.generatedDocs || []).length + (state.oficios || []).length}</b></div><div class="cx-stat"><small>Arquivos no arquivo central</small><b id="cxStatFiles">…</b></div></div>`;
  cxLoad().then(() => {
    if (state.view !== 'dashboard') return;
    const todo = [];
    const pend = (cx.requests || []).filter(r => r.status === 'pending').length;
    const late = (state.loans || []).filter(l => !l.returned && l.due && l.due < hoje).length;
    const semResp = (state.waitlist || []).filter(w => w.status === 'sem_resposta').length;
    const ofSemPdf = (state.oficios || []).filter(o => o.status === 'finalizado' && !o.signedPdfData).length;
    const atasSem = cx.records.filter(r => (r.kind === 'ata' || r.kind === 'ata_compra') && (r.typed || r.body) && !r.signedFile).length;
    if (pend) todo.push([pend, 'pedido(s) de empréstimo aguardando aprovação', "portalNavigate('solicitacoes')"]);
    if (late) todo.push([late, 'empréstimo(s) com devolução atrasada', "cxGo('biblioteca')"]);
    if (semResp) todo.push([semResp, 'vaga(s) sem resposta da família', "cxGo('espera')"]);
    if (ofSemPdf) todo.push([ofSemPdf, 'ofício(s) finalizado(s) sem PDF assinado', "cxGo('documentos')"]);
    if (atasSem) todo.push([atasSem, 'ata(s) redigida(s) sem PDF assinado', "cxGo('arquivo',{kind:'ata'})"]);
    const fin = cxFinance(cx.finYear);
    fin.accounts.filter(x => x.recon && Math.abs(x.recon.diff) >= 1).forEach(x => todo.push(['R$', `${CX_ACCOUNTS[x.account].label}: diferença de ${cxMoney(x.recon.diff)} em relação ao extrato de ${cxBR(x.recon.date)}`, "cxGo('financeiro')"]));
    document.getElementById('cxTodo').innerHTML = todo.length ? todo.map(([n, t, go]) => `<li><span><b class="cx-n">${n}</b>${cxEsc(t)}</span><button class="cx-btn small" onclick="${go}">Abrir</button></li>`).join('') : '<li><span>✓ Nada pendente. Tudo em dia.</span></li>';
    const used = fin.accounts.filter(x => x.count);
    document.getElementById('cxDashSaldos').innerHTML = used.length ? `<ul class="cx-todo">${used.map(x => `<li><span>${cxEsc(CX_ACCOUNTS[x.account].label)}</span><b class="cx-num">${cxMoney(x.balance)}</b></li>`).join('')}</ul>` : '<p class="muted">Nenhum lançamento financeiro neste ano. Lance notas fiscais, repasses e saldos de extrato para acompanhar os saldos.</p>';
    const recent = cx.records.slice().sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || ''))).slice(0, 6);
    document.getElementById('cxRecent').innerHTML = recent.length ? recent.map(r => cxItemHTML({src: 'rec', id: r.id, r, title: r.title, date: r.date || '', area: cxAreaOf(r), kind: r.kind, notes: r.notes || '', processo: r.processo || ''}, true)).join('') : '<div class="cx-empty">Nenhum documento enviado ainda. Use “Enviar documentos” para começar.</div>';
    document.getElementById('cxStatFiles').textContent = cx.records.length;
    cxUpdateBadges();
  }).catch(e => { const t = document.getElementById('cxTodo'); if (t) t.innerHTML = `<li class="muted">${cxEsc(e.message)}</li>`; });
}
window.cxGoDecl = () => { state.view = 'documentos'; if (typeof documentosTab !== 'undefined') documentosTab = 'declaracoes'; render(); setTimeout(() => cxOpenDecl('comparecimento'), 50); };
window.cx_setQuery = q => { cx.filter.q = q || ''; const i = document.getElementById('cxQ'); if (i) { i.value = cx.filter.q; cxFilter(); } };

/* ---------- Arquivo central ---------- */
function cxRenderArchive(a) {
  const f = cx.filter;
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Arquivo da administração</h2><p>Envie, encontre e organize atas, orçamentos, notas, extratos e todos os documentos do CEI.</p></div>
    <div class="cx-btns"><button class="cx-btn primary" onclick="cxOpenUpload()">⬆ Enviar documentos</button><button class="cx-btn" onclick="cxGo('atas')">✎ Redigir ata</button></div></div>
    <div class="cx-search"><input id="cxQ" type="search" value="${cxEsc(f.q)}" placeholder="Pesquise por título, assunto, processo, fornecedor, mês, valor…" oninput="cxState.filter.q=this.value;cxFilter()" aria-label="Pesquisar no arquivo"></div>
    <div class="cx-folders" id="cxFolders"></div>
    <div class="cx-filters">
      <label>Tipo de documento<select id="cxKind" onchange="cxState.filter.kind=this.value;cxFilter()"><option value="">Todos os tipos</option>${Object.entries(CX_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Ano<select id="cxYear" onchange="cxState.filter.year=this.value;cxFilter()"><option value="">Todos os anos</option></select></label>
      <label>Processo / assunto<select id="cxProc" onchange="cxState.filter.processo=this.value;cxFilter()"><option value="">Todos</option></select></label>
      <label>Origem<select id="cxSource" onchange="cxState.filter.source=this.value;cxFilter()"><option value="">Enviados e emitidos</option><option value="rec">Somente enviados</option><option value="gen">Somente emitidos pelo sistema</option></select></label>
    </div>
    <div class="cx-results-head"><span id="cxSummary" role="status">Carregando…</span><button class="cx-btn small" onclick="cxGo('arquivo',{})">Limpar filtros</button></div>
    <div id="cxProcess"></div><div id="cxList"></div></div>`;
  document.getElementById('cxKind').value = f.kind; document.getElementById('cxSource').value = f.source;
  cxLoad().then(() => { if (state.view === 'arquivo') cxFilter(); }).catch(e => { const l = document.getElementById('cxList'); if (l) l.innerHTML = `<div class="cx-empty">${cxEsc(e.message)} <button class="cx-btn small" onclick="cxLoad(true).then(cxFilter)">Tentar novamente</button></div>`; });
}
window.cxFilter = () => {
  const list = document.getElementById('cxList'); if (!list || !cx.loaded) return;
  const f = cx.filter, all = cxAllItems();
  const words = cxNorm(f.q).trim().split(/\s+/).filter(Boolean);
  const base = all.filter(x => (!f.source || x.src === f.source) && (!f.kind || x.kind === f.kind || (f.kind === 'orcamento' && x.kind === 'cotacao')) && (!f.year || String(x.date).slice(0, 4) === f.year) && (!f.processo || x.processo === f.processo) && words.every(w => cxHaystack(x).includes(w)));
  // pastas com contagem (consideram os outros filtros)
  const counts = {}; base.forEach(x => { counts[x.area] = (counts[x.area] || 0) + 1; });
  document.getElementById('cxFolders').innerHTML = `<button class="cx-folder ${f.area ? '' : 'active'}" onclick="cxState.filter.area='';cxFilter()"><b>Todas as pastas</b><small>${base.length} item(ns)</small></button>` +
    Object.entries(CX_AREAS).map(([k, v]) => `<button class="cx-folder ${f.area === k ? 'active' : ''}" onclick="cxState.filter.area='${k}';cxFilter()"><b>${v.label}</b><small title="${v.hint}">${counts[k] || 0} item(ns) · ${v.hint}</small></button>`).join('');
  const items = base.filter(x => !f.area || x.area === f.area).sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(x.title).localeCompare(String(y.title)));
  // selects dinâmicos
  const years = [...new Set(all.map(x => String(x.date).slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
  const ySel = document.getElementById('cxYear'); ySel.innerHTML = '<option value="">Todos os anos</option>' + years.map(y => `<option>${y}</option>`).join(''); ySel.value = f.year;
  const procs = [...new Set(all.map(x => x.processo).filter(Boolean))].sort((p, q) => p.localeCompare(q, 'pt-BR'));
  const pSel = document.getElementById('cxProc'); pSel.innerHTML = '<option value="">Todos</option>' + procs.map(p => `<option value="${cxEsc(p)}">${cxEsc(p)}</option>`).join(''); pSel.value = f.processo;
  document.getElementById('cxSummary').textContent = `${items.length} item(ns) encontrado(s)${f.area ? ' em ' + CX_AREAS[f.area].label : ''}`;
  document.getElementById('cxProcess').innerHTML = f.processo ? cxProcessHTML(f.processo, all) : '';
  if (!items.length) { list.innerHTML = `<div class="cx-empty">${all.length ? 'Nenhum item corresponde à pesquisa. Tente outras palavras ou limpe os filtros.' : 'O arquivo ainda está vazio. Clique em “Enviar documentos” para guardar o primeiro arquivo.'}</div>`; return; }
  let html = '', last = '';
  for (const x of items.slice(0, 400)) {
    const [y, m] = String(x.date).split('-'); const g = y && m ? `${cxMonthName(m)} de ${y}` : 'Sem data';
    if (g !== last) { html += `<div class="cx-group-title">${cxEsc(g)}</div>`; last = g; }
    html += cxItemHTML(x);
  }
  if (items.length > 400) html += '<p class="muted">Mostrando os 400 mais recentes. Refine a pesquisa para ver os demais.</p>';
  list.innerHTML = html;
};
function cxProcessHTML(proc, all) {
  const docs = all.filter(x => x.processo === proc);
  const has = k => docs.filter(x => x.kind === k || (k === 'orcamento' && x.kind === 'cotacao')).length;
  const spent = docs.filter(x => x.r?.fin?.move === 'saida').reduce((s, x) => s + x.r.fin.amount, 0);
  const steps = [['orcamento', 'Orçamentos'], ['pesquisa_precos', 'Mapa / pesquisa de preços'], ['ata_compra', 'Ata de aprovação da compra'], ['nota_fiscal', 'Nota fiscal'], ['comprovante', 'Comprovante de pagamento']];
  return `<div class="cx-process"><h3>Processo: ${cxEsc(proc)}</h3><div class="cx-checklist">${steps.map(([k, l]) => { const n = has(k); return `<span class="cx-chip ${n ? 'ok' : 'warn'}">${n ? '✓' : '○'} ${l}${n > 1 ? ' (' + n + ')' : ''}</span>`; }).join('')}</div>
    <p class="muted" style="margin:8px 0 0">${docs.length} documento(s) neste processo${spent ? ' · despesas lançadas: <b>' + cxMoney(spent) + '</b>' : ''}. <button class="cx-btn small" onclick="cxOpenUpload({processo:${cxEsc(JSON.stringify(proc))},area:'compras'})">+ Adicionar documento a este processo</button></p></div>`;
}
function cxItemHTML(x, compact = false) {
  if (x.src === 'gen') {
    const actions = x.gen === 'oficio' ? `<button class="cx-btn small" onclick="printOficio('${x.id}')">Visualizar / imprimir</button><button class="cx-btn small" onclick="editOficio('${x.id}')">Editar</button>${x.signed ? `<button class="cx-btn small" onclick="viewSignedPdf('${x.id}')">PDF assinado</button>` : ''}`
      : `<button class="cx-btn small" onclick="previewGenerated('${x.id}')">Visualizar / imprimir</button><button class="cx-btn small" onclick="cxEditGenerated('${x.id}')">Editar</button>`;
    return `<article class="cx-item"><div><div class="cx-chips"><span class="cx-chip">${cxEsc(CX_AREAS[x.area]?.label || '')}</span><span class="cx-chip">Emitido · ${cxEsc(CX_GEN_KIND[x.gen] || 'Documento')}</span>${x.gen === 'oficio' ? (x.signed ? '<span class="cx-chip ok">✓ Assinado</span>' : '<span class="cx-chip warn">Sem PDF assinado</span>') : ''}</div><h4>${cxEsc(x.title)}</h4><div class="cx-meta"><span>${cxEsc(cxBR(x.date) || 'Sem data')}</span>${x.notes ? `<span>${cxEsc(x.notes)}</span>` : ''}</div></div><div class="cx-actions">${actions}</div></article>`;
  }
  const r = x.r, fin = r.fin, pub = cx.publicIds.has(r.id), ro = r.seeded || r.readOnly;
  const isAta = r.kind === 'ata' || r.kind === 'ata_compra', typed = r.typed || (r.kind === 'ata' && r.body);
  const finTxt = fin ? `<span class="cx-money ${fin.move === 'entrada' ? 'in' : fin.move === 'saida' ? 'out' : ''}">${fin.move === 'saida' ? '− ' : fin.move === 'entrada' ? '+ ' : ''}${cxMoney(fin.amount)}</span><span>${cxEsc(CX_ACCOUNTS[fin.account]?.label || '')}${fin.nature ? ' · ' + CX_NATURES[fin.nature] : ''}${fin.category ? ' · ' + cxEsc(fin.category) : ''}${fin.move === 'saldo_extrato' ? ' · saldo do extrato' : fin.move === 'saldo_inicial' ? ' · saldo inicial' : ''}</span>` : '';
  const more = compact ? [] : [
    !ro ? `<button onclick="${typed ? `cxOpenMinute('${r.id}')` : `cxOpenEdit('${r.id}')`}">✎ Editar informações</button>` : '',
    !ro && (isAta || r.central) ? `<button onclick="cxAttachSigned('${r.id}')">🖊 ${r.signedFile ? 'Trocar PDF assinado' : 'Anexar PDF assinado'}</button>` : '',
    r.signedFile ? `<a href="/api/app/documents/${r.id}/file?signed=1">⬇ Baixar PDF assinado</a>` : '',
    r.file && !r.internal ? `<button onclick="cxTogglePublic('${r.id}')">${pub ? '🔒 Retirar da página pública' : '🌐 Publicar na página pública'}</button>` : '',
    pub ? `<button onclick="cxOpenPublish('${r.id}')">🏷 Mudar seção na página pública</button>` : '',
    r.processo ? '' : (!ro ? `<button onclick="cxOpenEdit('${r.id}')">📁 Incluir em um processo</button>` : ''),
    !ro ? `<button class="danger" onclick="cxDelete('${r.id}')">🗑 Excluir</button>` : '',
  ].filter(Boolean);
  if (typed && more.length) more[0] = `<button onclick="cxOpenMinute('${r.id}')">✎ Editar ata</button>`;
  const actions = [
    cxViewable(r.file) ? `<a class="cx-btn small" href="/api/app/documents/${r.id}/file?view=1" target="_blank" rel="noopener">Visualizar</a>` : '',
    r.file ? `<a class="cx-btn small" href="/api/app/documents/${r.id}/file">Baixar</a>` : '',
    typed ? `<button class="cx-btn small" onclick="cxPrintMinute('${r.id}')">Imprimir no timbrado</button>` : '',
    r.signedFile ? `<a class="cx-btn small" href="/api/app/documents/${r.id}/file?signed=1&view=1" target="_blank" rel="noopener">PDF assinado</a>` : '',
    more.length ? `<details class="cx-more"><summary class="cx-btn small" aria-label="Mais ações">⋯ Mais</summary><div class="cx-more-menu">${more.join('')}</div></details>` : '',
  ].join('');
  return `<article class="cx-item"><div><div class="cx-chips"><span class="cx-chip">${cxEsc(CX_AREAS[x.area]?.label || '')}</span><span class="cx-chip">${cxEsc(cxKindLabel(r))}</span>${isAta && typed ? (r.signedFile ? '<span class="cx-chip ok">✓ Assinada</span>' : '<span class="cx-chip warn">Aguardando assinatura</span>') : ''}${pub ? `<span class="cx-chip pub">🌐 Público · ${cxEsc(CX_PUBCATS[cx.publicMeta?.[r.id]?.category || cxGuessPub(r)]?.label || '')}</span>` : ''}${r.processo ? `<button class="cx-chip" onclick="cxGo('arquivo',{processo:${cxEsc(JSON.stringify(r.processo))}})" title="Ver todos os documentos deste processo">📁 ${cxEsc(r.processo)}</button>` : ''}</div>
    <h4>${cxEsc(r.title)}</h4><div class="cx-meta"><span>${cxEsc(cxBR(r.date) || r.competence || 'Sem data')}</span>${finTxt}${fin?.supplier ? `<span>${cxEsc(fin.supplier)}${fin.docNumber ? ' · nº ' + cxEsc(fin.docNumber) : ''}</span>` : ''}${r.file ? `<span>📎 ${cxEsc(r.file.originalName || r.file.name)}</span>` : (typed ? '<span>Ata redigida no sistema</span>' : '')}</div>
    ${!compact && r.notes ? `<div class="cx-notes">${cxEsc(r.notes)}</div>` : ''}${!compact && r.tags ? `<div class="cx-notes muted">Palavras-chave: ${cxEsc(r.tags)}</div>` : ''}</div><div class="cx-actions">${actions}</div></article>`;
}
window.cxEditGenerated = id => {
  const g = (state.generatedDocs || []).find(x => x.id === id);
  if (g?.template === 'documentoTimbrado') return cxOpenTimbrado(null, id);
  if (g?.template === 'declaracao' && g.data?.v === 1) return cxOpenDecl(null, id);
  if (g?.template === 'relatorioAvaliativo' && typeof openChildReport === 'function') return openChildReport(id);
  if (g?.template === 'meimei' && typeof editMeimei === 'function' && (state.encaminhamentosMeimei || []).some(m => m.id === id)) return editMeimei(id);
  return reopenGenerated(id);
};

/* ---------- Modal genérico ---------- */
function cxModal(html) {
  let m = document.getElementById('cxModal');
  if (!m) { m = document.createElement('div'); m.id = 'cxModal'; m.className = 'modal cx-modal hidden'; document.body.append(m); }
  m.innerHTML = `<div class="modal-card wide" role="dialog" aria-modal="true">${html}</div>`;
  m.classList.remove('hidden');
  return m;
}
window.cxCloseModal = () => { const m = document.getElementById('cxModal'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } };
const cxOptions = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${typeof v === 'string' ? v : v.label}</option>`).join('');
const cxProcList = () => `<datalist id="cxProcList">${[...new Set(cx.records.map(r => r.processo).filter(Boolean))].map(p => `<option value="${cxEsc(p)}">`).join('')}</datalist>`;
function cxFinFieldset(fin, kind) {
  const f = fin || {}, move = f.move || CX_KIND_MOVE[kind] || 'saida', account = f.account || 'SICOOB';
  return `<label class="cx-check"><input type="checkbox" name="hasFin" ${fin || CX_KIND_MOVE[kind] ? 'checked' : ''} onchange="cxToggleFin(this.form)"> Registrar valor no Financeiro (entra no cálculo de saldo)</label>
  <fieldset class="cx-fieldset" id="cxFinBox" ${fin || CX_KIND_MOVE[kind] ? '' : 'hidden'}><legend>Lançamento financeiro</legend>
    <label>Conta / recurso *<select name="finAccount" onchange="cxToggleFin(this.form)">${cxOptions(CX_ACCOUNTS, account)}</select></label>
    <label>Movimento *<select name="finMove" onchange="cxToggleFin(this.form)">${cxOptions(CX_MOVES, move)}</select></label>
    <label>Valor (R$) *<input name="finAmount" inputmode="decimal" placeholder="0,00" value="${cxEsc(cxMoneyInput(f.amount))}"></label>
    <label data-fin="nature">Natureza<select name="finNature">${cxOptions(CX_NATURES, f.nature || '')}</select></label>
    <label data-fin="category">Categoria<select name="finCategory"></select></label>
    <label data-fin="statement">Tipo de saldo do extrato<select name="finStatement">${cxOptions(CX_STATEMENTS, f.statementType || 'conta_corrente')}</select></label>
    <label data-fin="supplier">Fornecedor / origem<input name="finSupplier" maxlength="160" value="${cxEsc(f.supplier || '')}" placeholder="Ex.: Loja ABC Ltda."></label>
    <label data-fin="docnum">Nº do documento<input name="finDoc" maxlength="60" value="${cxEsc(f.docNumber || '')}" placeholder="Ex.: NF 1234"></label>
    <p class="hint full" id="cxFinHint"></p>
  </fieldset>`;
}
window.cxToggleFin = form => {
  const box = form.querySelector('#cxFinBox'); if (!box) return;
  box.hidden = !form.hasFin.checked;
  const move = form.finMove.value, acc = CX_ACCOUNTS[form.finAccount.value];
  const show = (k, on) => { const el = box.querySelector(`[data-fin="${k}"]`); if (el) el.hidden = !on; };
  show('nature', ['entrada', 'saida', 'saldo_inicial'].includes(move) && acc.natures);
  show('category', ['entrada', 'saida'].includes(move));
  show('statement', move === 'saldo_extrato');
  show('supplier', ['entrada', 'saida'].includes(move));
  show('docnum', ['entrada', 'saida'].includes(move));
  const cat = form.finCategory, current = cat.dataset.value ?? cat.value;
  const cats = CX_CATS[move] || [];
  cat.innerHTML = '<option value="">— escolha —</option>' + cats.map(c => `<option ${c === current ? 'selected' : ''}>${cxEsc(c)}</option>`).join('');
  delete cat.dataset.value;
  document.getElementById('cxFinHint').textContent = move === 'saldo_extrato' ? 'Informe o saldo final mostrado no extrato, na data do documento. Se a conta tiver aplicação, lance um saldo para a conta corrente e outro para a aplicação.' : move === 'saldo_inicial' ? 'Saldo com que a conta começou o ano (saldo reprogramado do ano anterior). Para PDDE, lance custeio e capital separadamente.' : acc.natures ? 'Nos recursos do PDDE, informe se é custeio (consumo, serviços) ou capital (bens permanentes).' : '';
};
function cxReadFin(form) {
  if (!form.hasFin?.checked) return null;
  const amount = cxParseMoney(form.finAmount.value), move = form.finMove.value;
  if (!Number.isFinite(amount) || (amount <= 0 && !['saldo_extrato', 'saldo_inicial'].includes(move))) throw new Error('Informe um valor válido no lançamento financeiro (ex.: 1.250,90).');
  const acc = CX_ACCOUNTS[form.finAccount.value];
  return {account: form.finAccount.value, move, amount, nature: acc.natures && ['entrada', 'saida', 'saldo_inicial'].includes(move) ? form.finNature.value : '', category: ['entrada', 'saida'].includes(move) ? form.finCategory.value : '', statementType: move === 'saldo_extrato' ? form.finStatement.value : '', supplier: ['entrada', 'saida'].includes(move) ? form.finSupplier.value : '', docNumber: ['entrada', 'saida'].includes(move) ? form.finDoc.value : ''};
}
function cxMetaFields(r, preset = {}) {
  const area = r?.area || (r ? cxAreaOf(r) : '') || preset.area || (cx.filter.area || ''), kind = r?.kind || preset.kind || cx.filter.kind || '';
  return `<label>Tipo de documento *<select name="kind" required onchange="cxKindChanged(this.form)"><option value="">— escolha —</option>${cxOptions(CX_KINDS, CX_KINDS[kind] ? kind : (kind === 'cotacao' ? 'orcamento' : ''))}</select></label>
    <label>Pasta *<select name="area" required><option value="">— escolha —</option>${cxOptions(CX_AREAS, area)}</select></label>
    <label>Data do documento *<input name="date" type="date" required value="${cxEsc(r?.date || (r?.competence ? r.competence + '-01' : '') || preset.date || cxToday())}"></label>
    <label>Processo / assunto<input name="processo" list="cxProcList" maxlength="160" value="${cxEsc(r?.processo || preset.processo || '')}" placeholder="Ex.: Compra de ventiladores 2026"></label>
    <label class="full" data-title>Título *<input name="title" maxlength="200" value="${cxEsc(r?.title || '')}" placeholder="Ex.: Orçamento — Loja ABC"></label>
    <label class="full">Descrição / observações<textarea name="notes" rows="2" maxlength="3000" placeholder="Resumo, decisões, quem participou… (ajuda a encontrar depois)">${cxEsc(r?.notes || '')}</textarea></label>
    <label class="full">Palavras-chave<input name="tags" maxlength="300" value="${cxEsc(r?.tags || '')}" placeholder="Ex.: ventilador, sala 3, PDDE"></label>${cxProcList()}`;
}
window.cxKindChanged = form => {
  const k = form.kind.value;
  if (CX_KIND_AREA[k] && !form.area.dataset.touched) form.area.value = CX_KIND_AREA[k];
  if (form.hasFin && CX_KIND_MOVE[k] && !form.hasFin.dataset.touched) { form.hasFin.checked = true; form.finMove.value = CX_KIND_MOVE[k]; }
  if (form.hasFin) cxToggleFin(form);
  const drop = form.querySelector('.cx-drop'); if (drop) drop.hidden = k === 'lancamento';
};

/* ---------- Envio de documentos ---------- */
window.cxOpenUpload = (preset = {}) => {
  if (!CX_ADMIN) return;
  cxLoad().catch(() => {});
  const m = cxModal(`<h2>Enviar documentos para o arquivo</h2><p class="hint">Escolha o tipo e a pasta. Você pode enviar vários arquivos de uma vez com os mesmos dados; nesse caso, o título de cada um vem do nome do arquivo.</p>
  <form id="cxUpForm" class="cx-form" onsubmit="cxSubmitUpload(event)">
    <div class="cx-drop" id="cxDrop" onclick="if(event.target.tagName!=='INPUT')this.querySelector('input').click()"><b>Clique para escolher</b> ou arraste os arquivos aqui<br><small>PDF, fotos (JPG/PNG), Word, Excel, LibreOffice · até 20 MB cada</small><input type="file" name="files" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.odt,.ods" onchange="cxFilesPicked(this.form)"><ul id="cxFileList"></ul></div>
    ${cxMetaFields(null, preset)}
    ${cxFinFieldset(null, preset.kind)}
    <p class="cx-progress full" id="cxUpStatus" role="status"></p>
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button class="primary" type="submit">Enviar e arquivar</button></div>
  </form>`);
  const form = m.querySelector('form');
  if (preset.area) form.area.dataset.touched = '1';
  form.area.addEventListener('change', () => { form.area.dataset.touched = '1'; });
  form.hasFin.addEventListener('change', () => { form.hasFin.dataset.touched = '1'; });
  const drop = m.querySelector('#cxDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const dt = new DataTransfer(); [...e.dataTransfer.files].forEach(f => dt.items.add(f)); form.files.files = dt.files; cxFilesPicked(form); });
  if (preset.kind) cxKindChanged(form); else cxToggleFin(form);
};
window.cxFilesPicked = form => {
  const files = [...form.files.files];
  document.getElementById('cxFileList').innerHTML = files.map(f => `<li>📎 ${cxEsc(f.name)} <small>(${(f.size / 1048576).toFixed(1)} MB)</small></li>`).join('');
  const t = form.title;
  if (files.length === 1 && !t.value) t.value = files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  form.querySelector('[data-title]').querySelector('input').placeholder = files.length > 1 ? 'Opcional: deixe vazio para usar o nome de cada arquivo' : 'Ex.: Orçamento — Loja ABC';
};
window.cxSubmitUpload = async e => {
  e.preventDefault();
  const form = e.target, files = [...form.files.files], status = document.getElementById('cxUpStatus'), btn = form.querySelector('button[type=submit]');
  let fin;
  try {
    fin = cxReadFin(form);
    if (!form.kind.value || !form.area.value || !form.date.value) throw new Error('Escolha o tipo, a pasta e a data.');
    if (!files.length && !fin) throw new Error('Escolha ao menos um arquivo (ou marque “Registrar valor no Financeiro” para um lançamento sem documento).');
    if (files.length > 1 && fin) throw new Error('Para lançar valores, envie um arquivo por vez (cada nota tem o seu valor).');
    if (files.length <= 1 && !form.title.value.trim()) throw new Error('Informe o título do documento.');
    const big = files.find(f => f.size > 20 * 1048576); if (big) throw new Error(`O arquivo “${big.name}” passa de 20 MB.`);
  } catch (err) { status.textContent = ''; return alert(err.message); }
  btn.disabled = true; let ok = 0;
  try {
    const list = files.length ? files : [null];
    for (const [i, file] of list.entries()) {
      status.textContent = list.length > 1 ? `Enviando ${i + 1} de ${list.length}: ${file.name}…` : 'Enviando…';
      const data = new FormData();
      for (const k of ['kind', 'area', 'date', 'processo', 'notes', 'tags']) data.append(k, form[k].value);
      data.append('title', form.title.value.trim() && list.length === 1 ? form.title.value.trim() : (file ? file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') : form.title.value.trim()));
      if (fin) data.append('fin', JSON.stringify(fin));
      if (file) data.append('file', file);
      await cxRequest('/api/app/arquivo', {method: 'POST', body: data}); ok++;
    }
    cxCloseModal(); await cxLoad(true); cxToast(ok > 1 ? `${ok} documentos arquivados.` : 'Documento arquivado.'); render();
  } catch (err) { status.textContent = ok ? `${ok} enviado(s). Erro no próximo: ${err.message}` : err.message; alert(err.message); if (ok) { await cxLoad(true); } }
  finally { btn.disabled = false; }
};
window.cxOpenEdit = id => {
  const r = cx.records.find(x => x.id === id); if (!r) return;
  const m = cxModal(`<h2>Editar informações do documento</h2>${r.central ? '' : '<p class="hint">Este documento veio do antigo acervo da APP. Ao salvar, ele passa a usar a classificação do Arquivo central.</p>'}
  <form class="cx-form" onsubmit="cxSubmitEdit(event,'${r.id}')">${r.file ? `<p class="hint full">📎 ${cxEsc(r.file.originalName || r.file.name)} — para trocar o arquivo, exclua este registro e envie novamente.</p>` : ''}
    ${cxMetaFields(r)}${cxFinFieldset(r.fin, '')}
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button class="primary" type="submit">Salvar alterações</button></div></form>`);
  const form = m.querySelector('form'); form.area.dataset.touched = '1'; form.hasFin.dataset.touched = '1';
  if (r.fin?.category) form.finCategory.dataset.value = r.fin.category;
  cxToggleFin(form);
};
window.cxSubmitEdit = async (e, id) => {
  e.preventDefault(); const form = e.target;
  try {
    const fin = cxReadFin(form);
    const body = {central: true, kind: form.kind.value, area: form.area.value, date: form.date.value, title: form.title.value.trim(), processo: form.processo.value, notes: form.notes.value, tags: form.tags.value, fin};
    await cxRequest('/api/app/documents/' + id, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    cxCloseModal(); await cxLoad(true); cxToast('Informações atualizadas.'); render();
  } catch (err) { alert(err.message); }
};
window.cxDelete = async id => {
  const r = cx.records.find(x => x.id === id); if (!r) return;
  if (!await cxConfirmTyped(r.title, r.file || r.signedFile ? 'O arquivo anexado também será apagado.' : '')) return;
  try { await cxRequest('/api/app/documents/' + id, {method: 'DELETE'}); await cxLoad(true); cxToast('Documento excluído.'); render(); } catch (err) { alert(err.message); }
};
window.cxAttachSigned = id => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,application/pdf';
  input.onchange = async () => { const file = input.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file);
    try { await cxRequest(`/api/app/documents/${id}/signed`, {method: 'POST', body: fd}); await cxLoad(true); cxToast('PDF assinado anexado.'); render(); } catch (err) { alert(err.message); } };
  input.click();
};
window.cxTogglePublic = async id => {
  const r = cx.records.find(x => x.id === id); if (!r) return;
  if (cx.publicIds.has(id)) {
    if (!confirm(`Retirar “${r.title}” da página pública?`)) return;
    try { await cxRequest('/api/portal/publications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, published: false})}); await cxLoad(true); cxToast('Retirado da página pública.'); render(); } catch (err) { alert(err.message); }
    return;
  }
  cxOpenPublish(id);
};
window.cxOpenPublish = id => {
  const r = cx.records.find(x => x.id === id); if (!r) return;
  const meta = cx.publicMeta?.[id] || {}, cat = meta.category || cxGuessPub(r), pub = cx.publicIds.has(id);
  cxModal(`<h2>${pub ? 'Editar publicação' : 'Publicar na página pública'}</h2><p class="hint">“${cxEsc(r.title)}” ficará disponível para qualquer pessoa, sem login, para ver e baixar.</p>
  <form class="cx-form" onsubmit="cxSubmitPublish(event,'${id}')">
    <label class="full">Seção da página pública *<select name="category">${Object.entries(CX_PUBCATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v.ico} ${v.label}</option>`).join('')}</select></label>
    <label class="full">Descrição curta (opcional, aparece para o público)<input name="description" maxlength="300" value="${cxEsc(meta.description || '')}" placeholder="Ex.: Versão aprovada em assembleia de março de 2026"></label>
    <label class="cx-check"><input type="checkbox" name="ok" required> Confirmo que o arquivo não contém dados pessoais de crianças, famílias ou servidores que não devam ser divulgados.</label>
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button class="primary" type="submit">${pub ? 'Salvar' : 'Publicar'}</button></div></form>`);
};
window.cxSubmitPublish = async (e, id) => {
  e.preventDefault(); const f = e.target;
  try { await cxRequest('/api/portal/publications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, published: true, category: f.category.value, description: f.description.value})}); cxCloseModal(); await cxLoad(true); cxToast('Publicado na página pública.'); render(); } catch (err) { alert(err.message); }
};

/* ---------- Editor rico (atas e papel timbrado) ---------- */
function cxEditorHTML(id, html) {
  const b = (cmd, label, title, val = '') => `<button type="button" title="${title}" onmousedown="event.preventDefault()" onclick="cxCmd('${id}','${cmd}','${val}')">${label}</button>`;
  return `<div class="cx-editor-bar">${b('bold', '<b>N</b>', 'Negrito')}${b('italic', '<i>I</i>', 'Itálico')}${b('underline', '<u>S</u>', 'Sublinhado')}${b('formatBlock', 'Título', 'Título', 'h2')}${b('formatBlock', '¶', 'Parágrafo', 'p')}${b('insertUnorderedList', '• Lista', 'Lista')}${b('insertOrderedList', '1. Lista', 'Lista numerada')}${b('justifyLeft', '⯇', 'Alinhar à esquerda')}${b('justifyCenter', '≡', 'Centralizar')}${b('justifyFull', '☰', 'Justificar')}</div><div class="cx-editor" id="${id}" contenteditable="true" role="textbox" aria-multiline="true">${html || '<p></p>'}</div>`;
}
window.cxCmd = (id, cmd, val) => { const ed = document.getElementById(id); ed.focus(); document.execCommand(cmd, false, val || null); };
const cxSanitize = html => (typeof reportSanitize === 'function' ? reportSanitize(html) : cxEsc(String(html || '').replace(/<[^>]+>/g, ' ')));
const cxPlainToHtml = t => String(t || '').split(/\n\s*\n/).map(p => `<p>${cxEsc(p).replace(/\n/g, '<br>')}</p>`).join('');
const cxBodyHtml = body => (/^\s*</.test(body || '') ? body : cxPlainToHtml(body));

/* ---------- Impressão no papel timbrado (reaproveita a paginação A4 do relatório avaliativo) ---------- */
function cxLetterhead({title, meta = [], bodyHtml, dateIso, showDate = true, signers = [], slip = '', recipient = '', extraHtml = ''}, popup) {
  const w = popup || window.open('', '_blank'); if (!w) return alert('Permita a abertura da janela de impressão para este site.');
  const rows = []; const s = signers.filter(p => p.name || p.role);
  for (let i = 0; i < s.length; i += 2) rows.push('<div class="report-signature-row">' + s.slice(i, i + 2).map(p => `<div class="report-signature"><div class="report-signature-line"></div><b>${cxEsc(p.name)}</b><div>${cxEsc(p.role)}</div></div>`).join('') + '</div>');
  const slipHtml = slip ? `<div class="report-signature-row cx-slip"><div class="report-signature" style="padding-top:0;width:100%;text-align:left"><div class="cx-cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div><p><b>${cxEsc(title)}</b></p><p>${cxEsc(slip)}</p><p>Assinatura do(a) responsável: _____________________________________ Data: ___/___/______</p></div></div>` : '';
  w.document.open();
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${cxEsc(title || 'Documento')}</title><link rel="stylesheet" href="${location.origin}/child-report-print.css?v=20261021-rich1"><style>.cx-slip{grid-template-columns:1fr!important;padding-top:8mm}.cx-slip p{text-align:left!important;margin:0 0 3mm}.cx-cut{color:#7a8797;letter-spacing:1px;margin-bottom:4mm;font-size:9pt;white-space:nowrap;overflow:hidden}.cx-recipient{margin:0 0 4mm!important;text-align:left!important}.cx-pres{grid-template-columns:1fr 1fr!important;gap:6mm!important;align-items:end;padding:0 0 2mm!important;font-size:10pt}.cx-pres small{display:block;color:#5b6b82;font-size:8.5pt}.cx-pres-line{border-bottom:1px solid #26374a;height:7mm}.cx-pres-title{font-size:12pt!important;margin-top:8mm!important}.report-content h3{color:#143e68}</style><script src="${location.origin}/child-report-pagination.js?v=20261021-flow1" defer><\/script></head><body><div class="report-controls"><button id="reportPrint" disabled onclick="window.print()">Imprimir / Salvar PDF</button><span id="reportPrintStatus">Preparando páginas…</span></div><div id="reportSource" hidden>${title ? `<h1 class="report-title">${cxEsc(title)}</h1>` : ''}${meta.length ? `<section class="report-identification">${meta.map(([l, v]) => `<p><b>${cxEsc(l)}:</b> ${cxEsc(v)}</p>`).join('')}</section>` : ''}${recipient ? `<p class="cx-recipient">${cxEsc(recipient)}</p>` : ''}<div id="reportBodySource">${cxSanitize(bodyHtml)}</div>${showDate ? `<p class="report-date">Araquari, ${cxEsc(cxLongDate(dateIso || cxToday()))}.</p>` : ''}${rows.join('')}${slipHtml}${extraHtml}</div><div id="reportPages"></div></body></html>`);
  w.document.close();
}

/* ---------- Atas de reunião (v45) ---------- */
const CX_ATA_TIPOS = {
  pedagogica: {ico: '📚', label: 'Pedagógica', full: 'Reunião Pedagógica', area: 'pedagogica', hint: 'Planejamento, formação, conselho de classe', sign: [['', 'Direção'], ['', 'Coordenação pedagógica']]},
  familias: {ico: '👨‍👩‍👧', label: 'Familiar(es)', full: 'Reunião com Famílias', area: 'familias', hint: 'Pais e responsáveis, individual ou coletiva', sign: [['', 'Direção'], ['', 'Professor(a) da turma']]},
  conselho: {ico: '🤝', label: 'Conselho Escolar', full: 'Reunião do Conselho Escolar', area: 'conselho', hint: 'Ordinária, extraordinária, eleição', sign: [['', 'Presidente do Conselho Escolar'], ['', 'Secretário(a) do Conselho']]},
  app: {ico: '🍎', label: 'Associação de Pais e Professores (APP)', full: 'Reunião da Associação de Pais e Professores (APP)', area: 'app', hint: 'Assembleia, diretoria, aprovação de contas', sign: [['', 'Presidente da APP'], ['', 'Secretário(a) da APP']]},
  outra: {ico: '📝', label: 'Outra', full: 'Reunião', area: 'reuniao_geral', hint: 'Equipe, reunião geral ou outro tipo', sign: [['', 'Direção'], ['', 'Secretário(a) da reunião']]},
};
const cxAtaTipoOf = r => r?.meta?.tipo || ({pedagogica: 'pedagogica', familias: 'familias', conselho: 'conselho', app: 'app'}[cxAreaOf(r)] || 'outra');
const cxAtaFull = m => (m.tipo === 'outra' && m.tipoOutro ? m.tipoOutro : CX_ATA_TIPOS[m.tipo]?.full || 'Reunião');
const cxAtaTitle = m => `Ata${m.numero ? ' nº ' + m.numero : ''} — ${cxAtaFull(m)}${m.date ? ' — ' + cxBR(m.date) : ''}`;
const cxIsAta = r => r.kind === 'ata' || r.kind === 'ata_compra';
const cxAtaState = {tipo: '', q: ''};

function cxRenderAtas(a) {
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Redigir uma nova ata</h2><p>Escolha o tipo de reunião. A ata sai no papel timbrado do CEI, fica salva no Arquivo central e depois você pode anexar o PDF assinado.</p></div><button class="cx-btn" onclick="cxOpenUpload({kind:'ata',area:'reuniao_geral'})">⬆ Enviar ata já pronta (PDF/foto)</button></div>
    <div class="cx-models">${Object.entries(CX_ATA_TIPOS).map(([k, v]) => `<button class="cx-model" onclick="cxOpenMinute(null,{tipo:'${k}'})"><span class="cx-ico">${v.ico}</span><b>${cxEsc(v.label)}</b><small>${cxEsc(v.hint)}</small></button>`).join('')}</div></div>
    <div class="panel"><div class="cx-head"><h2>Atas registradas</h2><input id="cxAtaQ" type="search" placeholder="Pesquisar por título, participante, pauta…" value="${cxEsc(cxAtaState.q)}" oninput="cxAtaState.q=this.value;cxFilterAtas()" style="min-width:260px"></div>
    <div class="cx-chips" id="cxAtaChips" style="margin:12px 0"></div><div id="cxAtaList"><p class="muted">Carregando…</p></div></div>`;
  cxLoad().then(() => { if (state.view === 'atas') cxFilterAtas(); }).catch(e => { document.getElementById('cxAtaList').innerHTML = `<div class="cx-empty">${cxEsc(e.message)}</div>`; });
}
window.cxFilterAtas = () => {
  const el = document.getElementById('cxAtaList'); if (!el) return;
  const all = cx.records.filter(cxIsAta), words = cxNorm(cxAtaState.q).split(/\s+/).filter(Boolean);
  const count = k => all.filter(r => cxAtaTipoOf(r) === k).length;
  document.getElementById('cxAtaChips').innerHTML = `<button class="cx-chip ${cxAtaState.tipo ? '' : 'pub'}" onclick="cxAtaState.tipo='';cxFilterAtas()">Todas (${all.length})</button>` + Object.entries(CX_ATA_TIPOS).map(([k, v]) => `<button class="cx-chip ${cxAtaState.tipo === k ? 'pub' : ''}" onclick="cxAtaState.tipo='${k}';cxFilterAtas()">${v.ico} ${cxEsc(v.label.replace(' (APP)', ''))} (${count(k)})</button>`).join('');
  const list = all.filter(r => (!cxAtaState.tipo || cxAtaTipoOf(r) === cxAtaState.tipo) && words.every(w => cxNorm([r.title, r.notes, r.tags, r.processo, r.presentes, r.meta?.participantes, r.meta?.pauta, r.meta?.conduzida, String(r.body || '').replace(/<[^>]+>/g, ' '), cxBR(r.date)].join(' ')).includes(w))).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  el.innerHTML = list.length ? list.map(r => cxItemHTML({src: 'rec', id: r.id, r, title: r.title, date: r.date, area: cxAreaOf(r), kind: r.kind, notes: r.notes || '', processo: r.processo || ''})).join('') : `<div class="cx-empty">${all.length ? 'Nenhuma ata encontrada com esse filtro.' : 'Nenhuma ata registrada ainda. Escolha um tipo de reunião acima para começar.'}</div>`;
};

function cxSignerRows(list) { return list.map(p => cxSignerRow({name: p.name ?? p[0], role: p.role ?? p[1]})).join(''); }
window.cxOpenMinute = (id, preset = {}) => {
  if (!CX_ADMIN) return;
  const r = id ? cx.records.find(x => x.id === id) : null;
  const m = r?.meta ? {...r.meta} : {};
  const tipo = r ? cxAtaTipoOf(r) : (preset.tipo || 'outra'), T = CX_ATA_TIPOS[tipo];
  const signers = m.assinantes?.length ? m.assinantes : T.sign.map(([name, role]) => ({name, role}));
  const participantes = m.participantes ?? (r?.presentes || '');
  const content = r ? cxBodyHtml(r.body) : '<p></p>';
  const auto = r ? (!!r.meta && m.abertura !== false) : true;
  cxModal(`<h2>${r ? 'Editar ata' : 'Nova ata'} · ${T.ico} ${cxEsc(T.label)}</h2><p class="hint">Preencha o que for pertinente; campos vazios não aparecem na impressão. Você pode colar o conteúdo de outro documento (Word, e-mail) no campo do texto e ajustar.</p>
  <form class="cx-form" id="cxAtaForm" onsubmit="cxSubmitMinute(event,'${r?.id || ''}')">
    <label>Tipo de reunião *<select name="tipo" onchange="cxAtaTipoChanged(this.form)">${Object.entries(CX_ATA_TIPOS).map(([k, v]) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${cxEsc(v.label)}</option>`).join('')}</select></label>
    <label data-tipo-outro ${tipo === 'outra' ? '' : 'hidden'}>Qual reunião?<input name="tipoOutro" maxlength="120" value="${cxEsc(m.tipoOutro || '')}" placeholder="Ex.: Reunião geral da equipe"></label>
    <label>Número da ata<input name="numero" maxlength="40" value="${cxEsc(m.numero || '')}" placeholder="Ex.: 03/2026"></label>
    <label>Data da reunião *<input type="date" name="date" required value="${cxEsc(r?.date || cxToday())}"></label>
    <div class="cx-btns" style="gap:8px"><label style="flex:1">Início<input type="time" name="inicio" value="${cxEsc(m.inicio || '')}"></label><label style="flex:1">Término<input type="time" name="fim" value="${cxEsc(m.fim || '')}"></label></div>
    <label>Local<input name="local" maxlength="200" value="${cxEsc(m.local ?? 'CEI Lindolpho José da Silva')}"></label>
    <label>Conduzida / presidida por<input name="conduzida" maxlength="160" value="${cxEsc(m.conduzida || '')}" placeholder="Nome e função"></label>
    <label>Secretário(a) — quem lavra a ata<input name="secretario" maxlength="160" value="${cxEsc(m.secretario || '')}" placeholder="Nome"></label>
    <label class="full">Participantes <small class="muted">(um por linha; opcional: “Nome — função”)</small><textarea name="participantes" rows="4" maxlength="6000" placeholder="Maria Souza — Diretora&#10;João Lima — Pai do Pedro (Maternal II)">${cxEsc(participantes)}</textarea></label>
    <label class="full">Pauta <small class="muted">(um item por linha)</small><textarea name="pauta" rows="3" maxlength="4000" placeholder="Aprovação da ata anterior&#10;Planejamento do 2º semestre">${cxEsc(m.pauta || '')}</textarea></label>
    <div class="full"><label style="margin-bottom:6px!important">Conteúdo da reunião * <small class="muted">(cole aqui e edite)</small></label>${cxEditorHTML('cxMinuteBody', content)}</div>
    <label class="full">Deliberações e encaminhamentos <small class="muted">(um por linha)</small><textarea name="encaminhamentos" rows="3" maxlength="6000">${cxEsc(m.encaminhamentos || '')}</textarea></label>
    <label class="cx-check"><input type="checkbox" name="abertura" ${auto ? 'checked' : ''}> Incluir abertura e encerramento automáticos (“Aos … reuniram-se …” / “Nada mais havendo a tratar…”)</label>
    <label class="cx-check"><input type="checkbox" name="listaPresenca" ${m.listaPresenca ? 'checked' : ''}> Incluir lista de presença com espaço para assinatura de cada participante</label>
    <div class="cx-signers" id="cxSigners"><b style="font-size:13px">Quem assina a ata</b>${cxSignerRows(signers)}<div><button type="button" class="cx-btn small" onclick="document.getElementById('cxSigners').insertAdjacentHTML('beforeend',cxSignerRowHTML())">+ Adicionar assinatura</button></div></div>
    <label class="full">Título no arquivo<input name="title" maxlength="200" value="${cxEsc(r?.title || '')}" placeholder="Gerado automaticamente: Ata nº … — Reunião … — data" data-auto="${r ? '' : '1'}"></label>
    <label>Processo / assunto<input name="processo" list="cxProcList" maxlength="160" value="${cxEsc(r?.processo || preset.processo || '')}" placeholder="Ex.: Compra de ventiladores 2026"></label>
    <label>Palavras-chave<input name="tags" maxlength="300" value="${cxEsc(r?.tags || '')}"></label>
    <label class="cx-check"><input type="checkbox" name="compra" ${r?.kind === 'ata_compra' ? 'checked' : ''}> É uma ata de aprovação de compra (aparece no processo de compra)</label>
    <label class="full">Observações internas (não saem na impressão)<input name="notes" maxlength="3000" value="${cxEsc(r?.notes || '')}"></label>${cxProcList()}
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button type="submit" value="save">Salvar</button><button class="primary" type="submit" value="print">Salvar e imprimir</button></div>
  </form>`);
  const form = document.getElementById('cxAtaForm');
  form.addEventListener('submit', ev => { form.dataset.go = ev.submitter?.value || 'save'; }, true);
  form.title.addEventListener('input', () => { form.title.dataset.auto = form.title.value ? '' : '1'; });
  cxEnablePaste('cxMinuteBody');
};
window.cxAtaTipoChanged = form => {
  form.querySelector('[data-tipo-outro]').hidden = form.tipo.value !== 'outra';
  const box = document.getElementById('cxSigners'), rows = [...box.querySelectorAll('.cx-signer')];
  const untouched = rows.every(row => !row.querySelector('[data-sname]').value.trim());
  if (untouched) { rows.forEach(r => r.remove()); box.querySelector('div:last-child').insertAdjacentHTML('beforebegin', cxSignerRows(CX_ATA_TIPOS[form.tipo.value].sign)); }
};
// Colar de Word/e-mail: mantém parágrafos, listas, negrito; remove estilos e imagens.
function cxEnablePaste(id) {
  const ed = document.getElementById(id); if (!ed) return;
  ed.addEventListener('paste', e => {
    const html = e.clipboardData?.getData('text/html'), text = e.clipboardData?.getData('text/plain');
    if (!html && !text) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, html ? cxSanitize(html) : cxPlainToHtml(text));
  });
}
function cxReadMinute(form) {
  const f = n => form[n]?.value?.trim?.() ?? '';
  return {tipo: f('tipo'), tipoOutro: f('tipoOutro'), numero: f('numero'), inicio: f('inicio'), fim: f('fim'), local: f('local'), conduzida: f('conduzida'), secretario: f('secretario'),
    participantes: form.participantes.value.trim(), pauta: form.pauta.value.trim(), encaminhamentos: form.encaminhamentos.value.trim(), listaPresenca: form.listaPresenca.checked, abertura: form.abertura.checked,
    assinantes: [...form.querySelectorAll('.cx-signer')].map(row => ({name: row.querySelector('[data-sname]').value.trim(), role: row.querySelector('[data-srole]').value.trim()})).filter(p => p.name || p.role)};
}
window.cxSubmitMinute = async (e, id) => {
  e.preventDefault(); const form = e.target, print = form.dataset.go === 'print';
  const ed = document.getElementById('cxMinuteBody');
  if (!ed.textContent.trim()) return alert('Escreva ou cole o conteúdo da reunião.');
  const meta = cxReadMinute(form), date = form.date.value;
  if (meta.tipo === 'outra' && !meta.tipoOutro) meta.tipoOutro = '';
  const title = form.title.value.trim() || cxAtaTitle({...meta, date});
  const popup = print ? window.open('', '_blank') : null; if (popup) popup.document.write('<p>Salvando ata…</p>');
  const body = {central: true, kind: form.compra.checked ? 'ata_compra' : 'ata', area: form.compra.checked ? 'compras' : CX_ATA_TIPOS[meta.tipo].area, date, title, processo: form.processo.value, notes: form.notes.value, tags: form.tags.value,
    presentes: meta.participantes.slice(0, 3000), body: cxSanitize(ed.innerHTML), meta};
  try {
    const saved = await cxRequest(id ? '/api/app/documents/' + id : '/api/app/documents', {method: id ? 'PUT' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    cxCloseModal(); await cxLoad(true); cxToast('Ata salva no arquivo.'); render();
    if (popup) cxPrintMinute(saved.id, popup);
  } catch (err) { popup?.close(); alert(err.message); }
};
const cxTime = t => (t ? t.replace(':', 'h') : '');
window.cxPrintMinute = (id, popup) => {
  const r = cx.records.find(x => x.id === id); if (!r) return;
  const m = r.meta || {tipo: cxAtaTipoOf(r), participantes: r.presentes || ''};
  const auto = !!r.meta && m.abertura !== false;
  const lines = t => String(t || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  const people = lines(m.participantes), pauta = lines(m.pauta), enc = lines(m.encaminhamentos);
  const full = cxAtaFull(m);
  const info = [['Data', cxLongDate(r.date)], ['Horário', m.inicio ? cxTime(m.inicio) + (m.fim ? ' às ' + cxTime(m.fim) : '') : ''], ['Local', m.local], ['Condução', m.conduzida], ['Secretário(a)', m.secretario]].filter(([, v]) => v);
  let html = '';
  if (auto) html += `<p style="text-align:justify">Aos ${cxEsc(cxLongDate(r.date))}${m.inicio ? ', às ' + cxEsc(cxTime(m.inicio)) : ''}${m.local ? (/^(cei|centro)/i.test(m.local) ? ', nas dependências do ' : ', em ') + cxEsc(m.local) : ''}, reuniram-se ${people.length ? 'as pessoas abaixo relacionadas' : 'os presentes'} para a ${cxEsc(full)}${m.conduzida ? ', sob a condução de ' + cxEsc(m.conduzida) : ''}.</p>`;
  if (people.length) html += `<h3>Participantes (${people.length})</h3><ul>${people.map(p => `<li>${cxEsc(p)}</li>`).join('')}</ul>`;
  if (pauta.length) html += `<h3>Pauta</h3><ol>${pauta.map(p => `<li>${cxEsc(p)}</li>`).join('')}</ol>`;
  html += `<h3>Desenvolvimento</h3>${cxBodyHtml(r.body)}`;
  if (enc.length) html += `<h3>Deliberações e encaminhamentos</h3><ol>${enc.map(p => `<li>${cxEsc(p)}</li>`).join('')}</ol>`;
  if (auto) html += `<p style="text-align:justify">Nada mais havendo a tratar, ${m.fim ? 'a reunião foi encerrada às ' + cxEsc(cxTime(m.fim)) + ', e ' : ''}eu${m.secretario ? ', ' + cxEsc(m.secretario) + ',' : ''} lavrei a presente ata, que, lida e aprovada, vai assinada por mim e pelos demais presentes.</p>`;
  const presence = m.listaPresenca && people.length ? `<h2 class="cx-pres-title">Lista de presença — ${cxEsc(full)} — ${cxEsc(cxBR(r.date))}</h2>` + people.map((p, i) => { const [n, role] = p.split(/\s+[—–-]\s+/); return `<div class="report-signature-row cx-pres"><span>${i + 1}. ${cxEsc(n)}${role ? `<small>${cxEsc(role)}</small>` : ''}</span><span class="cx-pres-line"></span></div>`; }).join('') : '';
  const title = `ATA${m.numero ? ' Nº ' + m.numero : ''} — ${full.toUpperCase()}`;
  cxLetterhead({title, meta: info, bodyHtml: html, dateIso: r.date, showDate: false, signers: (m.assinantes?.length ? m.assinantes : CX_ATA_TIPOS[m.tipo || 'outra'].sign.map(([name, role]) => ({name, role}))), extraHtml: presence}, popup);
};

/* ---------- Exclusão protegida: digitar o nome do documento ---------- */
// Tolerante a acentos, travessões (— – -), “nº/n°/no” e espaços: o objetivo é exigir atenção, não digitação perfeita.
const cxTypedNorm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[º°ª]/g, 'o').replace(/[‐-―−]/g, '-').replace(/\s*-\s*/g, ' - ').replace(/["“”'‘’]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
window.cxConfirmTyped = (name, detail = '') => new Promise(resolve => {
  let box = document.getElementById('cxConfirm');
  if (!box) { box = document.createElement('div'); box.id = 'cxConfirm'; box.className = 'modal cx-modal hidden'; document.body.append(box); }
  const done = ok => { box.classList.add('hidden'); box.innerHTML = ''; resolve(ok); };
  box.innerHTML = `<div class="modal-card" role="alertdialog" aria-modal="true" style="max-width:560px"><h2 style="color:#b3261e">Excluir documento?</h2>
    <p>Esta ação <b>não pode ser desfeita</b>.${detail ? ' ' + cxEsc(detail) : ''} O último backup completo baixado continua guardando o documento.</p>
    <p>Para confirmar, digite o nome do documento <b>por extenso</b>:</p>
    <p class="cx-confirm-name" style="background:#fdecea;border-radius:10px;padding:10px 12px;font-weight:700;user-select:none;-webkit-user-select:none">${cxEsc(name)}</p>
    <input id="cxConfirmInput" autocomplete="off" spellcheck="false" style="width:100%" placeholder="Digite o nome aqui">
    <p class="hint" id="cxConfirmHint">Copiar e colar está desativado nesta caixa, para evitar exclusões por engano. Acentos, travessão (pode usar hífen -) e “nº” (pode usar “no”) não precisam ser exatos.</p>
    <div class="actions"><button type="button" id="cxConfirmNo">Cancelar</button><button type="button" class="primary" id="cxConfirmYes" disabled>Excluir definitivamente</button></div></div>`;
  box.classList.remove('hidden');
  const input = box.querySelector('#cxConfirmInput'), yes = box.querySelector('#cxConfirmYes');
  ['paste', 'drop'].forEach(ev => input.addEventListener(ev, e => e.preventDefault()));
  input.addEventListener('input', () => { yes.disabled = cxTypedNorm(input.value) !== cxTypedNorm(name); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !yes.disabled) done(true); if (e.key === 'Escape') done(false); });
  yes.onclick = () => done(true); box.querySelector('#cxConfirmNo').onclick = () => done(false);
  setTimeout(() => input.focus(), 30);
});
// Aplica a confirmação digitada às exclusões das telas antigas (ofícios, encaminhamentos, documentos gerados, acervo da APP).
function cxGuardDelete(fnName, nameOf) {
  const original = window[fnName]; if (typeof original !== 'function') return;
  window[fnName] = async (...args) => {
    const name = nameOf(...args); if (!name) return original(...args);
    if (!await cxConfirmTyped(name)) return;
    const realConfirm = window.confirm; window.confirm = () => true;
    try { return await original(...args); } finally { window.confirm = realConfirm; }
  };
}
cxGuardDelete('deleteGeneratedDoc', id => (state.generatedDocs || []).find(x => x.id === id)?.name || 'este documento');
const cxOficioName = id => { const o = (state.oficios || []).find(x => x.id === id); return o ? `Ofício nº ${o.numero || ''}/${o.ano || ''}` : ''; };
cxGuardDelete('deleteOficio', cxOficioName);
cxGuardDelete('deleteOficioFromDocs', cxOficioName);
cxGuardDelete('deleteMeimei', id => { const x = (state.encaminhamentosMeimei || []).find(r => r.id === id); return x ? `Encaminhamento de ${x.crianca}` : ''; });
cxGuardDelete('deleteAppRecord', id => (typeof appArchiveRecords !== 'undefined' ? appArchiveRecords : []).find(r => r.id === id)?.title || '');

/* ---------- Papel timbrado livre (professores e administração) ---------- */
function cxTimbradoDocs() { return (state.generatedDocs || []).filter(g => g.template === 'documentoTimbrado' && (!CX_TEACHER || g.ownerEmail === CX_SESSION.email || !g.ownerEmail)).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))); }
function cxRenderTimbrado(a) {
  const docs = cxTimbradoDocs();
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Novo documento no papel timbrado</h2><p>Escolha um modelo. O texto é editável; cabeçalho, rodapé, margens e paginação A4 seguem o padrão do CEI.</p></div></div>
    <div class="cx-models">${Object.entries(CX_MODELS).map(([k, v]) => `<button class="cx-model" onclick="cxOpenTimbrado('${k}')"><span class="cx-ico">${v.ico}</span><b>${v.label}</b><small>${v.hint}</small></button>`).join('')}</div></div>
    <div class="panel"><div class="cx-head"><h2>${CX_TEACHER ? 'Meus documentos timbrados' : 'Documentos timbrados'}</h2><input id="cxTimbQ" type="search" placeholder="Pesquisar…" oninput="cxFilterTimbrado()" style="min-width:220px"></div><div id="cxTimbList" style="margin-top:12px"></div></div>`;
  cxFilterTimbrado();
}
window.cxFilterTimbrado = () => {
  const el = document.getElementById('cxTimbList'); if (!el) return;
  const q = cxNorm(document.getElementById('cxTimbQ')?.value || '');
  const docs = cxTimbradoDocs().filter(g => !q || cxNorm([g.name, g.reference, g.data?.recipient, g.data?.title].join(' ')).includes(q));
  el.innerHTML = docs.length ? docs.map(g => `<article class="cx-item"><div><div class="cx-chips"><span class="cx-chip">${cxEsc(CX_MODELS[g.data?.model]?.label || 'Documento')}</span></div><h4>${cxEsc(g.data?.title || g.name)}</h4><div class="cx-meta"><span>${cxEsc(cxBR(g.data?.date) || g.date || '')}</span>${g.data?.recipient ? `<span>${cxEsc(g.data.recipient)}</span>` : ''}${!CX_TEACHER && g.ownerEmail ? `<span>${cxEsc(g.ownerEmail)}</span>` : ''}</div></div><div class="cx-actions"><button class="cx-btn small" onclick="previewGenerated('${g.id}')">Visualizar / imprimir</button><button class="cx-btn small" onclick="cxOpenTimbrado(null,'${g.id}')">Editar</button><button class="cx-btn small" onclick="cxDuplicateTimbrado('${g.id}')">Duplicar</button><button class="cx-btn small danger" onclick="cxDeleteTimbrado('${g.id}')">Excluir</button></div></article>`).join('') : '<div class="cx-empty">Nenhum documento ainda. Escolha um modelo acima para começar.</div>';
};
window.cxOpenTimbrado = (model, id, copyFrom) => {
  const g = id ? (state.generatedDocs || []).find(x => x.id === id) : copyFrom || null;
  const d = g?.data || {}; const key = d.model || model || 'livre'; const t = CX_MODELS[key] || CX_MODELS.livre;
  const signers = d.signers?.length ? d.signers : (t.sign ? [{name: '', role: CX_TEACHER ? 'Professor(a)' : 'Direção'}] : []);
  cxModal(`<h2>${g && id ? 'Editar' : 'Novo'}: ${cxEsc(t.label)}</h2>
  <form class="cx-form" id="cxTimbForm" onsubmit="cxSaveTimbrado(event,'${id || ''}','${key}')">
    <label class="full">Título no documento<input name="title" maxlength="200" value="${cxEsc(d.title ?? t.title)}" placeholder="Deixe vazio para não exibir título"></label>
    <label>Destinatário / saudação (opcional)<input name="recipient" maxlength="200" value="${cxEsc(d.recipient ?? '')}" placeholder="Ex.: Turma Maternal II"></label>
    <label>Data *<input type="date" name="date" required value="${cxEsc(d.date || cxToday())}"></label>
    <div class="full"><label style="margin-bottom:6px!important">Texto *</label>${cxEditorHTML('cxTimbBody', d.bodyHtml || t.body)}</div>
    <label class="cx-check"><input type="checkbox" name="showDate" ${(d.showDate ?? t.date) ? 'checked' : ''}> Mostrar “Araquari, data por extenso” no final</label>
    <label class="cx-check"><input type="checkbox" name="hasSlip" ${(d.slip ?? (t.slip ? CX_SLIP : '')) ? 'checked' : ''} onchange="this.form.slip.closest('label').hidden=!this.checked"> Incluir canhoto destacável para a família devolver</label>
    <label class="full" ${(d.slip ?? (t.slip ? CX_SLIP : '')) ? '' : 'hidden'}>Texto do canhoto<textarea name="slip" rows="3" maxlength="1500">${cxEsc(d.slip || CX_SLIP)}</textarea></label>
    <div class="cx-signers" id="cxSigners"><b style="font-size:13px">Assinaturas</b>${signers.map(cxSignerRow).join('')}<div><button type="button" class="cx-btn small" onclick="document.getElementById('cxSigners').insertAdjacentHTML('beforeend',cxSignerRowHTML())">+ Adicionar assinatura</button></div></div>
    <p class="cx-progress full" id="cxTimbStatus" role="status"></p>
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button type="submit" value="save">Salvar</button><button class="primary" type="submit" value="print">Salvar e imprimir</button></div>
  </form>`);
  document.getElementById('cxTimbForm').addEventListener('submit', ev => { ev.target.dataset.go = ev.submitter?.value || 'save'; }, true);
};
function cxSignerRow(p = {}) { return `<div class="cx-signer"><input data-sname placeholder="Nome" maxlength="120" value="${cxEsc(p.name || '')}"><input data-srole placeholder="Cargo / função" maxlength="120" value="${cxEsc(p.role || '')}"><button type="button" class="cx-btn small danger" onclick="this.parentElement.remove()">Remover</button></div>`; }
window.cxSignerRowHTML = () => cxSignerRow({});
window.cxSaveTimbrado = async (e, id, model) => {
  e.preventDefault(); const form = e.target, print = form.dataset.go === 'print', status = document.getElementById('cxTimbStatus');
  const ed = document.getElementById('cxTimbBody'); if (!ed.textContent.trim()) return alert('Escreva o texto do documento.');
  const data = {model, title: form.title.value.trim(), recipient: form.recipient.value.trim(), date: form.date.value, bodyHtml: cxSanitize(ed.innerHTML), showDate: form.showDate.checked, slip: form.hasSlip.checked ? form.slip.value.trim() : '',
    signers: [...form.querySelectorAll('.cx-signer')].map(row => ({name: row.querySelector('[data-sname]').value.trim(), role: row.querySelector('[data-srole]').value.trim()})).filter(p => p.name || p.role)};
  const popup = print ? window.open('', '_blank') : null; if (popup) popup.document.write('<p>Salvando…</p>');
  form.querySelectorAll('button').forEach(b => { b.disabled = true; }); status.textContent = 'Salvando no servidor…';
  try {
    if (typeof sharedActive !== 'undefined' && !sharedActive) throw new Error('Sem conexão com o servidor. Use “Reconectar” no menu e tente de novo.');
    const now = new Date().toISOString(); state.generatedDocs = state.generatedDocs || [];
    const idx = id ? state.generatedDocs.findIndex(g => g.id === id) : -1, old = idx >= 0 ? state.generatedDocs[idx] : null;
    const rec = {ownerEmail: old?.ownerEmail || CX_SESSION.email, id: old?.id || cxId(), template: 'documentoTimbrado', name: data.title || CX_MODELS[model]?.label || 'Documento', date: typeof formatDate === 'function' ? formatDate(data.date) : cxBR(data.date), reference: data.recipient || '—', data, createdAt: old?.createdAt || now, updatedAt: now};
    if (idx >= 0) state.generatedDocs[idx] = rec; else state.generatedDocs.push(rec);
    await writeDataFile(false); await sharedQueue;
    if (localStorage.getItem('cei-shared-dirty') === '1') throw new Error('O servidor não confirmou a gravação. Seu texto foi mantido neste navegador; tente novamente em instantes.');
    cxCloseModal(); cxToast('Documento salvo.'); render();
    if (popup) cxPrintTimbrado(rec, popup);
  } catch (err) { popup?.close(); status.textContent = err.message; alert(err.message); form.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
};
function cxPrintTimbrado(g, popup) { const d = g.data || {}; cxLetterhead({title: d.title, bodyHtml: d.bodyHtml, dateIso: d.date, showDate: d.showDate, signers: d.signers || [], slip: d.slip, recipient: d.recipient}, popup); }
window.cxDuplicateTimbrado = id => { const g = (state.generatedDocs || []).find(x => x.id === id); if (g) cxOpenTimbrado(g.data?.model, null, {data: {...structuredClone(g.data), date: cxToday()}}); };
window.cxDeleteTimbrado = async id => {
  const g = (state.generatedDocs || []).find(x => x.id === id); if (!g || !await cxConfirmTyped(g.name)) return;
  state.generatedDocs = state.generatedDocs.filter(x => x.id !== id); await writeDataFile(false); cxToast('Documento excluído.'); render();
};
// Visualizar / editar pelos fluxos já existentes
const cxPrevPreview = window.previewGenerated, cxPrevReopen = window.reopenGenerated;
window.previewGenerated = id => { const g = (state.generatedDocs || []).find(x => x.id === id); if (g?.template === 'documentoTimbrado') return cxPrintTimbrado(g); if (g?.template === 'declaracao' && g.data?.v === 1) return cxPrintDecl(g); return cxPrevPreview(id); };
window.reopenGenerated = id => { const g = (state.generatedDocs || []).find(x => x.id === id); if (g?.template === 'documentoTimbrado') return cxOpenTimbrado(null, id); if (g?.template === 'declaracao' && g.data?.v === 1) return cxOpenDecl(null, id); return cxPrevReopen(id); };

/* ---------- Declarações (v44) ---------- */
const CX_DECL_MODELS = {
  comparecimento: {ico: '🕒', label: 'Declaração de comparecimento', hint: 'Pais ou responsáveis que estiveram no CEI (reunião, atendimento, matrícula…)', title: 'DECLARAÇÃO DE COMPARECIMENTO'},
  livre: {ico: '📄', label: 'Declaração (texto livre)', hint: 'Qualquer outra declaração da direção, no papel timbrado', title: 'DECLARAÇÃO'},
};
const CX_DECL_MOTIVOS = ['participar de reunião de pais e responsáveis', 'atendimento com a direção', 'atendimento com a coordenação pedagógica', 'atendimento com a professora da turma', 'tratar de matrícula / vaga', 'entregar ou retirar documentos', 'buscar a criança por motivo de saúde', 'participar de evento promovido pelo CEI'];
const CX_DECL_FINS = ['comprovação junto ao empregador', 'justificativa de ausência no trabalho', 'comprovação junto a órgão público', 'apresentação onde se fizer necessário'];
function cxDeclText(d) {
  const fem = ['mãe', 'avó'].includes(d.parentesco), masc = ['pai', 'avô'].includes(d.parentesco), g = (f, m, n) => (fem ? f : masc ? m : n);
  const quem = [`<b>${cxEsc(d.nome || '________________________________')}</b>`];
  if (d.documento) quem.push(`${g('portadora', 'portador', 'portador(a)')} do documento ${cxEsc(d.documento)}`);
  if (d.crianca) quem.push(`${d.parentesco ? cxEsc(d.parentesco) : 'responsável'} pela criança <b>${cxEsc(d.crianca)}</b>${d.turma ? `, matriculada na turma ${cxEsc(d.turma)}` : ''}`);
  const quando = `no dia ${cxEsc(cxLongDate(d.dia) || '___ de __________ de ______')}${d.inicio ? (d.fim ? `, das ${cxEsc(d.inicio)} às ${cxEsc(d.fim)}` : `, às ${cxEsc(d.inicio)}`) : ''}`;
  const motivo = d.motivo === 'outro' ? (d.motivoOutro || '__________') : d.motivo;
  const fim = d.fins;
  return `<p style="text-align:justify">Declaramos, para os devidos fins, que ${quem.join(', ')}, compareceu ao Centro de Educação Infantil Lindolpho José da Silva ${quando}, para ${cxEsc(motivo)}.</p>`
    + (fim ? `<p style="text-align:justify">A presente declaração é emitida a pedido ${g('da interessada', 'do interessado', 'do(a) interessado(a)')}, para fins de ${cxEsc(fim)}.</p>` : '')
    + '<p style="text-align:justify">Por ser expressão da verdade, firmamos a presente declaração.</p>';
}
function cxDeclDocs() { return (state.generatedDocs || []).filter(g => g.template === 'declaracao').sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))); }
function cxRenderDeclaracoes(root) {
  root.innerHTML = `<div class="docs-section-head"><div><h3>Declarações</h3><p>Declarações no papel timbrado, com data por extenso e assinatura da direção. Ficam arquivadas e podem ser reimpressas.</p></div><button class="primary" onclick="cxOpenDecl('comparecimento')">+ Declaração de comparecimento</button></div>
    <div class="cx-models">${Object.entries(CX_DECL_MODELS).map(([k, v]) => `<button class="cx-model" onclick="cxOpenDecl('${k}')"><span class="cx-ico">${v.ico}</span><b>${v.label}</b><small>${v.hint}</small></button>`).join('')}</div>
    <div class="panel"><div class="cx-head"><h2>Declarações emitidas</h2><input id="cxDeclQ" type="search" placeholder="Pesquisar por nome, criança, data…" oninput="cxFilterDecl()" style="min-width:240px"></div><div id="cxDeclList" style="margin-top:12px"></div></div>`;
  cxFilterDecl();
}
window.cxFilterDecl = () => {
  const el = document.getElementById('cxDeclList'); if (!el) return;
  const q = cxNorm(document.getElementById('cxDeclQ')?.value || '');
  const docs = cxDeclDocs().filter(g => !q || cxNorm([g.name, g.reference, g.data?.crianca, g.data?.turma, cxBR(g.data?.dia)].join(' ')).includes(q));
  el.innerHTML = docs.length ? docs.map(g => { const d = g.data || {}; const legacy = d.v !== 1; return `<article class="cx-item"><div><div class="cx-chips"><span class="cx-chip">${cxEsc(CX_DECL_MODELS[d.model]?.label || 'Declaração')}</span></div><h4>${cxEsc(d.nome || g.reference || g.name)}</h4><div class="cx-meta">${d.dia ? `<span>Compareceu em ${cxEsc(cxBR(d.dia))}</span>` : ''}${d.crianca ? `<span>Criança: ${cxEsc(d.crianca)}${d.turma ? ' · ' + cxEsc(d.turma) : ''}</span>` : ''}<span>Emitida em ${cxEsc(cxBR(d.emissao) || g.date || '')}</span></div></div><div class="cx-actions"><button class="cx-btn small" onclick="previewGenerated('${g.id}')">Imprimir</button>${legacy ? '' : `<button class="cx-btn small" onclick="cxOpenDecl(null,'${g.id}')">Editar</button><button class="cx-btn small" onclick="cxOpenDecl(null,'${g.id}',true)">Nova a partir desta</button>`}<button class="cx-btn small danger" onclick="cxDeleteTimbrado('${g.id}')">Excluir</button></div></article>`; }).join('') : '<div class="cx-empty">Nenhuma declaração emitida ainda.</div>';
};
const cxSigner = () => { try { return JSON.parse(localStorage.getItem('cei-decl-assinante') || 'null') || {}; } catch { return {}; } };
window.cxOpenDecl = (model, id, copy) => {
  const g = id ? (state.generatedDocs || []).find(x => x.id === id) : null;
  const d = g ? structuredClone(g.data) : {model: model || 'comparecimento', dia: cxToday(), emissao: cxToday(), motivo: CX_DECL_MOTIVOS[0], fins: CX_DECL_FINS[0], ...cxSigner()};
  if (copy) { d.nome = ''; d.documento = ''; d.crianca = ''; d.turma = ''; d.emissao = cxToday(); d.textoEditado = false; }
  const key = d.model || 'comparecimento', livre = key === 'livre', editing = g && !copy;
  const opt = (list, val, otherVal) => list.map(x => `<option ${x === val ? 'selected' : ''}>${cxEsc(x)}</option>`).join('') + `<option value="outro" ${val === 'outro' || (val && !list.includes(val) && val !== '') ? 'selected' : ''}>Outro (escrever)</option>`;
  cxModal(`<h2>${editing ? 'Editar' : 'Nova'}: ${cxEsc(CX_DECL_MODELS[key].label)}</h2>
  <form class="cx-form" id="cxDeclForm" oninput="cxDeclPreview()" onchange="cxDeclPreview()" onsubmit="cxSaveDecl(event,'${editing ? g.id : ''}','${key}')">
    ${livre ? '' : `<label class="full">Nome de quem compareceu *<input name="nome" required maxlength="160" value="${cxEsc(d.nome || '')}" placeholder="Ex.: Ana Paula da Silva"></label>
    <label>Documento (opcional)<input name="documento" maxlength="60" value="${cxEsc(d.documento || '')}" placeholder="Ex.: CPF 000.000.000-00"></label>
    <label>Relação com a criança<select name="parentesco">${['mãe', 'pai', 'responsável', 'avó', 'avô', 'tio(a)'].map(x => `<option ${x === (d.parentesco || 'responsável') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Criança (opcional)<input name="crianca" maxlength="160" value="${cxEsc(d.crianca || '')}"></label>
    <label>Turma (opcional)<input name="turma" maxlength="80" value="${cxEsc(d.turma || '')}" placeholder="Ex.: Maternal II"></label>
    <label>Data do comparecimento *<input type="date" name="dia" required value="${cxEsc(d.dia || cxToday())}"></label>
    <div class="cx-btns" style="gap:8px"><label style="flex:1">Chegada<input type="time" name="inicio" value="${cxEsc(d.inicio || '')}"></label><label style="flex:1">Saída<input type="time" name="fim" value="${cxEsc(d.fim || '')}"></label></div>
    <label>Motivo *<select name="motivo">${opt(CX_DECL_MOTIVOS, CX_DECL_MOTIVOS.includes(d.motivo) || !d.motivo ? d.motivo : 'outro')}</select></label>
    <label data-other="motivo">Qual motivo?<input name="motivoOutro" maxlength="200" value="${cxEsc(d.motivoOutro || (CX_DECL_MOTIVOS.includes(d.motivo) ? '' : d.motivo || ''))}"></label>
    <label>Finalidade<select name="fins">${opt(CX_DECL_FINS, CX_DECL_FINS.includes(d.fins) || !d.fins ? d.fins : 'outro')}</select></label>
    <label data-other="fins">Qual finalidade?<input name="finsOutro" maxlength="200" value="${cxEsc(d.finsOutro || (CX_DECL_FINS.includes(d.fins) ? '' : d.fins || ''))}"></label>`}
    <div class="full"><label style="margin-bottom:6px!important">Texto da declaração ${livre ? '*' : '<small class="muted">(montado automaticamente; você pode ajustar)</small>'}</label>${cxEditorHTML('cxDeclBody', d.textoEditado || livre ? (d.bodyHtml || '<p>Declaramos, para os devidos fins, que </p><p>Por ser expressão da verdade, firmamos a presente declaração.</p>') : '')}</div>
    ${livre ? '' : `<p class="hint full" id="cxDeclAuto">${d.textoEditado ? 'Você editou o texto; mudanças nos campos acima não alteram mais o texto. <a href="#" onclick="event.preventDefault();cxDeclReset()">Voltar ao texto automático</a>' : ''}</p>`}
    <label>Data da emissão *<input type="date" name="emissao" required value="${cxEsc(d.emissao || cxToday())}"></label>
    <span></span>
    <label>Quem assina *<input name="assinante" required maxlength="120" value="${cxEsc(d.assinante || '')}" placeholder="Nome do(a) diretor(a)"></label>
    <label>Cargo *<input name="cargo" required maxlength="120" value="${cxEsc(d.cargo || 'Diretor(a)')}"></label>
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button type="submit" value="save">Salvar</button><button class="primary" type="submit" value="print">Salvar e imprimir</button></div>
  </form>`);
  const form = document.getElementById('cxDeclForm');
  form.dataset.edited = d.textoEditado || livre ? '1' : '';
  form.addEventListener('submit', ev => { form.dataset.go = ev.submitter?.value || 'save'; }, true);
  document.getElementById('cxDeclBody').addEventListener('input', ev => { ev.stopPropagation(); if (!livre) { form.dataset.edited = '1'; document.getElementById('cxDeclAuto').innerHTML = 'Você editou o texto; mudanças nos campos acima não alteram mais o texto. <a href="#" onclick="event.preventDefault();cxDeclReset()">Voltar ao texto automático</a>'; } });
  cxDeclPreview();
};
function cxDeclRead(form) {
  const f = n => form[n]?.value?.trim?.() ?? '';
  return {nome: f('nome'), documento: f('documento'), parentesco: f('parentesco'), crianca: f('crianca'), turma: f('turma'), dia: f('dia'), inicio: f('inicio'), fim: f('fim'),
    motivo: f('motivo') === 'outro' ? f('motivoOutro') : f('motivo'), motivoOutro: f('motivoOutro'), fins: f('fins') === 'outro' ? f('finsOutro') : f('fins'), finsOutro: f('finsOutro'),
    emissao: f('emissao'), assinante: f('assinante'), cargo: f('cargo')};
}
window.cxDeclPreview = () => {
  const form = document.getElementById('cxDeclForm'); if (!form) return;
  form.querySelectorAll('[data-other]').forEach(l => { l.hidden = form[l.dataset.other]?.value !== 'outro'; });
  if (form.dataset.edited || !form.nome) return;
  const d = cxDeclRead(form);
  document.getElementById('cxDeclBody').innerHTML = cxDeclText({...d, motivo: d.motivo || '__________', fins: d.fins});
};
window.cxDeclReset = () => { const form = document.getElementById('cxDeclForm'); form.dataset.edited = ''; document.getElementById('cxDeclAuto').innerHTML = ''; cxDeclPreview(); };
window.cxSaveDecl = async (e, id, model) => {
  e.preventDefault(); const form = e.target, print = form.dataset.go === 'print';
  const d = {v: 1, model, ...cxDeclRead(form)};
  const ed = document.getElementById('cxDeclBody');
  if (model !== 'livre' && (!d.nome || !d.dia || !d.motivo)) return alert('Preencha o nome, a data e o motivo do comparecimento.');
  if (!ed.textContent.trim()) return alert('O texto da declaração está vazio.');
  d.textoEditado = !!form.dataset.edited; d.bodyHtml = cxSanitize(ed.innerHTML);
  try { localStorage.setItem('cei-decl-assinante', JSON.stringify({assinante: d.assinante, cargo: d.cargo})); } catch {}
  const popup = print ? window.open('', '_blank') : null; if (popup) popup.document.write('<p>Salvando…</p>');
  try {
    if (typeof sharedActive !== 'undefined' && !sharedActive) throw new Error('Sem conexão com o servidor. Use “Reconectar” no menu e tente de novo.');
    const now = new Date().toISOString(); state.generatedDocs = state.generatedDocs || [];
    const idx = id ? state.generatedDocs.findIndex(g => g.id === id) : -1, old = idx >= 0 ? state.generatedDocs[idx] : null;
    const rec = {ownerEmail: old?.ownerEmail || CX_SESSION.email, id: old?.id || cxId(), template: 'declaracao', name: `${CX_DECL_MODELS[model].label}${d.nome ? ' — ' + d.nome : ''}`, date: typeof formatDate === 'function' ? formatDate(d.emissao) : cxBR(d.emissao), reference: d.nome ? d.nome + (d.crianca ? ' (resp. ' + d.crianca + ')' : '') : '—', data: d, createdAt: old?.createdAt || now, updatedAt: now};
    if (idx >= 0) state.generatedDocs[idx] = rec; else state.generatedDocs.push(rec);
    await writeDataFile(false); await sharedQueue;
    if (localStorage.getItem('cei-shared-dirty') === '1') throw new Error('O servidor não confirmou a gravação. Tente novamente em instantes.');
    cxCloseModal(); cxToast('Declaração salva.'); render();
    if (popup) cxPrintDecl(rec, popup);
  } catch (err) { popup?.close(); alert(err.message); }
};
function cxPrintDecl(g, popup) {
  const d = g.data || {};
  cxLetterhead({title: CX_DECL_MODELS[d.model]?.title || 'DECLARAÇÃO', bodyHtml: d.bodyHtml || cxDeclText(d), dateIso: d.emissao, showDate: true, signers: [{name: d.assinante, role: d.cargo}]}, popup);
}

/* ---------- Início do professor ---------- */
function cxRenderTeacherHome(a) {
  document.getElementById('title').textContent = 'Espaço do Professor';
  document.getElementById('subtitle').textContent = 'Materiais no papel timbrado, registros pedagógicos e biblioteca';
  const mine = cxTimbradoDocs().slice(0, 4);
  a.innerHTML = `<div class="cx-teacher-cards"><button onclick="cxGo('timbrado')"><span class="cx-ico">📄</span><b>Papel timbrado</b><small>Comunicados, bilhetes, autorizações, convites e atividades no padrão do CEI.</small></button><button onclick="cxGo('documentos')"><span class="cx-ico">📝</span><b>Relatórios e registros</b><small>Relatórios avaliativos e registros de prática alimentar.</small></button><button onclick="cxGo('biblioteca')"><span class="cx-ico">📚</span><b>Biblioteca</b><small>Consulte o acervo, peça livros e acompanhe seus empréstimos.</small></button></div>
    <div class="panel"><div class="cx-head"><h2>Criar agora</h2></div><div class="cx-models">${['comunicado', 'bilhete', 'autorizacao', 'atividade'].map(k => `<button class="cx-model" onclick="cxOpenTimbrado('${k}')"><span class="cx-ico">${CX_MODELS[k].ico}</span><b>${CX_MODELS[k].label}</b><small>${CX_MODELS[k].hint}</small></button>`).join('')}</div></div>
    ${mine.length ? `<div class="panel"><div class="cx-head"><h2>Últimos documentos</h2><button class="cx-btn small" onclick="cxGo('timbrado')">Ver todos</button></div><div style="margin-top:10px">${mine.map(g => `<article class="cx-item"><div><h4>${cxEsc(g.data?.title || g.name)}</h4><div class="cx-meta"><span>${cxEsc(cxBR(g.data?.date))}</span><span>${cxEsc(CX_MODELS[g.data?.model]?.label || '')}</span></div></div><div class="cx-actions"><button class="cx-btn small" onclick="previewGenerated('${g.id}')">Imprimir</button><button class="cx-btn small" onclick="cxOpenTimbrado(null,'${g.id}')">Editar</button></div></article>`).join('')}</div></div>` : ''}`;
}

/* ---------- Financeiro ---------- */
function cxFinance(year, records = cx.records) {
  const fins = records.filter(r => r.fin && String(r.date || '').slice(0, 4) === String(year));
  const accounts = Object.keys(CX_ACCOUNTS).map(account => {
    const list = fins.filter(r => r.fin.account === account);
    const sum = (move, nature) => list.filter(r => r.fin.move === move && (nature === undefined || (r.fin.nature || '') === nature)).reduce((s, r) => s + r.fin.amount, 0);
    const nat = {}; for (const n of ['custeio', 'capital', '']) nat[n] = sum('saldo_inicial', n) + sum('entrada', n) - sum('saida', n);
    const initial = sum('saldo_inicial'), inflow = sum('entrada'), outflow = sum('saida');
    const balance = initial + inflow - outflow;
    // conferência: último extrato (somando o mais recente de cada tipo de saldo na data mais recente)
    const st = list.filter(r => r.fin.move === 'saldo_extrato').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let recon = null;
    if (st.length) {
      const date = st[0].date; const byType = {};
      st.filter(r => r.date.slice(0, 7) === date.slice(0, 7)).forEach(r => { const k = r.fin.statementType || 'conta_corrente'; if (!byType[k]) byType[k] = r; });
      const bank = byType.consolidado ? byType.consolidado.fin.amount : Object.values(byType).reduce((s, r) => s + r.fin.amount, 0);
      const upTo = list.filter(r => r.date <= date);
      const calc = upTo.filter(r => r.fin.move === 'saldo_inicial').reduce((s, r) => s + r.fin.amount, 0) + upTo.filter(r => r.fin.move === 'entrada').reduce((s, r) => s + r.fin.amount, 0) - upTo.filter(r => r.fin.move === 'saida').reduce((s, r) => s + r.fin.amount, 0);
      recon = {date, bank, calc, diff: calc - bank, types: Object.keys(byType)};
    }
    return {account, list, initial, inflow, outflow, balance, nat, recon, count: list.length};
  });
  return {fins, accounts};
}
function cxRenderFinance(a) {
  a.innerHTML = '<div class="panel" style="margin-top:0"><p class="muted">Carregando lançamentos…</p></div>';
  cxLoad().then(() => { if (state.view === 'financeiro') cxDrawFinance(a); }).catch(e => { a.innerHTML = `<div class="panel"><div class="cx-empty">${cxEsc(e.message)}</div></div>`; });
}
function cxDrawFinance(a) {
  const years = [...new Set(cx.records.filter(r => r.fin).map(r => String(r.date).slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
  const {accounts} = cxFinance(cx.finYear), sel = cx.finAccount, ff = cx.finFilter;
  const acc = sel ? accounts.find(x => x.account === sel) : null;
  const list = (acc ? acc.list : accounts.flatMap(x => x.list)).filter(r => (!ff.move || r.fin.move === ff.move) && (!ff.nature || (r.fin.nature || '') === ff.nature) && (!ff.category || r.fin.category === ff.category)).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const outs = (acc ? acc.list : accounts.flatMap(x => x.list)).filter(r => r.fin.move === 'saida');
  const byCat = {}; outs.forEach(r => { const k = r.fin.category || 'Sem categoria'; byCat[k] = (byCat[k] || 0) + r.fin.amount; });
  const catRows = Object.entries(byCat).sort((x, y) => y[1] - x[1]); const maxCat = Math.max(1, ...catRows.map(x => x[1]));
  const tot = acc || accounts.reduce((s, x) => ({initial: s.initial + x.initial, inflow: s.inflow + x.inflow, outflow: s.outflow + x.outflow, balance: s.balance + x.balance, nat: {custeio: s.nat.custeio + x.nat.custeio, capital: s.nat.capital + x.nat.capital, '': s.nat[''] + x.nat['']}}), {initial: 0, inflow: 0, outflow: 0, balance: 0, nat: {custeio: 0, capital: 0, '': 0}});
  const reconChip = x => !x.recon ? '<span class="cx-chip warn">Sem extrato lançado</span>' : Math.abs(x.recon.diff) < 1 ? `<span class="cx-chip ok">✓ Confere com o extrato de ${cxBR(x.recon.date)}</span>` : `<span class="cx-chip bad">Diferença de ${cxMoney(x.recon.diff)} · extrato ${cxBR(x.recon.date)}: ${cxMoney(x.recon.bank)}</span>`;
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Saldos por conta</h2><p>Saldo calculado = saldo inicial do ano + entradas − despesas. A conferência compara com o último saldo de extrato lançado.</p></div>
    <div class="cx-btns"><label class="muted" style="display:flex;align-items:center;gap:6px">Ano <select onchange="cxState.finYear=this.value;render()">${years.map(y => `<option ${y === cx.finYear ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <button class="cx-btn primary" onclick="cxOpenUpload({kind:'nota_fiscal',area:'financeiro'})">🧾 Lançar nota / despesa</button><button class="cx-btn" onclick="cxOpenUpload({kind:'repasse',area:'financeiro'})">＋ Lançar entrada</button><button class="cx-btn" onclick="cxOpenUpload({kind:'extrato',area:'financeiro'})">🏦 Lançar extrato</button><button class="cx-btn" onclick="cxOpenInitial()">Saldo inicial do ano</button></div></div>
    <div class="cx-accounts"><button class="cx-account ${sel ? '' : 'active'}" onclick="cxState.finAccount='';render()"><h3>Todas as contas</h3><div class="cx-big">${cxMoney(accounts.reduce((s, x) => s + x.balance, 0))}</div><div class="cx-split"><span>Entradas <b>${cxMoney(accounts.reduce((s, x) => s + x.inflow, 0))}</b></span><span>Despesas <b>${cxMoney(accounts.reduce((s, x) => s + x.outflow, 0))}</b></span></div></button>
    ${accounts.filter(x => x.count || x.account !== 'OUTRA').map(x => { const c = CX_ACCOUNTS[x.account]; return `<button class="cx-account ${sel === x.account ? 'active' : ''}" onclick="cxState.finAccount='${x.account}';render()"><h3>${cxEsc(c.label)}</h3><small class="muted">${cxEsc(c.sub)}</small><div class="cx-big" style="color:${x.balance < 0 ? 'var(--cx-bad)' : 'inherit'}">${cxMoney(x.balance)}</div>${c.natures && (x.nat.custeio || x.nat.capital) ? `<div class="cx-split"><span>Custeio <b>${cxMoney(x.nat.custeio)}</b></span><span>Capital <b>${cxMoney(x.nat.capital)}</b></span>${x.nat[''] ? `<span>Sem natureza <b>${cxMoney(x.nat[''])}</b></span>` : ''}</div>` : ''}<div class="cx-recon">${x.count ? reconChip(x) : '<span class="muted">Nenhum lançamento</span>'}</div></button>`; }).join('')}</div></div>
    <div class="cx-cols"><div class="panel"><h2>${acc ? cxEsc(CX_ACCOUNTS[acc.account].label) : 'Resumo do ano'} · ${cxEsc(cx.finYear)}</h2><div class="cx-summary-grid"><div>Saldo inicial<b>${cxMoney(tot.initial)}</b></div><div>Entradas<b style="color:var(--cx-ok)">${cxMoney(tot.inflow)}</b></div><div>Despesas<b style="color:var(--cx-bad)">${cxMoney(tot.outflow)}</b></div><div>Saldo calculado<b>${cxMoney(tot.balance)}</b></div></div>
      ${(tot.nat.custeio || tot.nat.capital) ? `<div class="cx-summary-grid"><div>Saldo custeio<b>${cxMoney(tot.nat.custeio)}</b></div><div>Saldo capital<b>${cxMoney(tot.nat.capital)}</b></div></div>` : ''}${acc && acc.recon ? `<p style="margin-top:10px">${reconChip(acc)}</p>` : ''}</div>
      <div class="panel"><h2>Despesas por categoria</h2>${catRows.length ? `<div class="cx-bars">${catRows.map(([k, v]) => `<div class="cx-bar"><span>${cxEsc(k)}</span><div class="track"><div class="fill" style="width:${Math.max(2, v / maxCat * 100)}%"></div></div><b class="cx-num">${cxMoney(v)}</b></div>`).join('')}</div>` : '<p class="muted">Nenhuma despesa lançada.</p>'}</div></div>
    <div class="panel"><div class="cx-head"><h2>Lançamentos</h2><div class="cx-btns"><select onchange="cxState.finFilter.move=this.value;render()"><option value="">Todos os movimentos</option>${cxOptions(CX_MOVES, ff.move)}</select><select onchange="cxState.finFilter.nature=this.value;render()"><option value="">Custeio e capital</option><option value="custeio" ${ff.nature === 'custeio' ? 'selected' : ''}>Custeio</option><option value="capital" ${ff.nature === 'capital' ? 'selected' : ''}>Capital</option></select><select onchange="cxState.finFilter.category=this.value;render()"><option value="">Todas as categorias</option>${[...CX_CATS.saida, ...CX_CATS.entrada].map(c => `<option ${c === ff.category ? 'selected' : ''}>${cxEsc(c)}</option>`).join('')}</select><button class="cx-btn" onclick="cxExportCSV()">⬇ Planilha (CSV)</button></div></div>
    ${list.length ? `<div class="cx-table-wrap"><table class="cx-table"><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Natureza / categoria</th><th class="r">Valor</th><th></th></tr></thead><tbody>${list.map(r => `<tr><td>${cxEsc(cxBR(r.date))}</td><td><b>${cxEsc(r.title)}</b>${r.fin.supplier ? `<br><span class="muted">${cxEsc(r.fin.supplier)}${r.fin.docNumber ? ' · nº ' + cxEsc(r.fin.docNumber) : ''}</span>` : ''}${r.processo ? `<br><button class="cx-chip" onclick="cxGo('arquivo',{processo:${cxEsc(JSON.stringify(r.processo))}})">📁 ${cxEsc(r.processo)}</button>` : ''}</td><td>${cxEsc(CX_ACCOUNTS[r.fin.account]?.label)}${r.fin.move === 'saldo_extrato' ? `<br><span class="muted">${cxEsc(CX_STATEMENTS[r.fin.statementType] || '')}</span>` : ''}</td><td>${cxEsc(CX_MOVES[r.fin.move])}${r.fin.nature ? '<br>' + CX_NATURES[r.fin.nature] : ''}${r.fin.category ? '<br><span class="muted">' + cxEsc(r.fin.category) + '</span>' : ''}</td><td class="r"><span class="cx-money ${r.fin.move === 'entrada' ? 'in' : r.fin.move === 'saida' ? 'out' : ''}">${r.fin.move === 'saida' ? '− ' : r.fin.move === 'entrada' ? '+ ' : ''}${cxMoney(r.fin.amount)}</span></td><td style="white-space:nowrap">${cxViewable(r.file) ? `<a class="cx-btn small" href="/api/app/documents/${r.id}/file?view=1" target="_blank" rel="noopener">Ver</a> ` : ''}<button class="cx-btn small" onclick="cxOpenEdit('${r.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="cx-empty">Nenhum lançamento neste filtro. Lance notas fiscais, repasses e saldos de extrato pelos botões acima, ou marque “Registrar valor no Financeiro” ao enviar um documento.</div>'}
    <p class="hint">Este controle é um apoio para a direção e a APP. A prestação de contas oficial (PDDE/FNDE e município) segue os sistemas e prazos dos órgãos responsáveis.</p></div>`;
}
window.cxOpenInitial = () => cxOpenUpload({kind: 'lancamento', area: 'financeiro', date: `${cx.finYear}-01-01`, initial: true}) || setTimeout(() => {
  const form = document.getElementById('cxUpForm'); if (!form) return;
  form.finMove.value = 'saldo_inicial'; form.hasFin.checked = true; form.hasFin.dataset.touched = '1';
  form.title.value = `Saldo inicial ${cx.finYear}`; cxToggleFin(form);
}, 0);
window.cxExportCSV = () => {
  const rows = cx.records.filter(r => r.fin && String(r.date).slice(0, 4) === cx.finYear && (!cx.finAccount || r.fin.account === cx.finAccount)).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Data', 'Conta', 'Movimento', 'Natureza', 'Categoria', 'Descrição', 'Fornecedor/origem', 'Nº documento', 'Processo', 'Valor (R$)', 'Arquivo'].map(q).join(';')]
    .concat(rows.map(r => [cxBR(r.date), CX_ACCOUNTS[r.fin.account]?.label, CX_MOVES[r.fin.move], CX_NATURES[r.fin.nature] || '', r.fin.category, r.title, r.fin.supplier, r.fin.docNumber, r.processo, ((r.fin.move === 'saida' ? -1 : 1) * r.fin.amount / 100).toFixed(2).replace('.', ','), r.file?.name || ''].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `financeiro_${cx.finYear}${cx.finAccount ? '_' + cx.finAccount : ''}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 2000);
};

/* ---------- Página pública (gestão) ---------- */
const cxPub = {settings: null};
function cxRenderPublic(a) {
  a.innerHTML = '<div class="panel" style="margin-top:0"><p class="muted">Carregando…</p></div>';
  Promise.all([cxRequest('/api/portal/public-settings'), cxLoad(true)]).then(([st]) => { cxPub.settings = st; if (state.view === 'publica') cxDrawPublic(a); }).catch(e => { a.innerHTML = `<div class="panel"><div class="cx-empty">${cxEsc(e.message)}</div></div>`; });
}
function cxDrawPublic(a) {
  const st = cxPub.settings, info = st.info, today = cxToday();
  const pubs = cx.records.filter(r => cx.publicIds.has(r.id));
  const byCat = {}; pubs.forEach(r => { const c = cx.publicMeta?.[r.id]?.category || cxGuessPub(r); (byCat[c] = byCat[c] || []).push(r); });
  const suggest = cx.records.filter(r => r.file && !cx.publicIds.has(r.id) && ['regimento', 'ppp', 'calendario', 'cardapio', 'estatuto'].includes(r.kind));
  const empty = Object.keys(CX_PUBCATS).filter(k => !byCat[k] && ['regimento', 'ppp', 'conselho', 'calendario'].includes(k));
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Página pública do CEI</h2><p>Avisos, documentos e informações abertos a qualquer pessoa. Nada da área restrita aparece lá sem ser publicado aqui.</p></div><div class="cx-btns"><a class="cx-btn primary" href="/" target="_blank" rel="noopener">Ver página pública ↗</a></div></div>
    <div class="cx-stats"><div class="cx-stat"><small>Documentos publicados</small><b>${pubs.length}</b></div><div class="cx-stat"><small>Avisos no ar</small><b>${st.notices.filter(n => !n.until || n.until >= today).length}</b></div><div class="cx-stat"><small>Seções com documentos</small><b>${Object.keys(byCat).length} de ${Object.keys(CX_PUBCATS).length}</b></div></div></div>

  <div class="panel"><div class="cx-head"><div><h2>Avisos da direção</h2><p>Aparecem no topo da página pública. Use “Mostrar até” para que saiam do ar sozinhos.</p></div><button class="cx-btn primary" onclick="cxOpenNotice()">+ Novo aviso</button></div>
    <div style="margin-top:12px">${st.notices.length ? st.notices.map(n => { const expired = n.until && n.until < today; return `<article class="cx-item"><div><div class="cx-chips">${n.pinned ? '<span class="cx-chip pub">📌 Fixado</span>' : ''}${expired ? '<span class="cx-chip">Encerrado</span>' : '<span class="cx-chip ok">No ar</span>'}</div><h4>${cxEsc(n.title)}</h4><div class="cx-meta"><span>Publicado em ${cxEsc(cxBR(n.date))}</span>${n.until ? `<span>Mostrar até ${cxEsc(cxBR(n.until))}</span>` : '<span>Sem data final</span>'}</div>${n.body ? `<div class="cx-notes">${cxEsc(n.body.slice(0, 220))}${n.body.length > 220 ? '…' : ''}</div>` : ''}</div><div class="cx-actions"><button class="cx-btn small" onclick="cxOpenNotice('${n.id}')">Editar</button><button class="cx-btn small danger" onclick="cxDeleteNotice('${n.id}')">Excluir</button></div></article>`; }).join('') : '<div class="cx-empty">Nenhum aviso. Ex.: “Reunião de pais dia 12/11 às 18h”, “Feriado — não haverá aula”.</div>'}</div></div>

  <div class="panel"><div class="cx-head"><div><h2>Documentos publicados</h2><p>Organizados nas seções que o público vê. Para publicar, use “⋯ Mais → Publicar” em qualquer documento do Arquivo central.</p></div><button class="cx-btn" onclick="cxGo('arquivo',{area:'institucional'})">Abrir documentos institucionais</button></div>
    ${empty.length ? `<p class="hint" style="margin-top:10px">Seções ainda vazias: ${empty.map(k => CX_PUBCATS[k].label).join(', ')}.</p>` : ''}
    ${suggest.length ? `<div class="cx-process"><h3>Sugestões para publicar</h3><p class="muted" style="margin:0 0 8px">Documentos institucionais do arquivo que ainda não estão na página pública.</p>${suggest.map(r => `<div class="cx-btns" style="justify-content:space-between;align-items:center;margin-bottom:6px"><span>${cxEsc(cxKindLabel(r))} · <b>${cxEsc(r.title)}</b></span><button class="cx-btn small primary" onclick="cxOpenPublish('${r.id}')">Publicar</button></div>`).join('')}</div>` : ''}
    ${Object.entries(CX_PUBCATS).filter(([k]) => byCat[k]).map(([k, v]) => `<div class="cx-group-title">${v.ico} ${cxEsc(v.label)}</div>${byCat[k].map(r => `<article class="cx-item"><div><h4>${cxEsc(r.title)}</h4><div class="cx-meta"><span>${cxEsc(cxBR(r.date))}</span><span>${cxEsc(cxKindLabel(r))}</span>${cx.publicMeta?.[r.id]?.description ? `<span>${cxEsc(cx.publicMeta[r.id].description)}</span>` : ''}</div></div><div class="cx-actions">${cxViewable(r.file) ? `<a class="cx-btn small" href="/api/app/documents/${r.id}/file?view=1" target="_blank" rel="noopener">Visualizar</a>` : ''}<button class="cx-btn small" onclick="cxOpenPublish('${r.id}')">Mudar seção</button><button class="cx-btn small danger" onclick="cxTogglePublic('${r.id}')">Retirar</button></div></article>`).join('')}`).join('') || '<div class="cx-empty" style="margin-top:12px">Nenhum documento publicado ainda. Envie o Regimento, o PPP e o Regimento do Conselho ao Arquivo central e publique-os.</div>'}
    <div class="cx-btns" style="margin-top:12px"><button class="cx-btn" onclick="cxOpenUpload({area:'institucional',kind:'regimento'})">⬆ Enviar Regimento</button><button class="cx-btn" onclick="cxOpenUpload({area:'institucional',kind:'ppp'})">⬆ Enviar PPP</button><button class="cx-btn" onclick="cxOpenUpload({area:'conselho',kind:'estatuto'})">⬆ Enviar Regimento do Conselho</button><button class="cx-btn" onclick="cxOpenUpload({area:'institucional',kind:'calendario'})">⬆ Enviar Calendário</button><button class="cx-btn" onclick="cxOpenUpload({area:'institucional',kind:'cardapio'})">⬆ Enviar Cardápio</button></div></div>

  <div class="panel"><div class="cx-head"><div><h2>Informações da unidade</h2><p>Aparecem nas seções “Sobre o CEI” e “Contato”. Campos vazios não são exibidos.</p></div></div>
    <form class="cx-form" style="margin-top:12px" onsubmit="cxSaveInfo(event)">
      <label>Telefone<input name="phone" maxlength="40" value="${cxEsc(info.phone)}"></label>
      <label>WhatsApp (só números, com DDI e DDD)<input name="whatsapp" maxlength="20" inputmode="numeric" value="${cxEsc(info.whatsapp)}" placeholder="554734522185"></label>
      <label>E-mail institucional<input name="email" type="email" maxlength="120" value="${cxEsc(info.email)}"></label>
      <label>Horário de funcionamento<input name="hours" maxlength="300" value="${cxEsc(info.hours)}" placeholder="Ex.: Segunda a sexta, das 7h às 19h"></label>
      <label class="full">Endereço<input name="address" maxlength="240" value="${cxEsc(info.address)}"></label>
      <label class="full">Sobre o CEI<textarea name="about" rows="4" maxlength="2500" placeholder="Apresentação curta da unidade: turmas atendidas, proposta pedagógica, história…">${cxEsc(info.about)}</textarea></label>
      <label class="full">Vagas e matrículas<textarea name="vagas" rows="3" maxlength="1500" placeholder="Como as famílias solicitam vaga (por exemplo, pela Secretaria Municipal de Educação), documentos e prazos.">${cxEsc(info.vagas)}</textarea></label>
      <div class="actions full cx-static-actions"><button class="primary" type="submit">Salvar informações</button></div></form></div>`;
}
window.cxSaveInfo = async e => {
  e.preventDefault(); const f = e.target; const body = {}; ['phone', 'whatsapp', 'email', 'hours', 'address', 'about', 'vagas'].forEach(k => { body[k] = f[k].value; });
  try { await cxRequest('/api/portal/public-info', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); cxToast('Informações da página pública salvas.'); render(); } catch (err) { alert(err.message); }
};
window.cxOpenNotice = id => {
  const n = id ? cxPub.settings?.notices.find(x => x.id === id) : null;
  cxModal(`<h2>${n ? 'Editar aviso' : 'Novo aviso'}</h2><p class="hint">Avisos são públicos. Não inclua nomes de crianças ou informações pessoais.</p>
  <form class="cx-form" onsubmit="cxSaveNotice(event,'${n?.id || ''}')">
    <label class="full">Título *<input name="title" required maxlength="160" value="${cxEsc(n?.title || '')}" placeholder="Ex.: Reunião de pais — 12 de novembro"></label>
    <label class="full">Texto<textarea name="body" rows="5" maxlength="3000">${cxEsc(n?.body || '')}</textarea></label>
    <label>Mostrar até (opcional)<input name="until" type="date" value="${cxEsc(n?.until || '')}"></label>
    <label class="cx-check" style="align-self:end"><input type="checkbox" name="pinned" ${n?.pinned ? 'checked' : ''}> Fixar no topo</label>
    <div class="actions full"><button type="button" onclick="cxCloseModal()">Cancelar</button><button class="primary" type="submit">Publicar aviso</button></div></form>`);
};
window.cxSaveNotice = async (e, id) => {
  e.preventDefault(); const f = e.target;
  try { await cxRequest('/api/portal/notices', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: id || undefined, title: f.title.value, body: f.body.value, until: f.until.value, pinned: f.pinned.checked})}); cxCloseModal(); cxToast('Aviso salvo.'); render(); } catch (err) { alert(err.message); }
};
window.cxDeleteNotice = async id => {
  if (!confirm('Excluir este aviso da página pública?')) return;
  try { await cxRequest('/api/portal/notices', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, delete: true})}); cxToast('Aviso excluído.'); render(); } catch (err) { alert(err.message); }
};

/* ---------- Documentos > Outros: atalho para o papel timbrado ---------- */
if (typeof renderDocumentosTab === 'function') {
  const cxPrevTab = renderDocumentosTab;
  renderDocumentosTab = function () {
    cxPrevTab();
    const root = document.getElementById('docsTabContent');
    if (root && CX_ADMIN && typeof documentosTab !== 'undefined' && documentosTab === 'declaracoes') return cxRenderDeclaracoes(root);
    if (root && CX_ADMIN && !root.querySelector('.cx-timb-link')) {
      const box = document.createElement('div'); box.className = 'panel cx-timb-link';
      box.innerHTML = '<div class="cx-head"><div><h2>Papel timbrado livre</h2><p>Comunicados, bilhetes, autorizações com canhoto, convites e qualquer outro texto no padrão do CEI.</p></div><button class="cx-btn primary" onclick="cxGo(\'timbrado\')">📄 Abrir papel timbrado</button></div>';
      root.prepend(box);
    }
  };
}

/* ---------- Ver enturmação (v46) ----------
   Regra: data de corte 31 de março. Para o ano letivo Y, a idade considerada é a completada até 31/03/Y.
   Maternal = 2 anos · Jardim = 3 · Pré I = 4 · Pré II = 5. As faixas avançam sozinhas a cada ano. */
const CX_TURMAS = [
  {idade: 2, nome: 'Maternal', cor: 'var(--red,#e0483b)'},
  {idade: 3, nome: 'Jardim', cor: 'var(--sky,#3b8fd9)'},
  {idade: 4, nome: 'Pré I', cor: 'var(--green,#3f9a4b)'},
  {idade: 5, nome: 'Pré II', cor: 'var(--purple,#8a4fd6)'},
];
const CX_CORTE = {mes: 3, dia: 31};
// Ano de referência: quem nasce de 01/04 a 31/12 conta como do ano seguinte.
const cxRefYear = iso => { const [y, m] = iso.split('-').map(Number); return m > CX_CORTE.mes ? y + 1 : y; };
function cxEnturmar(iso, ano) {
  const idade = ano - cxRefYear(iso);
  const turma = CX_TURMAS.find(t => t.idade === idade);
  if (turma) return {tipo: 'cei', turma, idade};
  if (idade < CX_TURMAS[0].idade) return {tipo: 'novo', idade, entra: cxRefYear(iso) + CX_TURMAS[0].idade};
  return {tipo: 'fundamental', idade};
}
const cxFaixa = (idade, ano) => ({de: `${ano - idade - 1}-04-01`, ate: `${ano - idade}-03-31`});
function cxIdadeHoje(iso) {
  const [y, m, d] = iso.split('-').map(Number), [ty, tm, td] = cxToday().split('-').map(Number);
  let anos = ty - y, meses = tm - m; if (td < d) meses--; if (meses < 0) { anos--; meses += 12; }
  return anos < 0 ? '' : `${anos} ano(s) e ${meses} mês(es)`;
}
const cxEnt = {nasc: '', ano: Number(cxToday().slice(0, 4))};
window.cxEntState = cxEnt;
function cxRenderEnturmacao(a) {
  const hoje = Number(cxToday().slice(0, 4));
  a.innerHTML = `<div class="panel" style="margin-top:0"><div class="cx-head"><div><h2>Em qual turma a criança estuda?</h2><p>Digite a data de nascimento. A turma é calculada pela idade completada até <b>31 de março</b> de cada ano letivo, e as faixas mudam sozinhas na virada do ano.</p></div></div>
    <div class="cx-form" style="margin-top:14px">
      <label>Data de nascimento<input id="cxEntNasc" type="date" value="${cxEsc(cxEnt.nasc)}" max="${cxToday()}" oninput="cxEntState.nasc=this.value;cxEntResult()" style="font-size:18px;padding:12px"></label>
      <p class="hint full" style="margin:0">Dica: para matrículas feitas no fim do ano, confira o cartão de <b>${hoje + 1}</b>.</p>
    </div><div id="cxEntResult"></div></div>
    <div class="panel"><div class="cx-head"><h2>Tabela de enturmação</h2><div class="cx-btns" style="align-items:center"><button class="cx-btn small" onclick="cxEntState.ano--;cxEntTable()" aria-label="Ano anterior">‹</button><b id="cxEntAno" style="font-size:18px;min-width:60px;text-align:center"></b><button class="cx-btn small" onclick="cxEntState.ano++;cxEntTable()" aria-label="Próximo ano">›</button><button class="cx-btn small" onclick="cxEntState.ano=${hoje};cxEntTable()">Ano atual</button></div></div><div id="cxEntTable" style="margin-top:12px"></div></div>`;
  cxEntResult(); cxEntTable();
}
window.cxEntResult = () => {
  const el = document.getElementById('cxEntResult'); if (!el) return;
  const iso = cxEnt.nasc;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > cxToday() || Number(iso.slice(0, 4)) < 1990) { el.innerHTML = iso ? '<div class="cx-empty" style="margin-top:14px">Confira a data de nascimento.</div>' : ''; return; }
  const hoje = Number(cxToday().slice(0, 4));
  const card = ano => { const r = cxEnturmar(iso, ano);
    const body = r.tipo === 'cei' ? `<div class="cx-big" style="color:${r.turma.cor}">${cxEsc(r.turma.nome)}</div><small class="muted">${r.idade} anos completos até 31/03/${ano} · faixa ${cxBR(cxFaixa(r.idade, ano).de)} a ${cxBR(cxFaixa(r.idade, ano).ate)}</small>`
      : r.tipo === 'novo' ? `<div class="cx-big" style="color:#8a5a00">Ainda não</div><small class="muted">${r.idade < 0 ? 'Ainda não completou idade' : r.idade + ' ano(s) até 31/03/' + ano}; entra no <b>Maternal em ${r.entra}</b>.</small>`
      : `<div class="cx-big" style="color:#5b6b82">Ensino Fundamental</div><small class="muted">${r.idade} anos até 31/03/${ano}: já passou da idade da educação infantil (1º ano).</small>`;
    return `<div class="cx-account" style="cursor:default;border-top:6px solid ${r.tipo === 'cei' ? r.turma.cor : '#cfd8e5'}"><h3>Ano letivo ${ano}</h3>${body}</div>`; };
  const traj = CX_TURMAS.map(t => { const ano = cxRefYear(iso) + t.idade; return `<li><span><b style="color:${t.cor};display:inline-block;min-width:80px">${cxEsc(t.nome)}</b> em ${ano}</span>${ano === hoje ? '<span class="cx-chip ok">este ano</span>' : ano === hoje + 1 ? '<span class="cx-chip warn">próximo ano</span>' : ano < hoje ? '<span class="muted" style="font-size:12px">já cursou</span>' : '<span></span>'}</li>`; }).join('');
  el.innerHTML = `<div class="cx-accounts" style="margin-top:16px">${card(hoje)}${card(hoje + 1)}</div>
    <div class="cx-summary-grid" style="margin-top:12px"><div>Idade hoje<b>${cxEsc(cxIdadeHoje(iso))}</b></div><div>Nascimento<b>${cxEsc(cxLongDate(iso))}</b></div></div>
    <h3 style="margin:16px 0 6px">Trajetória no CEI</h3><ul class="cx-todo" style="max-width:420px">${traj}</ul>
    <p class="hint">1º ano do Ensino Fundamental em ${cxRefYear(iso) + 6}.</p>`;
};
window.cxEntTable = () => {
  const el = document.getElementById('cxEntTable'); if (!el) return;
  const ano = cxEnt.ano; document.getElementById('cxEntAno').textContent = ano;
  el.innerHTML = `<div class="cx-table-wrap"><table class="cx-table" style="max-width:640px"><thead><tr><th>Turma</th><th>Nascidos de</th><th>até</th><th>Idade até 31/03/${ano}</th></tr></thead><tbody>${CX_TURMAS.map(t => { const f = cxFaixa(t.idade, ano); return `<tr><td><b style="color:${t.cor}">${cxEsc(t.nome)}</b></td><td class="cx-num">${cxBR(f.de)}</td><td class="cx-num">${cxBR(f.ate)}</td><td>${t.idade} anos</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">Calculada automaticamente pela data de corte de 31 de março. Use as setas para ver outros anos.</p>`;
};
window.cxEnturmar = cxEnturmar;

/* ---------- Inicialização ---------- */
document.addEventListener('click', e => { document.querySelectorAll('details.cx-more[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.cx-more-menu')) d.open = false; }); });
function cxNoServer() {
  // A área restrita só funciona servida pelo servidor do site (/restrito), que identifica a conta.
  const a = document.getElementById('app'), nav = document.getElementById('nav');
  if (nav) nav.innerHTML = '';
  const foot = nav?.nextElementSibling; if (foot) foot.remove();
  document.getElementById('title').textContent = 'Área restrita indisponível';
  document.getElementById('subtitle').textContent = 'Esta página foi aberta sem o servidor do site';
  const local = location.protocol === 'file:' ? 'Ela foi aberta direto do arquivo (file://).' : 'O endereço usado não passou pelo servidor do CEI.';
  a.innerHTML = `<div class="panel" style="margin-top:0;max-width:760px"><h2>Abra pelo endereço do site</h2><p>${local} A área restrita precisa do servidor para identificar sua conta e carregar livros, documentos e arquivos. Abrir o <code>index.html</code> direto no navegador, ou por um servidor de arquivos simples, mostra só a aparência da página, sem dados.</p>
    <p><b>No site publicado:</b> acesse o endereço do site e clique em <b>Área restrita</b> (ou abra <code>/restrito</code>).</p>
    <p><b>Para testar no seu computador:</b> na pasta <code>projeto</code>, rode <code>node scripts/preview-local.mjs</code> e abra <code>http://localhost:3000/restrito</code>. Esse modo de teste usa dados próprios e não acessa a base do site.</p>
    <p><a class="cx-btn primary" href="/restrito">Tentar /restrito</a> <a class="cx-btn" href="/">Página pública</a></p></div>`;
}
function cxInit() {
  if (!CX_SESSION.role) return cxNoServer();
  cxBuildNav();
  if (CX_ADMIN) cxLoad().catch(() => {});
  render();
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(cxInit, 0)); else setTimeout(cxInit, 0);
})();
