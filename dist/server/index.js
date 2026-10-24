import {identity, teacherState, mergeTeacher, portalApi} from './access.js';
import {handleAuthRoute, prepareRequest} from './auth.js';
import { assets } from "./assets.js";
import { seededDocuments } from "./seeded.js";
import { activeBucket, ensureInitial, withWriteLock, storageApi, validateState } from "./host-storage.js";

const PREFIX = "app/records/";
const STATE_KEY = "cei/state/current.json";
const seededById = new Map(seededDocuments.map(record => [record.id, record]));
const MAX_FILE = 20 * 1024 * 1024;
const MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword", xls: "application/vnd.ms-excel",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet",
};
// Arquivo central (v39): pastas, tipos e dados financeiros opcionais.
const CENTRAL_AREAS = {
  institucional: "Institucional", reuniao_geral: "Reuniao_Geral", pedagogica: "Reuniao_Pedagogica", familias: "Reuniao_Familias",
  conselho: "Conselho_Escolar", app: "APP", compras: "Compras", financeiro: "Financeiro",
  secretaria: "Secretaria", outros: "Outros",
};
const CENTRAL_KINDS = {
  ata: "Ata", ata_compra: "Ata_Aprovacao_Compra", lista_presenca: "Lista_Presenca", pauta: "Pauta_Convocacao",
  orcamento: "Orcamento", pesquisa_precos: "Pesquisa_Precos", nota_fiscal: "Nota_Fiscal", recibo: "Recibo",
  comprovante: "Comprovante", extrato: "Extrato", repasse: "Repasse", lancamento: "Lancamento",
  contrato: "Contrato", oficio_recebido: "Oficio_Recebido", oficio_enviado: "Oficio_Enviado",
  comunicado: "Comunicado", relatorio: "Relatorio", projeto: "Projeto", plano: "Plano", termo: "Termo",
  estatuto: "Estatuto", regimento: "Regimento", ppp: "PPP", calendario: "Calendario", cardapio: "Cardapio",
  foto: "Registro_Fotografico", outro: "Documento",
};
const FIN_ACCOUNTS = ["SICOOB", "PDDE_Basico", "PDDE_Qualidade", "Educacao_Conectada", "OUTRA"];
const FIN_MOVES = ["entrada", "saida", "saldo_extrato", "saldo_inicial"];
const FIN_NATURES = ["", "custeio", "capital"];
const FIN_STATEMENTS = ["", "conta_corrente", "investimentos", "consolidado"];
function centralFields(get) {
  const area = text(get("area"), 40), kind = text(get("kind"), 40), date = text(get("date"), 10);
  const title = text(get("title"));
  if (!CENTRAL_AREAS[area] || !CENTRAL_KINDS[kind] || !validDate(date) || !title)
    throw Object.assign(new Error("Informe pasta, tipo, data e título do documento."), { status: 400 });
  const out = {
    central: true, area, kind, date, title, year: Number(date.slice(0, 4)), competence: date.slice(0, 7),
    notes: text(get("notes"), 3000), processo: text(get("processo"), 160), tags: text(get("tags"), 300),
    program: "", fin: null,
  };
  let fin = get("fin");
  if (typeof fin === "string" && fin.trim()) { try { fin = JSON.parse(fin); } catch { fin = null; } }
  if (fin && typeof fin === "object" && fin.move) {
    const cents = Math.round(Number(fin.amount));
    if (!FIN_ACCOUNTS.includes(fin.account) || !FIN_MOVES.includes(fin.move) || !FIN_NATURES.includes(fin.nature || "") ||
        !FIN_STATEMENTS.includes(fin.statementType || "") || !Number.isSafeInteger(cents) || Math.abs(cents) > 1e11 ||
        (fin.move !== "saldo_extrato" && fin.move !== "saldo_inicial" && cents <= 0))
      throw Object.assign(new Error("Confira conta, movimento e valor do lançamento financeiro."), { status: 400 });
    out.fin = {
      account: fin.account, move: fin.move, nature: fin.nature || "", statementType: fin.statementType || "",
      amount: cents, category: text(fin.category, 80), supplier: text(fin.supplier, 160), docNumber: text(fin.docNumber, 60),
    };
    out.program = fin.account === "OUTRA" ? "" : fin.account;
  }
  if (!out.program && area === "app") out.program = "APP";
  if (kind === "extrato") out.statementType = out.fin?.statementType || "outro";
  return out;
}
const labels = {
  ata: "Ata", extrato: "Extrato", resolucao: "Resolucao", comprovante: "Comprovante",
  cotacao: "Cotacao", pesquisa_precos: "Pesquisa_Preco", nota_fiscal: "Nota_Fiscal",
  recibo: "Recibo", demonstrativo: "Demonstrativo", conciliacao: "Conciliacao",
  plano: "Plano", parecer: "Parecer", outro: "Documento",
};

