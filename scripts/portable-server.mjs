// Portable Node 22+ host. Use a persistent DATA_DIR and one server process.
// Set PUBLIC_ORIGIN to the external HTTPS URL; PORT defaults to 3000.
import http from 'node:http';
import {Readable} from 'node:stream';
import worker from '../dist/server/index.js';
import {DiskBucket} from './disk-bucket.mjs';
const port=Number(process.env.PORT||3000);
const origin=process.env.PUBLIC_ORIGIN||'http://localhost:'+port;
// v42: login com e-mail e senha (CEI_BOOTSTRAP_ADMIN_EMAIL + ADMIN_SENHA_INICIAL para o primeiro acesso). Use HTTPS.
const env={BUCKET:new DiskBucket(process.env.DATA_DIR||'./data'),AUTH_PROVIDER:'senha',CEI_BOOTSTRAP_ADMIN_EMAIL:process.env.CEI_BOOTSTRAP_ADMIN_EMAIL,ADMIN_SENHA_INICIAL:process.env.ADMIN_SENHA_INICIAL,PBKDF2_ITERATIONS:process.env.PBKDF2_ITERATIONS};
http.createServer(async(req,res)=>{try{const headers=new Headers();for(const [name,value] of Object.entries(req.headers)){if(name.toLowerCase().startsWith('oai-')||name.toLowerCase().startsWith('x-oai-'))continue;if(Array.isArray(value))value.forEach(x=>headers.append(name,x));else if(value)headers.set(name,value)}const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const response=await worker.fetch(request,env,{waitUntil:promise=>promise.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD'||!response.body)res.end();else Readable.fromWeb(response.body).pipe(res)}catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Não foi possível acessar os dados da hospedagem.'}))}}).listen(port,()=>console.log('CEI Admin disponível em '+origin));
