import {makeCredential} from './auth.js';
const KEY='cei/state/current.json';
const allowed=new Set(['relatorioAvaliativo','praticaAlimentar','documentoTimbrado']);
const deny=(message='Acesso não autorizado.',status=403)=>{throw Object.assign(Error(message),{status})};
// v40: página pública com categorias, avisos e informações da unidade
export const PUBLIC_CATEGORIES=['regimento','ppp','conselho','app','calendario','cardapio','comunicados','outros'];
const DEFAULT_INFO={phone:'(47) 3452-2185',whatsapp:'554734522185',address:'Rua Florentina Pereira Jasper, nº 136 – Porto Grande, Araquari – SC',mapa:'Rua Florentina Pereira Jasper, 93 - Porto Grande, Araquari - SC',hours:'',email:'',about:'',vagas:''};
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
// v51: equipe da instituição e fotos 3x4 (fotos ficam em cei/fotos/<id>; nunca telefone/e-mail no público).
export const CATEGORIAS_EQUIPE=['gestao','professores','administrativo','apoio','estagio'];
const FOTO_ID=/^[a-f0-9-]{36}$/;
const cleanFoto=v=>FOTO_ID.test(String(v||''))?String(v):'';
function cleanPessoa(input,old,user){
 const nome=clip(input.nome,120),funcao=clip(input.funcao,100);
 if(!nome)deny('Informe o nome.',400);if(!funcao)deny(`Informe a função de ${nome}.`,400);
 const email=clip(input.email,120).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))deny(`E-mail inválido para ${nome}.`,400);
 return {id:old?.id||crypto.randomUUID(),nome,funcao,categoria:CATEGORIAS_EQUIPE.includes(input.categoria)?input.categoria:'professores',vinculo:clip(input.vinculo,40),atuacao:clip(input.atuacao,120),
  telefone:clip(input.telefone,40),email,foto:cleanFoto(input.foto),publico:input.publico!==false,ordem:Number.isFinite(Number(input.ordem))?Number(input.ordem):(old?.ordem??9999),atualizadoEm:new Date().toISOString(),por:user.email};
}
const normNome=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
// Membro de colegiado sem foto própria usa a foto da mesma pessoa cadastrada na equipe.
function fotoDe(p,m){if(m.foto)return m.foto;const e=(p.equipe||[]).find(x=>x.foto&&normNome(x.nome)===normNome(m.nome));return e?e.foto:''}
export function fotosReferenciadas(p){const set=new Set();for(const e of p.equipe||[])if(e.foto)set.add(e.foto);const c=colegiados(p);for(const o of ORGAOS)for(const ch of c[o])for(const m of ch.membros)if(m.foto)set.add(m.foto);return set}
function vigentes(p){const h=new Date().toISOString().slice(0,10),c=colegiados(p),out={};for(const o of ORGAOS){const v=c[o].filter(x=>x.publico!==false&&x.inicio<=h&&x.fim>=h).sort((a,b)=>b.inicio.localeCompare(a.inicio))[0];if(v)out[o]=v}return out}
export function publicEquipe(p){
 const equipe=(p.equipe||[]).filter(e=>e.publico!==false).sort((a,b)=>(a.ordem-b.ordem)||a.nome.localeCompare(b.nome,'pt-BR')).map(({id,nome,funcao,categoria,atuacao,foto})=>({id,nome,funcao,categoria,atuacao,foto:foto||''}));
 const col={};for(const [o,ch] of Object.entries(vigentes(p)))col[o]={nome:ch.nome,inicio:ch.inicio,fim:ch.fim,membros:ch.membros.map(m=>({nome:m.nome,cargo:m.cargo,segmento:m.segmento,condicao:m.condicao,foto:fotoDe(p,m)}))};
 return {equipe,colegiados:col};
}
export function fotosPublicas(p){const {equipe,colegiados:col}=publicEquipe(p),set=new Set(equipe.map(e=>e.foto).filter(Boolean));for(const ch of Object.values(col))for(const m of ch.membros)if(m.foto)set.add(m.foto);return set}

