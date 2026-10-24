import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
// Persistent single-process Node adapter; each object commits with atomic rename.
export class DiskBucket {
 constructor(directory){this.directory=path.resolve(directory);this.queue=Promise.resolve()}
 filename(key){return path.join(this.directory,createHash('sha256').update(key).digest('hex')+'.json')}
 async entry(key){try{return JSON.parse(await fs.readFile(this.filename(key),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
 async get(key){const e=await this.entry(key);if(!e)return null;const bytes=Buffer.from(e.base64,'base64');return {key,etag:e.etag,size:bytes.length,httpMetadata:e.httpMetadata,customMetadata:e.customMetadata,text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),body:new Blob([bytes]).stream()}}
 async put(key,value,options={}){const run=async()=>{const old=await this.entry(key);if(options.onlyIf instanceof Headers&&options.onlyIf.get('If-None-Match')==='*'&&old)return null;if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;const bytes=typeof value==='string'?Buffer.from(value):Buffer.from(await new Response(value).arrayBuffer()),etag=createHash('md5').update(bytes).digest('hex'),entry={key,etag,base64:bytes.toString('base64'),httpMetadata:options.httpMetadata,customMetadata:options.customMetadata};await fs.mkdir(this.directory,{recursive:true});const temp=this.filename(key)+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(entry));await fs.rename(temp,this.filename(key));return {etag}};const result=this.queue.then(run);this.queue=result.catch(()=>{});return result}
 async delete(key){await fs.rm(this.filename(key),{force:true})}
 async list({prefix='',cursor,limit=1000}={}){await fs.mkdir(this.directory,{recursive:true});const objects=[];for(const name of await fs.readdir(this.directory)){if(!name.endsWith('.json'))continue;const e=JSON.parse(await fs.readFile(path.join(this.directory,name),'utf8'));if(e.key.startsWith(prefix)&&(!cursor||e.key>cursor))objects.push({key:e.key,etag:e.etag,size:Buffer.byteLength(e.base64,'base64')})}objects.sort((a,b)=>a.key.localeCompare(b.key));const page=objects.slice(0,limit);return {objects:page,truncated:objects.length>limit,cursor:page.at(-1)?.key}}
}
