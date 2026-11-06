/* v49: maiúsculas automáticas em todos os formulários.
   Antes, só os campos marcados com data-normalize (cadastros antigos) eram ajustados.
   Agora cada campo é classificado pelo nome, rótulo e placeholder:
   - nomes (pessoas, cargos, turmas, documentos): Iniciais Maiúsculas enquanto digita;
   - textos livres: primeira letra de cada frase em maiúscula;
   - telefones: máscara (47) 99999-9999;
   - e-mails, senhas, códigos, valores, datas, buscas etc.: nada é alterado.
   Nunca transforma letras maiúsculas em minúsculas (siglas como APP, PDDE e CEI ficam intactas).
   Respeita o padrão "TUDO EM MAIÚSCULAS" escolhido em Backup e segurança.
   Para desligar num campo específico: data-case="off". */
(() => {
  // Artigos "a", "o", "as", "os" só ficam minúsculos no meio do texto ("Reunião com a Família"), nunca no fim ("Turma A").
  const ARTICLES = new Set(['a', 'o', 'as', 'os']);
  const PARTICLES = new Set(['e', 'de', 'da', 'das', 'do', 'dos', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por', 'com', 'à', 'ao', 'aos']);
  // Siglas comuns na escola: viram maiúsculas quando a palavra termina (espaço, pontuação ou saída do campo).
  const ACRONYMS = new Set(['cei', 'cmei', 'app', 'pdde', 'ppp', 'bncc', 'apae', 'aee', 'eja', 'semed', 'sme', 'ubs', 'cras', 'creas', 'sus', 'cpf', 'cnpj', 'rg', 'sc', 'ltda', 'epp', 'mei', 'nf', 'pix', 'cpm', 'pne', 'pme', 'ideb', 'saeb', 'inep', 'fnde', 'ldb', 'eca', 'tdah', 'tea']);
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const SKIP = /e-?mail|senha|password|cutter|codigo|\bcod\b|cpf|cnpj|\bcep\b|\bn[º°]|\bnum\b|numero|slug|url|\blink|\bsite\b|endereco da pagina|valor|r\$|saldo|\bbanco|agencia|\bconta\b|nota fiscal|\bnf\b|chave|\bpix\b|\bdata\b|matricula|protocolo|ano letivo|sigla|whatsapp|\bisbn|\bcid\b|\bsei\b|\buid\b|\bid\b|token/;
  const SEARCH = /busca|pesquis|procur|filtr/;
  const SOFT_SKIP = /e-?mail|senha|password|\burl\b|\blink/; // únicos casos em que um texto longo não é ajustado
  const PHONE = /telefone|celular|\bfone\b|\btel\b/;
  const NAME = /nome|\bname\b|responsave|participante|assinante|assinatura|presidente|crianca|aluno|estudante|professor|\bmae\b|\bpai\b|familia|fornecedor|empresa|autor|editora|cargo|segmento|funcao|turma|destinatari|signatari|membro|requerente|interessad|secretari|titulo|gestao|chapa|leitor|presidid|conduzid|bairro|cidade|municipio|\blocal\b|endereco|\brua\b|logradouro/;
  const TEXT_TYPES = new Set(['', 'text']);
  const caseMode = () => { try { return typeof getTextCase === 'function' ? getTextCase() : 'title'; } catch { return 'title'; } };
  const up = c => c.toLocaleUpperCase('pt-BR');

  function labelText(el) {
    const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    if (!lab) return '';
    let t = ''; lab.childNodes.forEach(n => { if (n.nodeType === 3) t += n.textContent + ' '; else if (n.nodeType === 1 && !n.matches('input,select,textarea,datalist')) t += n.textContent + ' '; });
    return t;
  }
  // Classifica o campo uma vez e guarda o resultado no próprio elemento.
  function kind(el) {
    if (el._cxCase !== undefined) return el._cxCase;
    let k = null;
    const isArea = el.tagName === 'TEXTAREA';
    if ((isArea || (el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase()))) &&
        !el.readOnly && !el.disabled && el.dataset.case !== 'off' && el.dataset.normalize === undefined && el.dataset.phone === undefined) {
      const data = Object.entries(el.dataset).map(([key, v]) => key + ' ' + v).join(' ');
      // O placeholder só conta quando não há rótulo (exemplos como "Ex.: Ata nº 01" confundiriam a regra).
      const lab = labelText(el) || el.getAttribute('aria-label') || el.placeholder;
      const hint = fold([el.name, el.id, data, lab].join(' '));
      if (el.getAttribute('inputmode') === 'numeric' || el.getAttribute('inputmode') === 'decimal' || SEARCH.test(hint)) k = null;
      else if (isArea) k = SOFT_SKIP.test(hint) ? null : /participante|presentes|assinantes|responsave/.test(hint) ? 'name' : 'sentence';
      else if (!isArea && PHONE.test(hint) && !/whatsapp/.test(hint)) k = 'phone';
      else if (SKIP.test(hint)) k = null;
      else if (!isArea && NAME.test(hint)) k = 'name';
      else k = 'sentence';
      if (el.dataset.case === 'name' || el.dataset.case === 'sentence') k = el.dataset.case;
    }
    el._cxCase = k;
    return k;
  }
  // Iniciais maiúsculas sem rebaixar nada (respeita siglas). Preposições digitadas em minúsculas continuam minúsculas.
  // Palavra "terminada": seguida de outro caractere, ou o campo inteiro na saída (final=true).
  const acronyms = (v, final) => v.replace(/[\p{L}]+/gu, (w, i) => (final || i + w.length < v.length) && ACRONYMS.has(w.toLocaleLowerCase('pt-BR')) && w.slice(1) === w.slice(1).toLocaleLowerCase('pt-BR') ? up(w) : w);
  // Texto digitado TODO EM MAIÚSCULAS (caps lock) é padronizado na saída do campo, como antes; siglas conhecidas voltam a maiúsculas.
  const deshout = (v, final) => final && caseMode() !== 'upper' && !/\p{Ll}/u.test(v) && (v.match(/\p{Lu}/gu) || []).length >= 4 ? v.toLocaleLowerCase('pt-BR') : v;
  function nameCase(v, final) {
    v = deshout(v, final);
    let first = true;
    return acronyms(v, final).replace(/[\p{L}][\p{L}'’]*/gu, (w, i, all) => {
      const lower = w.toLocaleLowerCase('pt-BR');
      const middle = /\p{L}/u.test(all.slice(i + w.length));
      if (!first && middle && ARTICLES.has(lower) && (w.length === 1 || w !== up(w))) return lower;
      // Preposição no meio do nome volta a ficar minúscula ("Maria Da" → "Maria da"), exceto se escrita toda em maiúsculas de propósito.
      const particle = !first && PARTICLES.has(lower) && (w.length === 1 || w !== up(w));
      first = false;
      return particle ? lower : up(w.charAt(0)) + w.slice(1);
    });
  }
  // Primeira letra do texto, de cada frase e de cada linha.
  const sentenceCase = (v, final) => acronyms(deshout(v, final), final).replace(/(^\s*|[.!?…]\s+|\n\s*(?:[-•*]\s*|\d+[.)]\s*)?)(\p{Ll})/gu, (m, p, c) => p + up(c));
  function formatPhone(value) {
    const d = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  function apply(el, e, final = false) {
    const k = kind(el); if (!k) return;
    const v = el.value; if (!v) return;
    if (k === 'phone') {
      if (/[a-z]/i.test(v)) return; // ramal, observação: deixa como está
      if (e && e.inputType && e.inputType.startsWith('delete')) return; // não atrapalha quem está apagando
      const nv = formatPhone(v); if (nv !== v) el.value = nv;
      return;
    }
    const nv = caseMode() === 'upper' ? up(v) : k === 'name' ? nameCase(v, final) : sentenceCase(v, final);
    if (nv === v || nv.length !== v.length) return;
    const s = el.selectionStart, end = el.selectionEnd;
    el.value = nv;
    try { el.setSelectionRange(s, end); } catch {}
  }
  document.addEventListener('input', e => { const el = e.target; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !e.isComposing) apply(el, e); });
  document.addEventListener('compositionend', e => { const el = e.target; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) apply(el); });
  // Texto colado ou preenchido pelo navegador também é ajustado ao sair do campo.
  document.addEventListener('blur', e => { const el = e.target; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) apply(el, null, true); }, true);
  window.cxTextCase = {kind, nameCase, sentenceCase, formatPhone};
  // Os cadastros antigos (lista de espera, biblioteca, ofícios) passam a usar as mesmas regras ao salvar:
  // antes, "CEI" virava "Cei" e "PDDE" virava "Pdde".
  window.normalizeText = (value, kind = 'field') => {
    const v = String(value ?? '').trim(); if (!v) return '';
    if (caseMode() === 'upper') return up(v);
    return kind === 'multiline' ? sentenceCase(v, true) : nameCase(v, true);
  };
  window.titleCasePtLive = v => nameCase(String(v ?? ''));
})();