// v59: turmas atendidas em cada ano (faixas iguais às da enturmação: idade completa até 31/03).
export const FAIXAS_TURMA={2:'Maternal',3:'Jardim',4:'Pré I',5:'Pré II'};
const TURNOS=['matutino','vespertino','integral','noturno'];
function cleanTurmas(ano,list){
 if(!Number.isInteger(ano)||ano<2020||ano>2100)deny('Ano inválido.',400);
 if(!Array.isArray(list)||list.length>60)deny('Lista de turmas inválida (máximo 60 por ano).',400);
 return list.map((t,i)=>{const faixa=Number(t?.faixa);if(!FAIXAS_TURMA[faixa])deny('Faixa de idade inválida.',400);
  const vagas=t.vagas===''||t.vagas==null?null:Number(t.vagas);if(vagas!==null&&(!Number.isInteger(vagas)||vagas<0||vagas>99))deny('Número de vagas inválido.',400);
  return {id:/^[a-z0-9-]{8,40}$/.test(String(t.id||''))?t.id:crypto.randomUUID(),faixa,nome:clip(t.nome,60)||FAIXAS_TURMA[faixa],turno:TURNOS.includes(t.turno)?t.turno:'',vagas,professor:clip(t.professor,160),sala:clip(t.sala,60),ordem:i}});
}
export function publicTurmas(p){
 const all=p.turmas||{},atual=new Date().getFullYear();let anos=Object.keys(all).map(Number).filter(a=>a>=atual&&all[a]?.length).sort();
 if(!anos.length){const ult=Object.keys(all).map(Number).filter(a=>all[a]?.length).sort().pop();if(ult)anos=[ult]}
 if(!anos.length)return null;
 const mostrar=p.turmasPublico||{professor:true,vagas:true};
 return {anos:Object.fromEntries(anos.map(a=>[a,all[a].map(t=>({faixa:t.faixa,nome:t.nome,turno:t.turno,sala:t.sala,...(mostrar.vagas!==false&&t.vagas!=null?{vagas:t.vagas}:{}),...(mostrar.professor!==false&&t.professor?{professor:t.professor}:{})}))]))};
}

