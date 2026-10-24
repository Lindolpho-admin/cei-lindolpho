// Acervo da APP: consulta pública, edição autorizada pela API.
let appArchiveRecords = [];
let appArchiveCanEdit = false;
let appArchiveScope = "";
let appArchiveLoaded = false;
const appKinds = {
  ata:"Ata", plano:"Plano de aplicação", cotacao:"Cotação", pesquisa_precos:"Consolidação da pesquisa de preços",
  nota_fiscal:"Nota fiscal", recibo:"Recibo", comprovante:"Comprovante de pagamento",
  extrato:"Extrato bancário", conciliacao:"Conciliação bancária", demonstrativo:"Demonstrativo",
  parecer:"Parecer", resolucao:"Resolução", outro:"Outro documento",
};
const appPrograms = {
  APP:"APP · documentos institucionais", PDDE_Basico:"PDDE Básico · Banco do Brasil",
  PDDE_Qualidade:"PDDE Qualidade · outras ações · Banco do Brasil",
  Educacao_Conectada:"Educação Conectada (PDDE Qualidade) · Banco do Brasil",
  SICOOB:"Sicoob · APP",
};
const appSections = {
  financeiro:"Execução financeira", juridico:"Atas e documentos da APP",
  pareceres:"Pareceres e aprovações", transparencia:"Transparência para famílias",
};
const appStages = {
  planejamento:"Planejamento e atas", pesquisa:"Pesquisa de preços", despesas:"Notas, recibos e pagamentos",
  bancario:"Extratos e conciliação", demonstrativos:"Demonstrativos", aprovacao:"Pareceres e aprovação",
  institucional:"Estatuto e normas", outro:"Outros",
};
const appStatements = {conta_corrente:"Conta corrente",investimentos:"Aplicações / investimentos",consolidado:"Consolidado",outro:"Outro extrato"};
const appMonthName = month => new Intl.DateTimeFormat("pt-BR",{month:"long"}).format(new Date(2026, Number(month)-1, 1));
const appSectionOf = x => x.section || (x.kind === "parecer" ? "pareceres" : x.program === "APP" || x.kind === "ata" || x.kind === "resolucao" ? "juridico" : "financeiro");
const appBankOf = x => x.bank || (x.program === "SICOOB" ? "SICOOB" : ["PDDE_Basico","PDDE_Qualidade","Educacao_Conectada"].includes(x.program) ? "BB" : "");
const appStatementOf = x => x.statementType || (/investimento|fundo/i.test(x.title) ? "investimentos" : /conta corrente/i.test(x.title) ? "conta_corrente" : /consolidado/i.test(x.title) ? "consolidado" : "outro");
function appStageOf(x) {
  if (["plano","ata"].includes(x.kind)) return "planejamento";
  if (["cotacao","pesquisa_precos"].includes(x.kind)) return "pesquisa";
  if (["nota_fiscal","recibo","comprovante"].includes(x.kind)) return "despesas";
  if (["extrato","conciliacao"].includes(x.kind)) return "bancario";
  if (x.kind === "demonstrativo") return "demonstrativos";
  if (x.kind === "parecer" || x.kind === "ata") return "aprovacao";
  if (x.kind === "resolucao" || /estatuto/i.test(x.title)) return "institucional";
  return "outro";
}
const appNormalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const appPeriod = x => x.competence || (x.date || "").slice(0,7) || String(x.year || "");
async function appRequest(url, options) {
  const response = await fetch(url, { cache:"no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
function appDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return day && month ? `${day}/${month}/${year}` : iso;
}
function appTitle(record) {return `${appKinds[record.kind] || "Documento"} · ${record.title}`;}
function renderAppArchive(root) {
  root.innerHTML = `<div class="panel app-archive-intro">
    <div><h2>Documentos da APP e prestação de contas</h2><p>Localize os documentos pelo recurso, exercício, mês ou peça da prestação de contas.</p></div>
    <div id="appArchiveActions"></div>
  </div>
  <div class="panel">
    <div id="appArchiveScopes" class="app-folder-nav app-scope-nav" aria-label="Origem dos recursos"></div>
    <div class="app-archive-toolbar">
      <label class="app-search-field">Buscar no acervo<input id="appArchiveSearch" type="search" placeholder="Ex.: ventilador, nota fiscal, extrato de agosto..." oninput="filterAppArchive()"></label>
      <label>Exercício<select id="appArchiveYear" onchange="filterAppArchive()"><option value="">Todos os anos</option></select></label>
      <label>Mês<select id="appArchiveMonth" onchange="filterAppArchive()"><option value="">Todos os meses</option>${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,"0")}">${appMonthName(i+1)}</option>`).join("")}</select></label>
      <label>Peça / tipo<select id="appArchiveKind" onchange="filterAppArchive()"><option value="">Todos os tipos</option>${Object.entries(appKinds).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
      <label>Etapa<select id="appArchiveStage" onchange="filterAppArchive()"><option value="">Todas as etapas</option>${Object.entries(appStages).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
      <label>Área<select id="appArchiveSection" onchange="filterAppArchive()"><option value="">Todas as áreas</option>${Object.entries(appSections).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
      <label>Tipo de extrato<select id="appArchiveStatement" onchange="filterAppArchive()"><option value="">Conta e aplicações</option>${Object.entries(appStatements).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
    </div>
    <div class="app-results-heading"><span id="appArchiveSummary" role="status"></span><button type="button" onclick="resetAppArchiveFilters()">Limpar filtros</button></div>
    <p class="app-archive-guide">A relação de peças segue a <a href="https://www.gov.br/fnde/pt-br/acesso-a-informacao/legislacao/resolucoes/2021/resolucao-no-15-de-16-de-setembro-de-2021/view" target="_blank" rel="noopener">Resolução FNDE nº 15/2021, art. 33</a>. Aqui estão os arquivos já disponibilizados pela APP; a entrega oficial à Secretaria de Educação segue o procedimento definido pelo município.</p>
    <div id="appArchiveList"><p class="muted">Carregando documentos...</p></div>
  </div><div id="appArchiveEditor"></div>`;
  appArchiveLoaded = false;
  appArchiveScope = "";
  loadAppArchive();
}
async function loadAppArchive() {
  try {
    const [access,records] = await Promise.all([appRequest("/api/app/me"),appRequest("/api/app/documents")]);
    appArchiveCanEdit = !!access.canEdit;
    appArchiveRecords = records;
    appArchiveLoaded = true;
    const actions = document.getElementById("appArchiveActions");
    if (!actions) return;
    actions.innerHTML = appArchiveCanEdit
      ? '<button class="primary" onclick="openAppMinute()">+ Criar ata</button><button onclick="openAppUpload()">Enviar documento</button>'
      : access.signedIn ? "" : '<a class="app-signin" href="/signin-with-chatgpt?return_to=/" target="_top">Entrar para arquivar</a>';
    const yearControl = document.getElementById("appArchiveYear");
    const selectedYear = yearControl.value;
    const years = [...new Set(records.map(x => x.year || Number(appPeriod(x).slice(0,4))).filter(Boolean))].sort((a,b) => b-a);
    yearControl.innerHTML = '<option value="">Todos os anos</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join("");
    yearControl.value = selectedYear;
    renderAppArchiveScopes();filterAppArchive();
  } catch (error) {
    const list = document.getElementById("appArchiveList");
    if (list) list.innerHTML = `<p class="muted">${esc(error.message)} <button onclick="loadAppArchive()">Tentar novamente</button></p>`;
  }
}
function renderAppArchiveScopes() {
  const root = document.getElementById("appArchiveScopes");if (!root) return;
  const scopes = [["","Acervo completo"],["PDDE_Basico","PDDE Básico · BB"],
    ["Educacao_Conectada","Educação Conectada · BB"],["PDDE_Qualidade","Outras ações Qualidade · BB"],
    ["SICOOB","Sicoob · APP"],["institucional","Atas, estatuto e pareceres"]];
  root.innerHTML = scopes.map(([id,label]) => {
    const count=appArchiveRecords.filter(x => !id || (id==="institucional" ?
      ["juridico","pareceres"].includes(appSectionOf(x)) : x.program===id)).length;
    return `<button type="button" class="${appArchiveScope===id?"active":""}" onclick="setAppArchiveScope('${id}')">${label}<small>${count} arquivo(s)</small></button>`;
  }).join("");
}
window.setAppArchiveScope = scope => {appArchiveScope=scope;renderAppArchiveScopes();filterAppArchive()};
window.resetAppArchiveFilters = () => {
  appArchiveScope="";
  for (const id of ["appArchiveSearch","appArchiveYear","appArchiveMonth","appArchiveKind","appArchiveStage","appArchiveSection","appArchiveStatement"]) {
    const control=document.getElementById(id);if(control)control.value="";
  }
  renderAppArchiveScopes();filterAppArchive();
};
function appGroupName(x) {
  const section=appSectionOf(x);
  if (section!=="financeiro") return appSections[section] || "Documentos da APP";
  const origin=x.program==="PDDE_Basico" ? "PDDE Básico · BB" : x.program==="Educacao_Conectada" ? "Educação Conectada · BB" :
    x.program==="PDDE_Qualidade" ? "Outras ações Qualidade · BB" :
    appBankOf(x)==="SICOOB" ? "Sicoob · APP" : "Outros recursos";
  const period=appPeriod(x).match(/^(\d{4})-(\d{2})$/);
  return origin + " · " + (period ? `${appMonthName(period[2])} de ${period[1]}` : x.year || "sem período");
}
window.filterAppArchive = () => {
  const list=document.getElementById("appArchiveList");if(!list||!appArchiveLoaded)return;
  const value=id=>document.getElementById(id)?.value||"";
  const words=appNormalize(value("appArchiveSearch")).trim().split(/\s+/).filter(Boolean);
  const year=value("appArchiveYear"),month=value("appArchiveMonth"),kind=value("appArchiveKind");
  const stage=value("appArchiveStage"),section=value("appArchiveSection"),statement=value("appArchiveStatement");
  const records=appArchiveRecords.filter(x=>{
    if(appArchiveScope==="institucional"?!["juridico","pareceres"].includes(appSectionOf(x)):
       appArchiveScope&&x.program!==appArchiveScope)return false;
    if(section&&appSectionOf(x)!==section || kind&&x.kind!==kind || stage&&appStageOf(x)!==stage)return false;
    if(year&&String(x.year||appPeriod(x).slice(0,4))!==year || month&&appPeriod(x).slice(5,7)!==month)return false;
    if(statement&&(x.kind!=="extrato"||appStatementOf(x)!==statement))return false;
    const haystack=appNormalize([x.title,x.kind,appKinds[x.kind],appStages[appStageOf(x)],x.program,appPrograms[x.program],
      appSections[appSectionOf(x)],appBankOf(x),x.folder,x.competence,x.date,
      /^\d{4}-\d{2}$/.test(appPeriod(x)) ? appMonthName(appPeriod(x).slice(5,7)) : "",
      x.file?.originalName,x.sourcePath].join(" "));
    return words.every(word=>haystack.includes(word));
  }).sort((a,b)=>{
    const order=x=>[appSectionOf(x)==="financeiro"?"0":"1",x.program||"",appPeriod(x),x.title||""];
    const A=order(a),B=order(b);
    return A[0].localeCompare(B[0])||A[1].localeCompare(B[1])||B[2].localeCompare(A[2])||A[3].localeCompare(B[3]);
  });
  document.getElementById("appArchiveSummary").textContent=`${records.length} de ${appArchiveRecords.length} documento(s) encontrado(s)`;
  const grouped=new Map();
  for(const item of records){const group=appGroupName(item);if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(item)}
  list.innerHTML=records.length
    ? `<div class="app-archive-list">${[...grouped].map(([group,items])=>`<section class="app-archive-group"><h3>${esc(group)} <small>${items.length} arquivo(s)</small></h3>${items.map(x=>`
      <article class="app-archive-item">
        <div class="app-archive-item-main">
          <span class="badge">${esc(x.kind==="extrato" ? `Extrato · ${appStatements[appStatementOf(x)]}` : appKinds[x.kind] || "Documento")}</span>
          <h3>${esc(x.title)}</h3>
          <p>${esc(appStages[appStageOf(x)])} · ${esc(appPrograms[x.program]||x.program||"APP")} · ${esc(x.date?appDate(x.date):appPeriod(x)||"Sem data")}</p>
          ${x.file ? `<small>Arquivo: ${esc(x.file.name)}</small>` : ""}
        </div><div class="app-archive-item-actions">
          ${x.kind==="ata"&&!x.seeded&&!x.readOnly ? `<button onclick="printAppMinute('${x.id}')">Imprimir / salvar PDF</button>` : ""}
          ${x.file && ["application/pdf","image/jpeg","image/png"].includes(x.file.mime) ? `<a href="/api/app/documents/${x.id}/file?view=1" target="_blank" rel="noopener">Visualizar</a>` : ""}
          ${x.file ? `<a href="/api/app/documents/${x.id}/file">Baixar arquivo</a>` : ""}
          ${x.signedFile ? `<a href="/api/app/documents/${x.id}/file?signed=1">Baixar ata assinada</a>` : ""}
          ${appArchiveCanEdit&&x.kind==="ata"&&!x.seeded&&!x.readOnly ? `<button onclick="openAppMinute('${x.id}')">Editar</button><button onclick="attachAppMinute('${x.id}')">${x.signedFile?"Substituir PDF assinado":"Anexar PDF assinado"}</button>` : ""}
          ${appArchiveCanEdit&&!x.seeded&&!x.readOnly ? `<button class="danger" onclick="deleteAppRecord('${x.id}')">Excluir</button>` : ""}
        </div>
      </article>`).join("")}</section>`).join("")}</div>`
    : `<p class="muted">${appArchiveRecords.length ? "Nenhum documento corresponde aos filtros. Use ‘Limpar filtros’ para ver o acervo completo." : "Nenhum documento arquivado ainda."}</p>`;
};
window.openAppMinute = id => {
  if (!appArchiveCanEdit) return;
  const record = appArchiveRecords.find(x => x.id === id);
  const box = document.getElementById("appArchiveEditor");
  box.innerHTML = `<div class="panel app-archive-editor"><h3>${record ? "Editar ata" : "Criar ata"}</h3>
    <form id="appMinuteForm" onsubmit="saveAppMinute(event)">
      <input type="hidden" name="id" value="${esc(record?.id || "")}">
      <div class="form-grid">
        <label>Data da reunião *<input name="date" type="date" required value="${esc(record?.date || new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}))}"></label>
        <label class="full">Título / assunto *<input name="title" required maxlength="200" value="${esc(record?.title || "")}" placeholder="Ex.: Reunião de aprovação de despesas"></label>
        <label class="full">Texto da ata *<textarea name="body" required rows="12" maxlength="30000" placeholder="Participantes, pauta, deliberações e encaminhamentos...">${esc(record?.body || "")}</textarea></label>
      </div><div class="actions"><button type="button" onclick="closeAppEditor()">Cancelar</button><button class="primary" type="submit">Salvar ata</button></div>
    </form></div>`;
  box.scrollIntoView({behavior:"smooth",block:"start"});
};
window.openAppUpload = () => {
  if (!appArchiveCanEdit) return;
  const box = document.getElementById("appArchiveEditor");
  box.innerHTML = `<div class="panel app-archive-editor"><h3>Enviar documento para o acervo da APP</h3>
    <form id="appUploadForm" onsubmit="saveAppUpload(event)">
      <div class="form-grid">
        <label>Área *<select name="section" required>${Object.entries(appSections).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
        <label>Origem / conta *<select name="program" required>${Object.entries(appPrograms).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
        <label>Peça / tipo *<select name="kind" required onchange="toggleAppStatementType()">${Object.entries(appKinds).filter(([id])=>id!=="ata").map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
        <label id="appStatementTypeField" hidden>Tipo de extrato *<select name="statementType">${Object.entries(appStatements).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
        <label>Competência (ano e mês) *<input name="competence" type="month" required value="${new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}).slice(0,7)}"></label>
        <label class="full">Descrição *<input name="title" required maxlength="200" placeholder="Ex.: Extrato da conta corrente de agosto"></label>
        <label class="full">Arquivo *<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" required></label>
      </div><p class="hint">Escolha a conta a que o documento pertence. O nome do arquivo para download será formado automaticamente pelo período, origem, tipo e descrição.</p>
      <div class="actions"><button type="button" onclick="closeAppEditor()">Cancelar</button><button class="primary" type="submit">Enviar e arquivar</button></div>
    </form></div>`;
  box.scrollIntoView({behavior:"smooth",block:"start"});
};
window.toggleAppStatementType = () => {
  const form=document.getElementById("appUploadForm"),field=document.getElementById("appStatementTypeField");
  if (form && field) field.hidden=form.elements.kind.value!=="extrato";
};
window.closeAppEditor = () => {
  const box = document.getElementById("appArchiveEditor");
  if (box) box.innerHTML = "";
};
window.saveAppMinute = async event => {
  event.preventDefault();
  const form = event.target;
  const id = form.elements.id.value;
  const data = {date:form.elements.date.value,title:form.elements.title.value,body:form.elements.body.value};
  const button = form.querySelector('button[type="submit"]');button.disabled=true;
  try {
    await appRequest(id ? `/api/app/documents/${id}` : "/api/app/documents", {
      method: id ? "PUT" : "POST", headers:{"Content-Type":"application/json"},body:JSON.stringify(data),
    });
    closeAppEditor();await loadAppArchive();notify("Ata arquivada.");
  } catch (error) { alert(error.message); }
  finally { button.disabled=false; }
};
window.saveAppUpload = async event => {
  event.preventDefault();
  const form=event.target, button=form.querySelector('button[type="submit"]');
  button.disabled=true;button.textContent="Enviando...";
  try {
    await appRequest("/api/app/upload",{method:"POST",body:new FormData(form)});
    closeAppEditor();await loadAppArchive();notify("Documento arquivado e disponível para download.");
  } catch(error) {alert(error.message);}
  finally {button.disabled=false;button.textContent="Enviar e arquivar";}
};
window.attachAppMinute = id => {
  if (!appArchiveCanEdit) return;
  const input=document.createElement("input");input.type="file";input.accept=".pdf,application/pdf";
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    const form=new FormData();form.append("file",file);
    try {await appRequest(`/api/app/documents/${id}/signed`,{method:"POST",body:form});await loadAppArchive();notify("PDF assinado anexado.");}
    catch(error){alert(error.message);}
  };
  input.click();
};
window.deleteAppRecord = async id => {
  if (!appArchiveCanEdit || !confirm("Excluir este documento e seus anexos do acervo compartilhado?")) return;
  try {await appRequest(`/api/app/documents/${id}`,{method:"DELETE"});await loadAppArchive();notify("Documento excluído.");}
  catch(error){alert(error.message);}
};
window.printAppMinute = id => {
  const x=appArchiveRecords.find(record=>record.id===id);
  if(!x)return;
  const w=window.open("","_blank");if(!w)return alert("Permita a janela de impressão.");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ata - ${esc(x.title)}</title><style>
    @page{size:A4;margin:24mm 20mm}body{font-family:Arial,sans-serif;color:#111;font-size:11pt;line-height:1.55}
    h1{text-align:center;font-size:14pt;margin:0 0 18mm}p{margin:0 0 8mm}.body{white-space:pre-wrap;text-align:justify}
    .sign{margin:30mm auto 0;border-top:1px solid #111;width:90mm;text-align:center;padding-top:2mm}
  </style></head><body><h1>ASSOCIAÇÃO DE PAIS E PROFESSORES<br>CEI LINDOLPHO JOSÉ DA SILVA</h1>
    <p><b>${esc(x.title)}</b><br>Araquari/SC, ${esc(appDate(x.date))}.</p>
    <div class="body">${esc(x.body)}</div><div class="sign">Assinatura da presidência / secretaria</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
};
