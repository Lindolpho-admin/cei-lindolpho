// v46: enturmação pela data de nascimento (corte 31/03), conferida com a tabela oficial de 2026 e com a virada de ano.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile('dist/central.js','utf8');const win={CEI_SESSION:{role:'admin',email:'a@x.org'}};
const ctx=vm.createContext({window:win,state:{},titles:{},render(){},document:{readyState:'complete',addEventListener(){},getElementById:()=>null,querySelectorAll:()=>[]},setTimeout(){},Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,crypto:globalThis.crypto,localStorage:{getItem:()=>null}});
vm.runInContext(source,ctx);const ent=win.cxEnturmar,turma=(iso,ano)=>{const r=ent(iso,ano);return r.tipo==='cei'?r.turma.nome:r.tipo};
// Tabela de Enturmação 2026 (enviada pela direção)
const t2026=[['Maternal','2023-04-01','2024-03-31'],['Jardim','2022-04-01','2023-03-31'],['Pré I','2021-04-01','2022-03-31'],['Pré II','2020-04-01','2021-03-31']];
for(const [nome,de,ate] of t2026){assert.equal(turma(de,2026),nome,de);assert.equal(turma(ate,2026),nome,ate);}
assert.equal(turma('2024-04-01',2026),'novo');assert.equal(ent('2024-04-01',2026).entra,2027);
assert.equal(turma('2020-03-31',2026),'fundamental');
// Virada de ano: a faixa de hoje do Maternal vai para o Jardim, e assim por diante
for(const [nome,de,ate] of t2026){const next={Maternal:'Jardim',Jardim:'Pré I','Pré I':'Pré II','Pré II':'fundamental'}[nome];assert.equal(turma(de,2027),next);assert.equal(turma(ate,2027),next);}
assert.equal(turma('2024-04-01',2027),'Maternal');assert.equal(turma('2025-03-31',2027),'Maternal');assert.equal(turma('2025-04-01',2027),'novo');
// Vale para qualquer ano futuro
for(let ano=2026;ano<=2040;ano++){assert.equal(turma(`${ano-3}-04-01`,ano),'Maternal');assert.equal(turma(`${ano-2}-03-31`,ano),'Maternal');assert.equal(turma(`${ano-6}-04-01`,ano),'Pré II');assert.equal(turma(`${ano-6}-03-31`,ano),'fundamental');}
// 29 de fevereiro e virada de mês
assert.equal(turma('2024-02-29',2026),'Maternal');assert.equal(turma('2024-03-31',2026),'Maternal');assert.equal(turma('2024-04-01',2026),'novo');
console.log('PASS: enturmação idêntica à Tabela 2026 em todas as datas-limite, avanço automático na virada de ano (2027 e até 2040), crianças abaixo da idade com ano de entrada e acima da idade (Ensino Fundamental).');