// v61: banco de horas da equipe (somente administração).
// Saldo positivo: o CEI deve horas à pessoa. Saldo negativo: a pessoa deve horas ao CEI.
export const TIPOS_BANCO=['entrada','saida','saida_rapida','extra','compensacao','ajuste'];
const HM=/^([01]\d|2[0-3]):[0-5]\d$/;
const hmMin=v=>{const s=String(v??'').trim();if(!HM.test(s))return null;const[h,m]=s.split(':').map(Number);return h*60+m};
const durMin=v=>{const m=String(v??'').trim().match(/^(\d{1,3})(?::([0-5]\d))?$/);return m?Number(m[1])*60+Number(m[2]||0):null};
export function minutosBanco(r){
 const a=hmMin(r.inicio),b=hmMin(r.fim),e=hmMin(r.escala),x=hmMin(r.real),intervalo=a!=null&&b!=null&&b>a?b-a:null;
 switch(r.tipo){
  case 'entrada':return e==null||x==null?null:e-x; // chegou antes da escala: ganha; atrasou: perde
  case 'saida':return e==null||x==null?null:x-e; // saiu depois da escala: ganha; saiu mais cedo: perde
  case 'saida_rapida':return intervalo==null?null:(r.abonado?0:-intervalo);
  case 'extra':return intervalo;
  case 'compensacao':case 'ajuste':{const d=intervalo??durMin(r.duracao);if(!d)return null;return r.sentido==='-'?-d:d}
 }
 return null;
}
const ERRO_BANCO={entrada:'Informe o horário da escala e o horário em que a pessoa chegou.',saida:'Informe o horário da escala e o horário em que a pessoa saiu.',saida_rapida:'Informe o horário em que a pessoa saiu e o horário em que voltou (a volta depois da saída).',extra:'Informe o início e o fim do trabalho extra (o fim depois do início).',compensacao:'Informe o horário de início e fim ou a duração (ex.: 2:30).',ajuste:'Informe a duração (ex.: 4:00).'};
function cleanRegistroBanco(r,old,p,user){
 const pessoa=(p.equipe||[]).find(e=>e.id===r?.pessoaId);if(!pessoa)deny('Escolha uma pessoa cadastrada em Equipe da instituição.',400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.data||''))||Number.isNaN(Date.parse(r.data+'T12:00:00Z')))deny('Informe a data.',400);
 const tipo=TIPOS_BANCO.includes(r.tipo)?r.tipo:deny('Tipo de registro inválido.',400);
 const h=v=>HM.test(String(v??'').trim())?String(v).trim():'';
 const out={id:old?.id||crypto.randomUUID(),pessoaId:pessoa.id,pessoaNome:pessoa.nome,data:r.data,tipo,escala:'',real:'',inicio:'',fim:'',duracao:'',sentido:'',abonado:false,motivo:'',obs:clip(r.obs,300)};
 if(tipo==='entrada'||tipo==='saida'){out.escala=h(r.escala);out.real=h(r.real)}
 else{out.inicio=h(r.inicio);out.fim=h(r.fim)}
 if(tipo==='compensacao'||tipo==='ajuste'){out.sentido=r.sentido==='-'?'-':'+';if(!(out.inicio&&out.fim))out.duracao=String(r.duracao??'').trim().slice(0,7)}
 if(tipo==='ajuste'){out.inicio=out.fim=''}
 if(tipo==='saida_rapida'){out.motivo=['consulta','pessoal','outro'].includes(r.motivo)?r.motivo:'pessoal';out.abonado=r.abonado===true}
 const min=minutosBanco(out);if(min==null)deny(ERRO_BANCO[tipo],400);
 if(Math.abs(min)>(tipo==='ajuste'||tipo==='compensacao'?999*60:16*60))deny('Diferença grande demais para um registro. Confira os horários.',400);
 if(tipo==='ajuste'&&!out.obs)deny('Explique o ajuste em observações (ex.: saldo trazido da planilha de 2025).',400);
 return {...out,minutos:min,criadoEm:old?.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString(),por:user.email};
}
function bancoHoras(p){const b=p.bancoHoras&&typeof p.bancoHoras==='object'?p.bancoHoras:{};return {escalas:b.escalas&&typeof b.escalas==='object'?b.escalas:{},registros:Array.isArray(b.registros)?b.registros:[]}}
// v63: venda de fotos (aba Fotos). Eventos com preço por faixa de quantidade e pedidos dos pais. Valores em centavos.
// Dados de crianças e telefones: só a administração (nunca na página pública nem no espaço do professor).
const TAM_FOTO=['10x15','15x21','20x25','20x30'],PAG_FOTO=['pendente','parcial','pago'],SIT_FOTO=['recebido','producao','pronto','entregue'],FORMA_FOTO=['pix','dinheiro','cartao','outro'],TIPO_ANEXO=['whatsapp','comprovante','outro'];
const UUID_RE=/^[a-f0-9-]{36}$/;
function fotosPed(p){const f=p.fotos&&typeof p.fotos==='object'?p.fotos:{};return {eventos:Array.isArray(f.eventos)?f.eventos:[],pedidos:Array.isArray(f.pedidos)?f.pedidos:[]}}
export function anexosFotos(p){const s=new Set();for(const o of fotosPed(p).pedidos)for(const a of o.anexos||[])s.add(a.id);return s}
const inteiro=(v,min,max,msg)=>{const n=Number(v);if(v===''||v==null||!Number.isInteger(n)||n<min||n>max)deny(msg,400);return n};
export function precoFoto(ev,qtd){const f=(ev.faixas||[]).find(x=>qtd>=x.de&&(x.ate==null||qtd<=x.ate));return f?f.valor:null}
export function cleanEventoFoto(i,old,user){
 const nome=clip(i.nome,80);if(!nome)deny('Dê um nome ao evento.',400);
 const fx=Array.isArray(i.faixas)?i.faixas:[];if(!fx.length||fx.length>8)deny('Informe de 1 a 8 faixas de preço.',400);
 const faixas=fx.map(f=>({de:inteiro(f.de,1,9999,'Faixa de fotos inválida.'),ate:f.ate==null||f.ate===''?null:inteiro(f.ate,1,9999,'Faixa de fotos inválida.'),valor:inteiro(f.valor,0,999999,'Valor da foto inválido.')})).sort((a,b)=>a.de-b.de);
 faixas.forEach(f=>{if(f.ate!==null&&f.ate<f.de)deny('Em uma faixa, o "até" não pode ser menor que o "a partir de".',400)});
 if(faixas[0].de!==1)deny('A primeira faixa deve começar em 1 foto.',400);
 faixas.forEach((f,k)=>{if(k&&(faixas[k-1].ate==null||f.de!==faixas[k-1].ate+1))deny('As faixas devem ser seguidas, sem buraco nem sobreposição (ex.: 1 a 2, 3 a 9, 10 em diante).',400)});
 return {id:old?.id||crypto.randomUUID(),nome,aberto:i.aberto!==false,faixas,criadoEm:old?.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString(),por:user.email};
}
export function cleanPedidoFoto(i,old,p,user){
 const ev=fotosPed(p).eventos.find(e=>e.id===i.eventoId);if(!ev)deny('Escolha o evento de venda.',400);
 if(!ev.aberto&&!old)deny('Este evento está encerrado. Reabra o evento para lançar novos pedidos.',400);
 const responsavel=clip(i.responsavel,100),crianca=clip(i.crianca,100),telefone=clip(i.telefone,30);
 if(!responsavel)deny('Informe o nome do pai ou responsável.',400);if(!crianca)deny('Informe o nome da criança.',400);
 if(telefone.replace(/\D/g,'').length<10)deny('Informe o telefone com DDD.',400);
 if(i.data&&!/^\d{4}-\d{2}-\d{2}$/.test(i.data))deny('Data do pedido inválida.',400);
 const its=Array.isArray(i.itens)?i.itens:[];if(!its.length||its.length>8)deny('Informe ao menos um tamanho de foto.',400);
 const itens=its.map(x=>{if(!TAM_FOTO.includes(x.tam))deny('Tamanho de foto inválido. Use 10x15, 15x21, 20x25 ou 20x30.',400);return {tam:x.tam,qtd:inteiro(x.qtd,1,200,'Quantidade de fotos inválida (de 1 a 200).')}});
 const fotos=itens.reduce((s,x)=>s+x.qtd,0),unitario=precoFoto(ev,fotos);
 if(unitario==null)deny('O evento não tem preço para '+fotos+' fotos. Ajuste as faixas do evento.',400);
 const total=fotos*unitario,pagamento=PAG_FOTO.includes(i.pagamento)?i.pagamento:'pendente';
 let recebido=0;if(pagamento==='pago')recebido=total;else if(pagamento==='parcial'){recebido=inteiro(i.recebido,1,total,'Pagamento em parte: informe um valor maior que zero e menor que o total.');if(recebido>=total)deny('Pagamento em parte: o valor deve ser menor que o total. Se já pagou tudo, marque "Pago".',400)}
 const an=Array.isArray(i.anexos)?i.anexos:[];if(an.length>6)deny('Máximo de 6 anexos por pedido.',400);
 const anexos=an.map(a=>{if(!UUID_RE.test(a.id||''))deny('Anexo inválido.',400);return {id:a.id,nome:clip(a.nome,80)||'anexo',tipo:TIPO_ANEXO.includes(a.tipo)?a.tipo:'outro'}});
 return {id:old?.id||crypto.randomUUID(),eventoId:ev.id,eventoNome:ev.nome,responsavel,telefone,crianca,turma:clip(i.turma,60),data:i.data||old?.data||todayBR(),itens,fotos,unitario,total,pagamento,recebido,forma:FORMA_FOTO.includes(i.forma)?i.forma:'',situacao:SIT_FOTO.includes(i.situacao)?i.situacao:'recebido',anexos,obs:clip(i.obs,300),criadoEm:old?.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString(),por:user.email};
}
// v60: links úteis. A área restrita vê todos; o espaço do professor e a página pública veem só os marcados para eles.
const CORES_LINK=['azul','verde','laranja','vermelho','roxo','turquesa','rosa','cinza'];
export function linkUrl(v){
 let u=String(v??'').trim();if(!u)deny('Informe o endereço do link.',400);
 if(/^tel:/i.test(u)||/^\+?[\d\s().-]{8,}$/.test(u))u='tel:'+u.replace(/^tel:/i,'').replace(/[^\d+]/g,'');
 if(/^[^\s@:\/]+@[^\s@]+\.[^\s@]+$/.test(u))u='mailto:'+u;
 else if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u.replace(/^\/+/,'');
 let x;try{x=new URL(u)}catch{deny('Endereço inválido. Exemplo: https://www.araquari.sc.gov.br',400)}
 if(!['http:','https:','mailto:','tel:'].includes(x.protocol))deny('Use um endereço que comece com https://, http://, mailto: ou tel:.',400);
 if(x.protocol.startsWith('http')&&!/\./.test(x.hostname)&&x.hostname!=='localhost')deny('Endereço inválido. Confira o domínio (ex.: www.site.com.br).',400);
 if(u.length>800)deny('Endereço longo demais (máximo 800 caracteres).',400);
 return x.protocol.startsWith('http')?x.href:u;
}
function cleanLink(l,old,user){
 const titulo=clip(l?.titulo,80);if(!titulo)deny('Informe o nome do link.',400);
 return {id:old?.id||crypto.randomUUID(),titulo,url:linkUrl(l.url),descricao:clip(l.descricao,160),icone:/^[a-z0-9-]{1,30}$/.test(String(l.icone||''))?l.icone:'link',cor:CORES_LINK.includes(l.cor)?l.cor:'azul',
  professores:l.professores===true,publico:l.publico===true,ordem:Number.isFinite(old?.ordem)?old.ordem:Number.isFinite(l.ordem)?l.ordem:9999,criadoEm:old?.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString(),por:user.email};
}
const ordenarLinks=list=>(list||[]).slice().sort((a,b)=>(a.ordem??0)-(b.ordem??0)||a.titulo.localeCompare(b.titulo,'pt-BR'));
export function linksPara(p,quem){const all=ordenarLinks(p.links);if(quem==='admin')return all;return all.filter(l=>quem==='teacher'?l.professores:l.publico).map(({id,titulo,url,descricao,icone,cor})=>({id,titulo,url,descricao,icone,cor}))}

