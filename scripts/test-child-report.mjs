import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const c={Intl,Date,structuredClone,location:{origin:'https://example.test'},state:{generatedDocs:[]},documentTemplates:{},uid:()=> 'test-report',esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),formatDate:s=>s.split('-').reverse().join('/'),sharedQueue:Promise.resolve(),sharedActive:true,localStorage:{getItem:()=>null},writeDataFile:async()=>{},notify(){},alert:s=>{throw Error(s)},confirm:()=>true,document:{body:{insertAdjacentHTML(){}},getElementById:id=>id==='childReportForm'?{reportValidity:()=>true}:id==='childReportStatus'?{}:null,querySelectorAll:()=>[]}};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('dist/child-report.js','utf8'),c);
assert.equal(c.childReportDefaults().child,'');assert.equal(c.childReportDefaults().professionals.length,1);
const d={...c.childReportDefaults(),child:'Criança de teste',className:'Pré II',year:'2026',period:'Ano letivo',bodyHtml:'<h2>Aprendizagem</h2><p>Observação <strong>pedagógica</strong>.</p>',professionals:[{name:'Responsável A',role:'Professor(a)'},{name:'Responsável B',role:'Coordenação'}]};
c.testData=d;vm.runInContext('childReportDraft={id:"test-report",data:testData};readChildReport=()=>testData;reportHTMLText=s=>s.replace(/<[^>]*>/g,"")',c);
await c.saveChildReport(false);const first=c.state.generatedDocs[0];d.bodyHtml+='<p>Atualização.</p>';await c.saveChildReport(false);
assert.equal(c.state.generatedDocs.length,1);assert.equal(c.state.generatedDocs[0].createdAt,first.createdAt);assert.equal(c.state.generatedDocs[0].data.date,first.data.date);assert.equal(c.state.generatedDocs[0].data.professionals.length,2);assert.match(c.state.generatedDocs[0].data.bodyHtml,/<strong>pedagógica<\/strong>/);
assert.equal(c.childReportDate('2026-10-21'),'21 de outubro de 2026');
// Print generation tests use an identity sanitizer; paste sanitization is checked in browser QA.
vm.runInContext('reportSanitize=s=>s',c);const html=c.childReportPrintHTML(d);assert.match(html,/<\/script>/);assert.match(html,/report-signature-row/);assert.match(html,/Responsável B/);assert.match(html,/Ano letivo/);assert.match(c.childReportPrintHTML({...d,title:'<img src=x>'}),/&lt;img src=x&gt;/);
const legacy=c.reportNormalize({text:'Texto antigo\n\nSegundo parágrafo'});assert.match(legacy.bodyHtml,/<p>Texto antigo<\/p>/);
console.log('Passed: formatted body and multiple authors persist, updates preserve ID/date, legacy text retained, print markup/date/title escaping.');
