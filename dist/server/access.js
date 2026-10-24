import {makeCredential} from './auth.js';
const KEY='cei/state/current.json';
const allowed=new Set(['relatorioAvaliativo','praticaAlimentar','documentoTimbrado']);
const deny=(message='Acesso não autorizado.',status=403)=>{throw Object.assign(Error(message),{status})};
// v40: página pública com categorias, avisos e informações da unidade
export const PUBLIC_CATEGORIES=['regimento','ppp','conselho','app','calendario','cardapio','comunicados','outros'];
const DEFAULT_INFO={phone:'(47) 3452-2185',whatsapp:'554734522185',address:'Rua Florentina Pereira Jasper, nº 136 – Porto Grande, Araquari – SC',hours:'',email:'',about:'',vagas:''};
const clip=(v,n)=>String(v??'').trim().slice(0,n);
const todayBR=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
function guessCategory(r){const t=String(r.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(r.kind==='ppp'||/\bppp\b|projeto politico/.test(t))return 'ppp';
 if(r.kind==='calendario'||/calendario/.test(t))return 'calendario';
 if(r.kind==='cardapio'||/cardapio/.test(t))return 'cardapio';
 if(r.area==='conselho'||/conselho/.test(t))return 'conselho';
 if(r.area==='app'||r.program&&r.program!==''||/\bapp\b|associacao de pais/.test(t))return 'app';
 if(r.kind==='regimento'||/regimento/.test(t))return 'regimento';
 if(r.kind==='comunicado')return 'comunicados';
 return 'outros'}
function publicNotices(p,all=false){const today=todayBR();return (p.notices||[]).filter(n=>all||!n.until||n.until>=today).sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||String(b.date).localeCompare(String(a.date)))}
export async function identity(request,env,bucket){
 const id=request.headers.get('oai-authenticated-user-id'),email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
 const obj=await bucket.get(KEY),data=obj?JSON.parse(await obj.text()):{};
 // v42: sessão por senha só vale enquanto a senha não for trocada ou redefinida.
 const stale=id&&id.startsWith('senha:')&&data.portal?.credentials?.[email]?.updatedAt!==id.slice(6);
 const role=id&&email&&!stale?(email===String(env.CEI_BOOTSTRAP_ADMIN_EMAIL||'').toLowerCase()?'admin':data.portal?.members?.find(m=>m.email===email)?.role||'pending'):'anonymous';
 return {id,email,role,data};
}
export function teacherState(data,user){
 const loans=(data.loans||[]).filter(l=>l.ownerEmail===user.email || data.readers?.some(r=>r.id===l.readerId&&r.accountEmail===user.email));
 return {app:'CEI Admin',schemaVersion:4,savedAt:data.savedAt,settings:data.settings,docs:[],books:(data.books||[]).map(({id,title,author,publisher,year,isbn,category,age,location,quantity,status,cutter,cdd})=>({id,title,author,publisher,year,isbn,category,age,location,quantity,status,cutter,cdd,unavailable:(data.loans||[]).filter(l=>l.bookId===id&&!l.returned).length})),loans,readers:(data.readers||[]).filter(r=>loans.some(l=>l.readerId===r.id)),generatedDocs:(data.generatedDocs||[]).filter(d=>d.ownerEmail===user.email&&allowed.has(d.template)),oficios:[],waitlist:[],encaminhamentosMeimei:[]};
}
export function mergeTeacher(current,incoming,user){
 if(!Array.isArray(incoming.generatedDocs))deny('Documentos inválidos.',400);
 const ids=new Set();
 const docs=incoming.generatedDocs.map(d=>{
  if(!d||typeof d.id!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(d.id)||ids.has(d.id)||!allowed.has(d.template))deny('Modelo de documento não permitido.');ids.add(d.id);
  const old=current.generatedDocs.find(x=>x.id===d.id);
  if(old&&old.ownerEmail!==user.email)deny();
  return {...d,ownerEmail:user.email};
 });
 return {...current,generatedDocs:[...current.generatedDocs.filter(d=>d.ownerEmail!==user.email||!allowed.has(d.template)),...docs],savedAt:new Date().toISOString()};
}
export async function portalApi(request,bucket,user,listRecords,env={}){
 const path=new URL(request.url).pathname,method=request.method;
 if(path==='/api/session')return {role:user.role,email:user.email,signedIn:!!user.id};
 const data=user.data,p=data.portal||{members:[],requests:[],publicIds:[]};
 if(path==='/api/public/home'){const meta=p.publicMeta||{};const materials=(await listRecords(bucket)).filter(r=>!r.internal&&r.file&&p.publicIds.includes(r.id)).map(r=>({id:r.id,title:r.title,kind:r.kind,date:r.date||r.competence||'',category:PUBLIC_CATEGORIES.includes(meta[r.id]?.category)?meta[r.id].category:guessCategory(r),description:clip(meta[r.id]?.description,300),mime:r.file.mime,size:r.file.size}));return {info:{...DEFAULT_INFO,...(p.info||{})},notices:publicNotices(p).map(({id,title,body,date,until,pinned})=>({id,title,body,date,until,pinned:!!pinned})),materials}}
 if(path==='/api/public/materials')return (await listRecords(bucket)).filter(r=>!r.internal&&p.publicIds.includes(r.id)).map(({id,title,kind,date,file})=>({id,title,kind,date,hasFile:!!file}));
 if(!['admin','teacher'].includes(user.role))deny();
 if(method==='GET'){
  if(path==='/api/portal/members'){if(user.role!=='admin')deny();const c=p.credentials||{};return p.members.map(m=>({...m,hasPassword:!!c[m.email],mustChange:!!c[m.email]?.mustChange}));}
  if(path==='/api/portal/publications'){if(user.role!=='admin')deny();return {ids:p.publicIds,meta:p.publicMeta||{},records:(await listRecords(bucket)).filter(r=>!r.internal)};}
  if(path==='/api/portal/public-settings'){if(user.role!=='admin')deny();return {info:{...DEFAULT_INFO,...(p.info||{})},notices:publicNotices(p,true),meta:p.publicMeta||{},categories:PUBLIC_CATEGORIES};}
  if(path==='/api/portal/requests')return p.requests.filter(r=>user.role==='admin'||r.email===user.email);
  deny('Não encontrado.',404);
 }
 const input=await request.json();
 if(path==='/api/portal/members'){
  if(user.role!=='admin')deny();const email=String(input.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','teacher','pending'].includes(input.role))deny('Informe e-mail e perfil válidos.',400);
  if(email===user.email&&input.role!=='admin')deny('Você não pode retirar seu próprio acesso administrativo.');
  p.members=p.members.filter(m=>m.email!==email);p.members.push({email,role:input.role,name:String(input.name||'').slice(0,150)});
  if(input.password){p.credentials=p.credentials||{};p.credentials[email]=await makeCredential(input.password,env,true);}
  if(input.readerId){const reader=data.readers.find(r=>r.id===input.readerId);if(!reader)deny('Leitor não encontrado.',400);if(data.readers.some(r=>r.id!==reader.id&&r.accountEmail===email))deny('Essa conta já está vinculada a outro leitor.',400);reader.accountEmail=email;}
 }else if(path==='/api/portal/publications'){
  if(user.role!=='admin')deny();const records=await listRecords(bucket);if(!records.some(r=>r.id===input.id&&!r.internal&&r.file))deny('Selecione um documento com arquivo.',400);
  p.publicIds=p.publicIds.filter(id=>id!==input.id);if(input.published===true)p.publicIds.push(input.id);
  p.publicMeta=p.publicMeta||{};
  if(input.published===true){const record=records.find(r=>r.id===input.id);const category=PUBLIC_CATEGORIES.includes(input.category)?input.category:(p.publicMeta[input.id]?.category||guessCategory(record));p.publicMeta[input.id]={category,description:clip(input.description??p.publicMeta[input.id]?.description,300)}}
  else delete p.publicMeta[input.id];
 }else if(path==='/api/portal/password'){
  if(user.role!=='admin')deny();const email=String(input.email||'').trim().toLowerCase();
  if(!p.members.some(m=>m.email===email)&&email!==String(env.CEI_BOOTSTRAP_ADMIN_EMAIL||'').toLowerCase())deny('Cadastre o e-mail na equipe antes de definir a senha.',400);
  p.credentials=p.credentials||{};p.credentials[email]=await makeCredential(input.password,env,true);
 }else if(path==='/api/portal/public-info'){
  if(user.role!=='admin')deny();
  const info={phone:clip(input.phone,40),whatsapp:clip(input.whatsapp,20).replace(/\D/g,''),address:clip(input.address,240),hours:clip(input.hours,300),email:clip(input.email,120),about:clip(input.about,2500),vagas:clip(input.vagas,1500)};
  if(info.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email))deny('Informe um e-mail válido.',400);
  p.info=info;
 }else if(path==='/api/portal/notices'){
  if(user.role!=='admin')deny();p.notices=p.notices||[];
  if(input.delete===true){p.notices=p.notices.filter(n=>n.id!==input.id)}
  else{const title=clip(input.title,160),body=clip(input.body,3000),until=clip(input.until,10);
   if(!title)deny('Informe o título do aviso.',400);
   if(until&&(!/^\d{4}-\d{2}-\d{2}$/.test(until)||new Date(until+'T12:00:00Z').toISOString().slice(0,10)!==until))deny('Data final inválida.',400);
   const old=p.notices.find(n=>n.id===input.id);
   const notice={id:old?.id||crypto.randomUUID(),title,body,until,pinned:input.pinned===true,date:old?.date||todayBR(),updatedAt:new Date().toISOString(),by:user.email};
   p.notices=p.notices.filter(n=>n.id!==notice.id);p.notices.push(notice);if(p.notices.length>200)deny('Limite de avisos atingido. Exclua avisos antigos.',400)}
 }else if(path==='/api/portal/requests'){
  const book=data.books.find(b=>b.id===input.bookId);if(!book)deny('Livro não encontrado.',404);
  if(p.requests.some(r=>r.email===user.email&&r.bookId===book.id&&r.status==='pending'))deny('Você já tem uma solicitação pendente para este livro.',409);
  p.requests.push({id:crypto.randomUUID(),bookId:book.id,title:book.title,email:user.email,name:p.members.find(m=>m.email===user.email)?.name||user.email,status:'pending',createdAt:new Date().toISOString()});
 }else if(path==='/api/portal/decision'){
  if(user.role!=='admin')deny();const r=p.requests.find(r=>r.id===input.id);if(!r||r.status!=='pending')deny('Solicitação já atendida ou não encontrada.',409);
  if(!['approved','rejected'].includes(input.status))deny('Decisão inválida.',400);
  if(input.status==='approved'){
   const b=data.books.find(b=>b.id===r.bookId),active=data.loans.filter(l=>l.bookId===r.bookId&&!l.returned),qty=Math.max(1,Number(b?.quantity)||1);
   if(!b||active.length>=qty)deny('Não há exemplares disponíveis.',409);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(input.due||'')||input.due<new Date().toISOString().slice(0,10))deny('Informe uma data futura para devolução.',400);
   let reader=data.readers.find(x=>x.accountEmail===r.email);if(!reader){reader={id:crypto.randomUUID(),name:r.name,category:'Docente',accountEmail:r.email,active:true};data.readers.push(reader)}
   let copyNumber=1;while(active.some(l=>l.copyNumber===copyNumber))copyNumber++;
   data.loans.push({id:crypto.randomUUID(),bookId:b.id,bookTitle:b.title,bookCutter:b.cutter,copyNumber,readerId:reader.id,person:reader.name,ownerEmail:r.email,date:new Date().toISOString().slice(0,10),due:input.due,returned:false,createdAt:new Date().toISOString(),renewals:[]});
   b.status=active.length+1>=qty?'Emprestado':'Disponível';
  }
  r.status=input.status;r.decidedAt=new Date().toISOString();r.decidedBy=user.email;
 }else deny('Não encontrado.',404);
 data.portal=p;data.savedAt=new Date().toISOString();await bucket.put(KEY,JSON.stringify(data));return {ok:true};
}