// v51: prestação de contas pública, calculada a partir dos lançamentos do Financeiro.
export const CONTAS_PUB={SICOOB:'APP · Sicoob (recursos próprios)',PDDE_Basico:'PDDE Básico (Base)',PDDE_Qualidade:'PDDE Qualidade',Educacao_Conectada:'Educação Conectada',OUTRA:'Outros recursos'};
function cleanTransparencia(input){return {contas:Object.keys(CONTAS_PUB).filter(k=>Array.isArray(input.contas)&&input.contas.includes(k)),detalhar:input.detalhar!==false}}
export function publicContas(p,records){
 const t=p.transparencia||{contas:[],detalhar:true};if(!t.contas?.length)return null;
 const fins=records.filter(r=>r.fin&&t.contas.includes(r.fin.account)&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')));
 const contas=t.contas.map(conta=>{
  const list=fins.filter(r=>r.fin.account===conta),anos=[...new Set(list.map(r=>r.date.slice(0,4)))].sort().reverse();
  return {conta,label:CONTAS_PUB[conta],anos:anos.map(ano=>{
   const l=list.filter(r=>r.date.startsWith(ano)),sum=(m,n)=>l.filter(r=>r.fin.move===m&&(n===undefined||(r.fin.nature||'')===n)).reduce((s,r)=>s+r.fin.amount,0);
   const saldoInicial=sum('saldo_inicial'),entradas=sum('entrada'),saidas=sum('saida');
   const nat={};for(const n of ['custeio','capital'])nat[n]={entradas:sum('entrada',n)+sum('saldo_inicial',n),saidas:sum('saida',n)};
   const cat={};for(const r of l.filter(r=>r.fin.move==='saida')){const k=r.fin.category||'Outras despesas';cat[k]=(cat[k]||0)+r.fin.amount}
   const st=l.filter(r=>r.fin.move==='saldo_extrato').sort((a,b)=>b.date.localeCompare(a.date));let extrato=null;
   if(st.length){const d=st[0].date,by={};st.filter(r=>r.date.slice(0,7)===d.slice(0,7)).forEach(r=>{const k=r.fin.statementType||'conta_corrente';if(!by[k])by[k]=r});extrato={data:d,valor:by.consolidado?by.consolidado.fin.amount:Object.values(by).reduce((s,r)=>s+r.fin.amount,0)}}
   const lancamentos=t.detalhar?l.filter(r=>['entrada','saida','saldo_inicial'].includes(r.fin.move)).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>({data:r.date,descricao:clip(r.title,160),fornecedor:clip(r.fin.supplier,160),categoria:clip(r.fin.category,80),natureza:r.fin.nature||'',documento:clip(r.fin.docNumber,60),movimento:r.fin.move,valor:r.fin.amount})):undefined;
   return {ano,saldoInicial,entradas,saidas,saldo:saldoInicial+entradas-saidas,natureza:CONTAS_PUB[conta]&&conta!=='SICOOB'?nat:undefined,porCategoria:Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([categoria,valor])=>({categoria,valor})),extrato,lancamentos,atualizadoEm:l.map(r=>r.updatedAt||r.createdAt||'').sort().pop()||''};
  })};
 }).filter(c=>c.anos.length);
 return contas.length?{detalhar:t.detalhar,contas}:null;
}

