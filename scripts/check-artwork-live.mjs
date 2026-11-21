// Anonymous read-only check of actual image bytes returned by public QQ Music pages.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const network=globalThis.fetch;
globalThis.fetch=(url,options={})=>network(url,{...options,signal:AbortSignal.any([options.signal,AbortSignal.timeout(15000)].filter(Boolean))});
globalThis.host={t:v=>v,setting:()=>'',storage:{get:()=>null,set:()=>{}}};
const plugin=await import('../dist/index.js');
const manifest=JSON.parse(await readFile(new URL('../dist/plugin.json',import.meta.url),'utf8'));
const artwork=[];
function collect(value){
 if(!value||typeof value!=='object')return;
 for(const [key,item] of Object.entries(value)){
  if(key==='imageUrl'&&item)artwork.push(item);
  else if(typeof item==='object')collect(item);
 }
}
collect(await plugin.home());
for(const kind of ['tracks','albums','artists','playlists'])collect(await plugin.search({query:'周杰伦',kind}));
const urls=[...new Set(artwork)];assert.ok(urls.length>20);
let next=0,verified=0;const failures=[];
await Promise.all(Array.from({length:4},async()=>{
 while(next<urls.length){
  const address=urls[next++];
  try{
   const url=new URL(address);assert.equal(url.protocol,'https:');
   const rule=manifest.requestHeaders.find(r=>r.kinds.includes('image')&&r.hosts.includes(url.hostname));
   assert.ok(rule,'Missing image headers for '+url.hostname);
   const response=await fetch(address,{headers:rule.headers});assert.equal(response.status,200);
   assert.ok(response.headers.get('content-type')?.startsWith('image/'));
   const reader=response.body.getReader();const {value}=await reader.read();await reader.cancel();
   assert.ok(value?.length>64);assert.ok(value[0]===255&&value[1]===216||value[0]===137&&value[1]===80||Buffer.from(value.subarray(0,4)).toString()==='RIFF');
   verified++;
  }catch(error){failures.push({host:new URL(address).hostname,path:new URL(address).pathname,message:error.message.replace(/https?:\/\/\S+/g,'[URL]')});}
 }
}));
console.log('Public artwork references:',artwork.length,'unique HTTPS images:',urls.length,'actual image-byte checks passed:',verified);
for(const failure of failures)console.log('FAIL',failure.host,failure.path,failure.message);
assert.equal(failures.length,0);
