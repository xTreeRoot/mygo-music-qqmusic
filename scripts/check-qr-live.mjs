// Prepare official QR codes and cancel immediately; no account is authorized or persisted.
import {createHash} from 'node:crypto';
import * as plugin from '../dist/index.js';
const network=globalThis.fetch;
globalThis.fetch=(url,options={})=>network(url,{...options,signal:AbortSignal.any([options.signal,AbortSignal.timeout(15000)].filter(Boolean))});
let failed=0;
for(const method of ['qq','wechat']){
 const saved=new Map();let ready=false;
 globalThis.host={platform:'android',t:x=>x,setting:()=>method,storage:{get:k=>saved.get(k),set:(k,v)=>saved.set(k,v)},crypto:{md5:x=>createHash('md5').update(x).digest('hex')},signInPrompt:p=>{if(p.qr){ready=true;queueMicrotask(()=>plugin.cancelSignIn());}}};
 try{await plugin.signIn();throw Error('Unexpected login');}catch(e){if(ready&&/canceled/.test(e.message))console.log('PASS',method,'official QR preparation and cancellation; no account authorized');else{failed++;console.log('FAIL',method,e.message.replace(/https?:\/\/\S+/g,'[URL]'));}}
}
process.exitCode=failed?1:0;