// v48: composição da APP e do Conselho Escolar (chapas/mandatos com membros e contatos).
export const ORGAOS=['app','conselho'];
const validISO=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
function colegiados(p){const c=p.colegiados||{};return {app:Array.isArray(c.app)?c.app:[],conselho:Array.isArray(c.conselho)?c.conselho:[]}}
function cleanChapa(input,old,user){
 const nome=clip(input.nome,120),inicio=clip(input.inicio,10),fim=clip(input.fim,10);
 if(!nome)deny('Informe o nome da chapa ou da gestão (ex.: Gestão 2026–2027).',400);
 if(!validISO(inicio))deny('Informe a data de início do mandato.',400);
 if(!validISO(fim))deny('Informe a data de validade (fim do mandato).',400);
 if(fim<inicio)deny('A data de validade precisa ser depois do início.',400);
 if(!Array.isArray(input.membros))deny('Lista de membros inválida.',400);
 const membros=input.membros.map(m=>({foto:cleanFoto(m?.foto),nome:clip(m?.nome,120),cargo:clip(m?.cargo,80),segmento:clip(m?.segmento,60),condicao:m?.condicao==='suplente'?'suplente':'titular',telefone:clip(m?.telefone,40),email:clip(m?.email,120).toLowerCase()})).filter(m=>m.nome);
 if(!membros.length)deny('Cadastre pelo menos um membro.',400);
 if(membros.length>60)deny('Máximo de 60 membros por composição.',400);
 const bad=membros.find(m=>m.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email));if(bad)deny(`E-mail inválido para ${bad.nome}.`,400);
 return {id:old?.id||crypto.randomUUID(),nome,inicio,fim,publico:input.publico!==false,ata:clip(input.ata,160),observacoes:clip(input.observacoes,1500),membros,criadoEm:old?.criadoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString(),por:user.email};
}
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
 if(path==='/api/public/home'){const meta=p.publicMeta||{},todos=await listRecords(bucket);const materials=todos.filter(r=>!r.internal&&r.file&&p.publicIds.includes(r.id)).map(r=>({id:r.id,title:r.title,kind:r.kind,date:r.date||r.competence||'',category:PUBLIC_CATEGORIES.includes(meta[r.id]?.category)?meta[r.id].category:guessCategory(r),description:clip(meta[r.id]?.description,300),mime:r.file.mime,size:r.file.size}));return {info:{...DEFAULT_INFO,...(p.info||{})},notices:publicNotices(p).map(({id,title,body,date,until,pinned})=>({id,title,body,date,until,pinned:!!pinned})),materials,...publicEquipe(p),contas:publicContas(p,todos),turmas:publicTurmas(p),links:linksPara(p,'publico')}}
 if(path==='/api/public/materials')return (await listRecords(bucket)).filter(r=>!r.internal&&p.publicIds.includes(r.id)).map(({id,title,kind,date,file})=>({id,title,kind,date,hasFile:!!file}));
 if(!['admin','teacher'].includes(user.role))deny();
 if(method==='GET'){
  if(path==='/api/portal/members'){if(user.role!=='admin')deny();const c=p.credentials||{};return p.members.map(m=>({...m,hasPassword:!!c[m.email],mustChange:!!c[m.email]?.mustChange}));}
  if(path==='/api/portal/publications'){if(user.role!=='admin')deny();return {ids:p.publicIds,meta:p.publicMeta||{},records:(await listRecords(bucket)).filter(r=>!r.internal)};}
  if(path==='/api/portal/public-settings'){if(user.role!=='admin')deny();return {info:{...DEFAULT_INFO,...(p.info||{})},notices:publicNotices(p,true),meta:p.publicMeta||{},categories:PUBLIC_CATEGORIES};}
  if(path==='/api/portal/colegiados'){if(user.role!=='admin')deny();return colegiados(p);}
  if(path==='/api/portal/equipe'){if(user.role!=='admin')deny();return p.equipe||[];}
  if(path==='/api/portal/turmas'){if(user.role!=='admin')deny();return {turmas:p.turmas||{},publico:p.turmasPublico||{professor:true,vagas:true}};}
  if(path==='/api/portal/transparencia'){if(user.role!=='admin')deny();return {...(p.transparencia||{contas:[],detalhar:true}),rotulos:CONTAS_PUB};}
  if(path==='/api/portal/links')return linksPara(p,user.role);
  if(path==='/api/portal/banco-horas'){if(user.role!=='admin')deny();return bancoHoras(p);}
  if(path==='/api/portal/fotos'){if(user.role!=='admin')deny();return fotosPed(p);}
  if(path==='/api/portal/requests')return p.requests.filter(r=>user.role==='admin'||r.email===user.email);
  deny('Não encontrado.',404);
 }
 const input=await request.json(),fotosAntes=fotosReferenciadas(p),anexosAntes=anexosFotos(p);
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
  const info={phone:clip(input.phone,40),whatsapp:clip(input.whatsapp,20).replace(/\D/g,''),address:clip(input.address,240),mapa:clip(input.mapa,240),hours:clip(input.hours,300),email:clip(input.email,120),about:clip(input.about,2500),vagas:clip(input.vagas,1500)};
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
 }else if(path==='/api/portal/turmas'){
  if(user.role!=='admin')deny();p.turmas=p.turmas&&typeof p.turmas==='object'?p.turmas:{};
  if(input.publico)p.turmasPublico={professor:input.publico.professor!==false,vagas:input.publico.vagas!==false};
  if(input.ano!==undefined){const ano=Number(input.ano);if(input.delete===true)delete p.turmas[ano];else p.turmas[ano]=cleanTurmas(ano,input.turmas)}
 }else if(path==='/api/portal/banco-horas'){
  if(user.role!=='admin')deny();const b=p.bancoHoras=bancoHoras(p);
  if(input.escala){const e=input.escala;if(!(p.equipe||[]).some(x=>x.id===e.pessoaId))deny('Pessoa não encontrada na equipe.',400);
   const ent=String(e.entrada||'').trim(),sai=String(e.saida||'').trim();if((ent&&!HM.test(ent))||(sai&&!HM.test(sai)))deny('Horário da escala inválido.',400);
   if(ent&&sai&&hmMin(sai)<=hmMin(ent))deny('Na escala, a saída deve ser depois da entrada.',400);
   if(!ent&&!sai)delete b.escalas[e.pessoaId];else b.escalas[e.pessoaId]={entrada:ent,saida:sai,obs:clip(e.obs,120)}}
  else if(input.delete===true)b.registros=b.registros.filter(r=>r.id!==input.id);
  else{const old=b.registros.find(r=>r.id===input.registro?.id);if(input.registro?.id&&!old)deny('Registro não encontrado. Recarregue a página.',404);
   const reg=cleanRegistroBanco(input.registro||{},old,p,user);b.registros=b.registros.filter(r=>r.id!==reg.id);b.registros.push(reg)}
  if(b.registros.length>20000)deny('Limite de registros do banco de horas atingido.',400);
 }else if(path==='/api/portal/fotos'){
  if(user.role!=='admin')deny();const f=p.fotos=fotosPed(p);
  if(input.excluirEvento){if(f.pedidos.some(o=>o.eventoId===input.excluirEvento))deny('Há pedidos neste evento. Encerre o evento em vez de excluir.',400);f.eventos=f.eventos.filter(e=>e.id!==input.excluirEvento)}
  else if(input.evento){const old=f.eventos.find(e=>e.id===input.evento.id);if(input.evento.id&&!old)deny('Evento não encontrado. Recarregue a página.',404);
   const ev=cleanEventoFoto(input.evento,old,user);f.eventos=f.eventos.filter(e=>e.id!==ev.id);f.eventos.push(ev);
   for(const o of f.pedidos)if(o.eventoId===ev.id)o.eventoNome=ev.nome}
  else if(input.delete===true)f.pedidos=f.pedidos.filter(o=>o.id!==input.id);
  else{const old=f.pedidos.find(o=>o.id===input.pedido?.id);if(input.pedido?.id&&!old)deny('Pedido não encontrado. Recarregue a página.',404);
   const ped=cleanPedidoFoto(input.pedido||{},old,p,user),antes=new Set((old?.anexos||[]).map(a=>a.id));
   for(const a of ped.anexos)if(!antes.has(a.id)&&!await bucket.get('cei/pedidos-fotos/'+a.id))deny('Um anexo não foi enviado. Anexe o arquivo de novo.',400);
   f.pedidos=f.pedidos.filter(o=>o.id!==ped.id);f.pedidos.push(ped)}
  if(f.pedidos.length>5000)deny('Limite de 5000 pedidos atingido. Exclua pedidos antigos.',400);if(f.eventos.length>100)deny('Limite de 100 eventos atingido.',400);
 }else if(path==='/api/portal/links'){
  if(user.role!=='admin')deny();p.links=Array.isArray(p.links)?p.links:[];
  if(input.delete===true)p.links=p.links.filter(l=>l.id!==input.id);
  else if(Array.isArray(input.ordem)){input.ordem.forEach((id,i)=>{const l=p.links.find(x=>x.id===id);if(l)l.ordem=i})}
  else{const old=p.links.find(l=>l.id===input.link?.id);if(input.link?.id&&!old)deny('Link não encontrado. Recarregue a página.',404);const link=cleanLink(input.link||{},old,user);
   if(!old)link.ordem=p.links.reduce((m,l)=>Math.max(m,(l.ordem??0)+1),0);
   p.links=p.links.filter(l=>l.id!==link.id);p.links.push(link)}
  if(p.links.length>120)deny('Limite de 120 links. Exclua os que não usa mais.',400);
 }else if(path==='/api/portal/transparencia'){
  if(user.role!=='admin')deny();p.transparencia=cleanTransparencia(input);
 }else if(path==='/api/portal/equipe'){
  if(user.role!=='admin')deny();p.equipe=Array.isArray(p.equipe)?p.equipe:[];
  if(input.delete===true)p.equipe=p.equipe.filter(e=>e.id!==input.id);
  else if(Array.isArray(input.importar)){if(input.importar.length>300)deny('Importe no máximo 300 pessoas por vez.',400);const base=p.equipe.length;const novos=input.importar.map((x,i)=>cleanPessoa({...x,ordem:x.ordem??base+i},null,user));const ja=new Set(p.equipe.map(e=>normNome(e.nome)));p.equipe.push(...novos.filter(n=>!ja.has(normNome(n.nome))))}
  else if(Array.isArray(input.ordem)){input.ordem.forEach((id,i)=>{const e=p.equipe.find(x=>x.id===id);if(e)e.ordem=i})}
  else{const old=p.equipe.find(e=>e.id===input.pessoa?.id),pessoa=cleanPessoa(input.pessoa||{},old,user);p.equipe=p.equipe.filter(e=>e.id!==pessoa.id);p.equipe.push(pessoa)}
  if(p.equipe.length>300)deny('Limite de 300 pessoas na equipe.',400);
 }else if(path==='/api/portal/colegiados'){
  if(user.role!=='admin')deny();
  const orgao=input.orgao;if(!ORGAOS.includes(orgao))deny('Órgão inválido.',400);
  const all=p.colegiados=colegiados(p);
  if(input.delete===true){all[orgao]=all[orgao].filter(c=>c.id!==input.id)}
  else{const old=all[orgao].find(c=>c.id===input.chapa?.id),chapa=cleanChapa(input.chapa||{},old,user);
   all[orgao]=all[orgao].filter(c=>c.id!==chapa.id);all[orgao].push(chapa);
   if(all[orgao].length>100)deny('Limite de 100 composições atingido. Exclua registros antigos.',400)}
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
 data.portal=p;data.savedAt=new Date().toISOString();await bucket.put(KEY,JSON.stringify(data));
 // Fotos que deixaram de ser usadas são apagadas (só as que estavam em uso antes desta gravação).
 const depois=fotosReferenciadas(p);for(const id of fotosAntes)if(!depois.has(id))await bucket.delete('cei/fotos/'+id);
 const anexosDepois=anexosFotos(p);for(const id of anexosAntes)if(!anexosDepois.has(id))await bucket.delete('cei/pedidos-fotos/'+id);
 return {ok:true};
}