const reply = (data, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});
const fail = (message, status = 400) => reply({ error: message }, status);
// v42: senhas (hashes) nunca saem do servidor pela API de dados.
const withoutSecrets = data => data && data.portal ? {...data, portal: (({credentials, bootstrapSecretHash, ...rest}) => rest)(data.portal)} : data;
const sameOrigin = request => request.headers.get("Origin") === new URL(request.url).origin;
const text = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const slug = value => text(value, 120).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 72) || "Documento";
const validId = id => /^[a-f0-9-]{36}$/.test(id);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
const fileType = file => {
  const ext = file.name.toLowerCase().split(".").pop();
  return ext && MIME[ext] ? { ext, mime: MIME[ext] } : null;
};
const recordKey = id => PREFIX + id + ".json";
const fileKey = (id, signed = false) => "app/files/" + id + (signed ? "/signed" : "/original");
const stamp = () => new Date().toISOString();
const publicRecord = record => {
  const { body, ...rest } = record;
  return { ...rest, ...(record.kind === "ata" || record.typed ? { body } : {}) };
};
async function getRecord(bucket, id) {
  if (!validId(id)) return null;
  if (bucket?.includeSeeds !== false && seededById.has(id)) return seededById.get(id);
  if (!bucket) return null;
  const obj = await bucket.get(recordKey(id));
  if (!obj) return null;
  return JSON.parse(await obj.text());
}
async function putRecord(bucket, record) {
  await bucket.put(recordKey(record.id), JSON.stringify(record), {
    httpMetadata: { contentType: "application/json" },
  });
}
async function listRecords(bucket) {
  const records = bucket?.includeSeeds === false ? [] : [...seededDocuments];
  if (!bucket) return records.sort((a,b) => (b.date || b.competence || "").localeCompare(a.date || a.competence || ""));
  let cursor;
  do {
    const page = await bucket.list({ prefix: PREFIX, cursor, limit: 1000 });
    const objects = bucket.getMany ? await bucket.getMany(page.objects.map(entry => entry.key)) : await Promise.all(page.objects.map(entry => bucket.get(entry.key)));
    const batch = await Promise.all(objects.map(async obj => obj ? JSON.parse(await obj.text()) : null));
    records.push(...batch.filter(Boolean).map(publicRecord));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return records.sort((a, b) =>
    (b.date || b.competence || b.createdAt || "").localeCompare(a.date || a.competence || a.createdAt || ""));
}
async function handleStateApi(request, env) {
  if (!env.BUCKET) return fail("Armazenamento compartilhado indisponível.", 503);
  if (request.method === "GET") {
    const object = await env.BUCKET.get(STATE_KEY);
    return object ? reply({ revision: env.BUCKET.generation+"~"+object.etag, data: env.USER?.role==='teacher'?teacherState(JSON.parse(await object.text()),env.USER):withoutSecrets(JSON.parse(await object.text())) }) : reply({ revision: null, data: null });
  }
  if (request.method !== "PUT" || !sameOrigin(request)) return fail("Operação não permitida.", 403);
  if (Number(request.headers.get("Content-Length") || 0) > 20 * 1024 * 1024) return fail("Base acima de 20 MB.", 413);
  const input = await request.json();
  let data = input?.data;
  const currentObject=await env.BUCKET.get(STATE_KEY);const current=currentObject?JSON.parse(await currentObject.text()):null;
  if(env.USER?.role==='teacher')data=mergeTeacher(current,data,env.USER);else if(current)data={...data,portal:current.portal,generatedDocs:(data.generatedDocs||[]).map(d=>({...d,ownerEmail:current.generatedDocs.find(old=>old.id===d.id)?.ownerEmail||env.USER.email}))};
  if (data?.app !== "CEI Admin" || !Array.isArray(data.books) || !Array.isArray(data.loans) ||
      !Array.isArray(data.readers) || !Array.isArray(data.generatedDocs) || !Array.isArray(data.oficios) ||
      !Array.isArray(data.waitlist) || !Array.isArray(data.encaminhamentosMeimei)) return fail("Base inválida.");
  const content = JSON.stringify(data);
  if (new TextEncoder().encode(content).length > 20 * 1024 * 1024) return fail("Base acima de 20 MB.", 413);
  validateState(data);
  const token = input.revision;
  if(typeof token !== 'string' || !token.startsWith(env.BUCKET.generation+'~')) return fail('A base mudou. Recarregue antes de salvar.',409);
  const revision=token.slice(env.BUCKET.generation.length+1);
  const result = await env.BUCKET.put(STATE_KEY, content, {
    onlyIf: revision === null ? new Headers({ "If-None-Match": "*" }) : { etagMatches: revision },
    httpMetadata: { contentType: "application/json" },
  });
  if (!result) return fail("Outra pessoa alterou a base. Recarregue a versão do servidor antes de salvar.", 409);
  return reply({ revision: env.BUCKET.generation+"~"+result.etag, savedAt: data.savedAt, data:env.USER.role==='teacher'?teacherState(data,env.USER):withoutSecrets(data) });
}
function formatName(record, ext, signed = false) {
  if (record.central) return [record.date, CENTRAL_AREAS[record.area] || "Arquivo", CENTRAL_KINDS[record.kind] || "Documento",
    slug(record.title), signed ? "Assinado" : ""].filter(Boolean).map(slug).join("_").replace(/_+/g, "_") + "." + ext;
  const period = record.competence || (record.date || "").slice(0, 7) || String(record.year || "");
  const group = record.program && record.program !== "APP" ? record.program : "APP";
  return [period, group, labels[record.kind] || "Documento", slug(record.title), signed ? "Assinado" : ""]
    .filter(Boolean).map(slug).join("_").replace(/_+/g, "_") + "." + ext;
}
async function writeFile(bucket, record, file, signed = false) {
  if (!(file instanceof File) || !file.size || file.size > MAX_FILE) {
    throw new Error("Selecione um arquivo de até 20 MB.");
  }
  const type = fileType(file);
  if (!type || (signed && type.ext !== "pdf")) {
    throw new Error(signed ? "O documento assinado deve ser PDF." : "Use PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, ODT ou ODS.");
  }
  const key = fileKey(record.id, signed);
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: type.mime },
  });
  const meta = {
    key, name: formatName(record, type.ext, signed), originalName: file.name,
    mime: type.mime, size: file.size, uploadedAt: stamp(),
  };
  record[signed ? "signedFile" : "file"] = meta;
}
async function handleApi(request, env, url) {
  const path = url.pathname;
  if (path === "/api/app/me" && request.method === "GET") {
    return reply({ canEdit: true, signedIn: !!request.headers.get("oai-authenticated-user-id") });
  }
  if (path === "/api/app/documents" && request.method === "GET") {
    return reply((await listRecords(env.BUCKET)).filter(record=>!record.internal));
  }
  const fileMatch = path.match(/^\/api\/app\/documents\/([a-f0-9-]{36})\/file$/);
  if (fileMatch && request.method === "GET") {
    const record = await getRecord(env.BUCKET, fileMatch[1]);
    const meta = record?.[url.searchParams.get("signed") === "1" ? "signedFile" : "file"];
    if (!meta) return fail("Arquivo não encontrado.", 404);
    const encoded = record.seeded ? assets[meta.key]?.base64 : null;
    const obj = record.seeded ? null : await env.BUCKET?.get(meta.key);
    if (!encoded && !obj) return fail("Arquivo não encontrado.", 404);
    const inline = url.searchParams.get("view") === "1" &&
      ["application/pdf", "image/jpeg", "image/png"].includes(meta.mime);
    const content = encoded ? Uint8Array.from(atob(encoded), character => character.charCodeAt(0)) : obj.body;
    return new Response(content, { headers: {
      "Content-Type": meta.mime,
      "Content-Disposition": (inline ? "inline" : "attachment") + '; filename="' + meta.name + '"',
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    } });
  }
  if (!env.BUCKET) return fail("Arquivo compartilhado indisponível no momento.", 503);
  if (path === "/api/app/document-photos" && request.method === "POST") {
    const form=await request.formData(),file=form.get('file'),documentId=text(form.get('documentId'));
    if(!documentId || documentId.length>100 || !(file instanceof File) || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>2*1024*1024) return fail('Fotografia inválida. Use o formulário para ajustar a imagem antes do envio.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes.length<3 || bytes[0]!==255 || bytes[1]!==216 || bytes[2]!==255) return fail('Envie a fotografia JPEG processada pelo formulário.');
    const record={ownerEmail:env.USER.email,id:crypto.randomUUID(),kind:'document_photo',internal:true,documentId,title:'Fotografia de prática alimentar',createdAt:stamp(),updatedAt:stamp()};
    await writeFile(env.BUCKET,record,new File([bytes],'foto.jpg',{type:'image/jpeg'}));await putRecord(env.BUCKET,record);
    return reply({id:record.id},201);
  }
  if (path === "/api/app/arquivo" && request.method === "POST") {
    const form = await request.formData();
    let fields;
    try { fields = centralFields(name => form.get(name)); } catch (error) { return fail(error.message, error.status || 400); }
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !fields.fin) return fail("Selecione o arquivo ou informe um lançamento financeiro.");
    const record = { id: crypto.randomUUID(), ...fields, createdAt: stamp(), updatedAt: stamp(), createdBy: env.USER?.email || "" };
    if (hasFile) { try { await writeFile(env.BUCKET, record, file); } catch (error) { return fail(error.message); } }
    try { await putRecord(env.BUCKET, record); }
    catch (error) { if (record.file) await env.BUCKET.delete(record.file.key); throw error; }
    return reply(publicRecord(record), 201);
  }
  if (path === "/api/app/documents" && request.method === "POST") {
    const input = await request.json();
    if (input && input.area) {
      let fields;
      try { fields = centralFields(name => input[name]); } catch (error) { return fail(error.message, error.status || 400); }
      if (fields.kind !== "ata" && fields.kind !== "ata_compra") return fail("Somente atas podem ser redigidas no sistema.");
      const body = text(input.body, 30000);
      if (!body) return fail("Informe o texto da ata.");
      const record = { id: crypto.randomUUID(), ...fields, typed: true, body, presentes: text(input.presentes, 3000),
        createdAt: stamp(), updatedAt: stamp(), createdBy: env.USER?.email || "" };
      await putRecord(env.BUCKET, record);
      return reply(publicRecord(record), 201);
    }
    if (text(input.kind) !== "ata" || !validDate(input.date) ||
        !text(input.title) || !text(input.body, 30000)) {
      return fail("Informe título, data e texto da ata.");
    }
    const record = {
      id: crypto.randomUUID(), kind: "ata", program: "APP", year: Number(input.date.slice(0, 4)),
      date: input.date, competence: input.date.slice(0, 7),
      title: text(input.title), body: text(input.body, 30000),
      createdAt: stamp(), updatedAt: stamp(),
    };
    await putRecord(env.BUCKET, record);
    return reply(publicRecord(record), 201);
  }
  if (path === "/api/app/upload" && request.method === "POST") {
    const form = await request.formData();
    const kind = text(form.get("kind"));
    const competence = text(form.get("competence"));
    const title = text(form.get("title"));
    const program = text(form.get("program"));
    const section = text(form.get("section")) || "financeiro";
    const bank = section === "financeiro" ? (program === "SICOOB" ? "SICOOB" : ["PDDE_Basico","PDDE_Qualidade","Educacao_Conectada"].includes(program) ? "BB" : "") : "";
    const statementType = kind === "extrato" ? text(form.get("statementType")) : "";
    const file = form.get("file");
    if (!["extrato", "resolucao", "comprovante", "cotacao", "pesquisa_precos", "nota_fiscal", "recibo", "demonstrativo", "conciliacao", "plano", "parecer", "outro"].includes(kind) ||
        !["APP", "PDDE_Basico", "PDDE_Qualidade", "Educacao_Conectada", "SICOOB"].includes(program) ||
        !["financeiro", "juridico", "pareceres", "transparencia"].includes(section) ||
        !/^\d{4}-\d{2}$/.test(competence) || !title ||
        (kind === "extrato" && !["conta_corrente", "investimentos", "consolidado", "outro"].includes(statementType))) {
      return fail("Preencha tipo, programa, competência e descrição.");
    }
    const record = {
      id: crypto.randomUUID(), kind, program, year: Number(competence.slice(0, 4)),
      competence, title, statementType,
      section, bank,
      folder: section === "financeiro" ? (kind === "extrato" ? "Extratos e conciliações" : "Documentos financeiros") :
        section === "juridico" ? "Atas e documentos institucionais" :
        section === "pareceres" ? "Pareceres e aprovações" : "Transparência para famílias",
      createdAt: stamp(), updatedAt: stamp(),
    };
    try { await writeFile(env.BUCKET, record, file); }
    catch (error) { return fail(error.message); }
    try { await putRecord(env.BUCKET, record); }
    catch (error) { await env.BUCKET.delete(record.file.key); throw error; }
    return reply(publicRecord(record), 201);
  }
  const match = path.match(/^\/api\/app\/documents\/([a-f0-9-]{36})(\/signed)?$/);
  if (!match) return fail("Página não encontrada.", 404);
  const record = await getRecord(env.BUCKET, match[1]);
  if (!record) return fail("Documento não encontrado.", 404);
  if (record.seeded || record.readOnly) return fail("Os documentos iniciais são somente para consulta.", 405);
  if (match[2] && request.method === "POST") {
    if (record.kind !== "ata" && !record.central) return fail("O anexo assinado é reservado às atas.");
    const form = await request.formData();
    try { await writeFile(env.BUCKET, record, form.get("file"), true); }
    catch (error) { return fail(error.message); }
    record.updatedAt = stamp();
    await putRecord(env.BUCKET, record);
    return reply(publicRecord(record));
  }
  if (!match[2] && request.method === "PUT") {
    const input = await request.json();
    if (record.central || input?.central === true) {
      let fields;
      try { fields = centralFields(name => input[name]); } catch (error) { return fail(error.message, error.status || 400); }
      if (!record.file && !fields.fin && !(record.typed || record.body)) return fail("Um registro sem arquivo precisa de lançamento financeiro.");
      if (record.typed || (record.kind === "ata" && record.body)) {
        const body = text(input.body ?? record.body, 30000);
        if (!body) return fail("Informe o texto da ata.");
        record.body = body; record.typed = true; record.presentes = text(input.presentes ?? record.presentes, 3000);
        if (!["ata", "ata_compra"].includes(fields.kind)) return fail("Uma ata redigida deve continuar como ata.");
      }
      Object.assign(record, fields, { updatedAt: stamp(), updatedBy: env.USER?.email || "" });
      if (fields.kind !== "extrato") delete record.statementType;
      delete record.section; delete record.folder; delete record.bank;
      await putRecord(env.BUCKET, record);
      return reply(publicRecord(record));
    }
    if (record.kind !== "ata") return fail("Somente atas redigidas podem ser editadas.");
    if (!validDate(input.date) || !text(input.title) || !text(input.body, 30000))
      return fail("Informe título, data e texto da ata.");
    record.date = input.date; record.competence = input.date.slice(0, 7);
    record.year = Number(input.date.slice(0, 4));
    record.title = text(input.title); record.body = text(input.body, 30000);
    record.updatedAt = stamp();
    await putRecord(env.BUCKET, record);
    return reply(publicRecord(record));
  }
  if (!match[2] && request.method === "DELETE") {
    await env.BUCKET.delete(recordKey(record.id));
    if (record.file) await env.BUCKET.delete(record.file.key);
    if (record.signedFile) await env.BUCKET.delete(record.signedFile.key);
    return reply({ deleted: true });
  }
  return fail("Operação não permitida.", 405);
}
// Decodifica cada arquivo da página uma única vez por instância (economiza CPU no plano gratuito).
const assetBytes = new Map();
function decodedAsset(pathname) {
  if (!assetBytes.has(pathname)) {
    const binary = atob(assets[pathname].base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    assetBytes.set(pathname, bytes);
  }
  return assetBytes.get(pathname);
}
let indexHtmlText = null;
function serveAsset(url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const asset = assets[pathname];
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const bytes = decodedAsset(pathname);
  return new Response(bytes, {
    headers: {
      "Content-Type": asset.type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": pathname.endsWith(".html") ? "private, no-store, max-age=0" : "public, max-age=300",
      ...(pathname.endsWith(".html") ? {"Vary":"Cookie", "Pragma":"no-cache"} : {}),
    },
  });
}
export default {
  async fetch(request, env, ctx) {
    try {
      const authResponse = await handleAuthRoute(request, env);
      if (authResponse) return authResponse;
      request = await prepareRequest(request, env);
      const url = new URL(request.url);
      if (!env.BUCKET) return fail('Armazenamento da hospedagem indisponível.',503);
      if (!['GET','HEAD'].includes(request.method) && !sameOrigin(request)) return fail('Operação não permitida.',403);
      await ensureInitial(env.BUCKET);
      const bucket=await activeBucket(env.BUCKET),user=await identity(request,env,bucket);
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(request.method))return fail('Operação não permitida.',405);
        if(url.pathname==='/'||url.pathname==='/public.html')return serveAsset(new URL('/public.html',url));
        if(['/admin','/docentes','/restrito','/index.html'].includes(url.pathname)){
          if(!['admin','teacher'].includes(user.role))return serveAsset(new URL('/access.html',url));
          // Decode UTF-8 once before injecting the trusted session.
          const decoded=indexHtmlText??=new TextDecoder().decode(decodedAsset('/index.html'));
          return new Response(decoded.replace('<head>','<head><script>window.CEI_SESSION='+JSON.stringify({email:user.email,role:user.role}).replaceAll('<','\\u003c')+';</script>'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','Pragma':'no-cache'}});
        }
        if(url.pathname.startsWith('/public-app-files/')&&user.role!=='admin')return fail('Acesso restrito.',403);
        return serveAsset(url);
      }
      if(url.pathname==='/api/session'||url.pathname==='/api/public/materials'||url.pathname==='/api/public/home'||url.pathname.startsWith('/api/portal/')){
        const run=async()=>{const b=await activeBucket(env.BUCKET);return reply(await portalApi(request,b,await identity(request,env,b),listRecords,env))};
        return await (request.method==='GET'?run():withWriteLock(env.BUCKET,run));
      }
      const pf=url.pathname.match(/^\/api\/public\/file\/([a-f0-9-]{36})$/);
      if(pf&&request.method==='GET'){
        const record=await getRecord(bucket,pf[1]);
        if(!record||record.internal||!(user.data.portal?.publicIds||[]).includes(pf[1]))return fail('Documento não publicado.',404);
        const inner=new URL('/api/app/documents/'+pf[1]+'/file',url);if(url.searchParams.get('view')==='1')inner.searchParams.set('view','1');
        return handleApi(new Request(inner,{headers:request.headers}),{...env,BUCKET:bucket,USER:user},inner);
      }
      const fm=url.pathname.match(/^\/api\/app\/documents\/([a-f0-9-]{36})\/file$/);
      if(fm&&request.method==='GET'){
        const record=await getRecord(bucket,fm[1]);
        if(user.role==='admin'||(user.data.portal?.publicIds||[]).includes(fm[1])&&!record?.internal||user.role==='teacher'&&record?.internal&&record.ownerEmail===user.email)return handleApi(request,{...env,BUCKET:bucket,USER:user},url);
        return fail('Acesso restrito.',403);
      }
      if(!['admin','teacher'].includes(user.role))return fail('Entre com uma conta autorizada.',user.role==='anonymous'?401:403);
      if(user.role==='teacher'&&url.pathname!=='/api/data/state'&&!(url.pathname==='/api/app/document-photos'&&request.method==='POST'))return fail('Operação exclusiva da administração.',403);
      if (url.pathname.startsWith('/api/storage/')) {const operation=storageApi(request,env.BUCKET,{records:listRecords,assets});ctx?.waitUntil?.(operation.then(()=>{},()=>{}));return await operation;}
      if (url.pathname === '/api/data/state' || url.pathname.startsWith('/api/app/')) {
        const run=async()=>{const active={...env,BUCKET:await activeBucket(env.BUCKET)};active.USER=await identity(request,env,active.BUCKET);if(!['admin','teacher'].includes(active.USER.role))return fail('Acesso revogado.',403);if(active.USER.role==='teacher'&&url.pathname!=='/api/data/state'&&!(url.pathname==='/api/app/document-photos'&&request.method==='POST'))return fail('Operação exclusiva da administração.',403);return url.pathname==='/api/data/state'?handleStateApi(request,active):handleApi(request,active,url)};
        const operation=['GET','HEAD'].includes(request.method)?run():withWriteLock(env.BUCKET,run);
        ctx?.waitUntil?.(operation.then(()=>{},()=>{}));
        return await operation;
      }
      if (request.method !== "GET" && request.method !== "HEAD") return fail("Operação não permitida.", 405);
      return serveAsset(url);
    } catch (error) {
      if(!error.status) console.error("APP archive error", error);
      return fail(error.status ? error.message : "Não foi possível concluir a operação. Tente novamente.", error.status || 500);
    }
  },
};
