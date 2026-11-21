// Verify provider selection through complete source and shipping-bundle login flows.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import QRCode from 'qrcode';

const authKey='qqmusic.auth.v1',activeKey='qqmusic.active.v1';
const png=await QRCode.toBuffer('https://example.com/fixture-qr');
const session=loginType=>({musicid:'11111',musickey:'old-fixture',loginType});
const profile=()=>Response.json({code:0,req_0:{code:0,data:{info:{nick:'Fixture'}}}});
function fixture(plugin,method,previous,{cancel=false,rejectProfile=false,configured=method}={}){
 const storage=new Map([[authKey,previous],[activeKey,false]]),calls=[],prompts=[];
 const original=globalThis.fetch;
 globalThis.host={t:v=>v,platform:'android',setting:()=>configured,
  crypto:{md5:v=>createHash('md5').update(v).digest('hex')},
  storage:{get:k=>storage.get(k),set:(k,v)=>storage.set(k,v)},
  signInPrompt:p=>{prompts.push(p);if(p.qr&&cancel)queueMicrotask(()=>plugin.cancelSignIn());}};
 globalThis.fetch=async(address,options={})=>{
  const url=new URL(address);calls.push({url,options});
  if(url.pathname.endsWith('/ptqrshow'))return new Response(png,{headers:{'set-cookie':'qrsig='+'a'.repeat(80)+'; Domain=.ptlogin2.qq.com; Path=/; Secure'}});
  if(url.pathname.endsWith('/ptqrlogin'))return new Response("ptuiCB('0','0','https://ssl.ptlogin2.graph.qq.com/check_sig?x=1','0','ok','fixture');");
  if(url.pathname==='/check_sig'){const headers=new Headers({location:'https://graph.qq.com/oauth2.0/login_jump'});for(const cookie of ['p_uin=o123','p_skey=fixture','pt_oauth_token=fixture'])headers.append('set-cookie',cookie+'; Domain=.graph.qq.com');return new Response('',{status:302,headers});}
  if(url.pathname==='/oauth2.0/login_jump')return new Response('');
  if(url.pathname==='/oauth2.0/authorize'){
   const form=new URLSearchParams(options.body);
   return new Response('',{status:302,headers:{location:'https://y.qq.com/portal/wx_redirect.html?code=ABCDEF0123456789ABCDEF0123456789&state='+encodeURIComponent(form.get('state'))}});
  }
  if(url.hostname==='api.tencentmusic.com')return Response.json({data:{data:{q16:'qimei',q36:'qimei36'}}});
  if(url.pathname.startsWith('/connect/qrcode/'))return new Response(png);
  if(url.pathname==='/connect/l/qrconnect')return new Response("window.wx_errcode=405;window.wx_code='fixture';");
  if(url.pathname==='/connect/qrconnect')return new Response('<img src="/connect/qrcode/fixture">');
  const body=JSON.parse(options.body),request=body.req||body.req_0;
  if(request.method==='GetSession')return Response.json({code:0,req_0:{code:0,data:{session:{uid:'fixture',sid:'fixture'}}}});
  if(['Login','QQLogin'].includes(request.method))return Response.json({code:0,req:{code:0,data:{musicid:'22222',musickey:'new-fixture',loginType:method==='qq'?2:1}}});
  if(request.method==='GetLoginUserInfo')return rejectProfile?Response.json({code:0,req_0:{code:104401}}):profile();
  throw Error('Unexpected request '+url.hostname+url.pathname);
 };
 return {storage,calls,prompts,close:()=>{plugin.cancelSignIn();globalThis.fetch=original;}};
}
for(const entry of ['./index.js','./dist/index.js']){
 const plugin=await import(entry);
 for(const method of ['qq','wechat']){
  const type=method==='qq'?2:1;
  test(`${entry}: switching to ${method} reaches its QR and validates before replacing the old account`,async()=>{
   const f=fixture(plugin,method,session(type===1?2:1));
   try{
    const result=await plugin.signIn();assert.equal(result.id,'22222');
    assert.equal(f.storage.get(authKey).loginType,type);assert.equal(f.storage.get(activeKey),true);
    assert.ok(f.prompts.some(p=>p.qr&&p.text.includes(method==='qq'?'QQ':'微信')));
    const profiles=f.calls.filter(c=>c.url.hostname==='u.y.qq.com'&&c.options.body&&JSON.parse(c.options.body).req_0?.method==='GetLoginUserInfo');
    assert.equal(profiles.length,1);assert.equal(JSON.parse(profiles[0].options.body).comm.qq,'22222');
   }finally{f.close();}
  });
  for(const failure of ['cancel','rejectProfile'])test(`${entry}: ${method} ${failure} preserves the previous provider credential`,async()=>{
   const previous=session(type===1?2:1),f=fixture(plugin,method,previous,{[failure]:true});
   try{
    await assert.rejects(plugin.signIn());assert.ok(f.prompts.some(p=>p.qr));
    assert.deepEqual(f.storage.get(authKey),previous);assert.equal(f.storage.get(activeKey),false);
   }finally{f.close();}
  });
 }
 for(const method of ['qq','wechat'])test(`${entry}: explicit login selection overrides the legacy configured provider`,async()=>{
  const type=method==='qq'?2:1;
  const f=fixture(plugin,method,session(type===1?2:1),{configured:method==='qq'?'wechat':'qq'});
  try{assert.equal((await plugin.signIn({method})).id,'22222');assert.equal(f.storage.get(authKey).loginType,type);assert.ok(f.prompts.some(p=>p.qr));}
  finally{f.close();}
 });
 for(const [method,type] of [['qq',2],['QQ',2],['wechat',1],['wx',1],['微信',1],['',1]])test(`${entry}: ${method||'unset'} validates and reuses only the matching saved provider`,async()=>{
  const previous=session(type),f=fixture(plugin,method,previous);
  try{
   assert.equal((await plugin.signIn()).id,previous.musicid);
   assert.equal(f.prompts.length,0);assert.equal(f.calls.length,1);assert.equal(f.storage.get(activeKey),true);
  }finally{f.close();}
 });
}
