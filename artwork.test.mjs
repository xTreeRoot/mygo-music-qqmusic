// Exercise artwork returned by public, account and search handlers on both entry points.
import {test} from 'node:test';
import assert from 'node:assert/strict';
const raw='http://qpic.y.qq.com/music_cover/fixture/300?n=1';
const secure=raw.replace('http:','https:');
const trackOf=t=>({id:t.mid});
for(const entry of ['./index.js','./dist/index.js']){
 const plugin=await import(entry);
 test(`${entry}: public playlists, charts, details and search normalize HTTP/protocol-relative artwork`,async()=>{
  const api=plugin.createBrowse({trackOf,cgi:async()=>({cdlist:[{logo:raw,songlist:[{mid:'song'}]}]}),rpc:async(_module,method)=>{
   if(method==='GetRecommendFeed')return {List:[{Playlist:{basic:{tid:1,cover:{default_url:raw}}}},{Playlist:{basic:{tid:2,cover:{default_url:'//music-file.y.qq.com/cover.jpg?size=300'}}}}]};
   if(method==='GetAll')return {group:[{toplist:[{topId:1,recType:10005,headPicUrl:raw}]}]};
   if(method==='GetDetail')return {data:{recType:10005,headPicUrl:raw},songInfoList:[{mid:'song'}]};
   return {body:{songlist:{list:[{dissid:1,imgurl:raw}]}},meta:{sum:1}};
  }});
  const page=await api.home();
  assert.equal(page.sections[0].playlists[0].imageUrl,secure);
  assert.equal(page.sections[0].playlists[1].imageUrl,'https://music-file.y.qq.com/cover.jpg?size=300');
  assert.equal(page.sections[1].playlists[0].imageUrl,secure);
  assert.equal((await api.playlist({id:'chart:1'})).imageUrl,secure);
  assert.equal((await api.playlist({id:'1'})).imageUrl,secure);
  assert.equal((await api.searchPlaylists({query:'fixture'})).playlists[0].imageUrl,secure);
 });
 test(`${entry}: library playlists and saved albums normalize server artwork`,async()=>{
  const signed={musicid:'12345',musickey:'fixture',loginType:2,encryptUin:'fixture'};
  const library=plugin.createLibrary({trackOf,qqReadSession:()=>signed,
   qqAuthCgi:async()=>({data:{totalalbum:1,albumlist:[{albummid:'AlbumMID',picurl:raw}]}}),
   qqAuthRpc:async(_module,method)=>method==='GetPlaylistByUin'?{v_playlist:[{tid:1,dirId:12,bigpicUrl:raw}]}:{v_list:[{tid:2,logo:raw}],hasmore:0}});
  const playlists=await library.playlists();assert.ok(playlists.length>=2);
  for(const item of playlists)assert.equal(item.imageUrl,secure);
  assert.equal((await library.savedAlbums({})).albums[0].imageUrl,secure);
 });
 test(`${entry}: tracks/albums use explicit artwork and safely fall back for invalid server values`,async()=>{
  globalThis.host={t:v=>v,storage:{get:()=>null,set:()=>{}},setting:()=>''};
  const original=globalThis.fetch;
  let cover=raw;
  globalThis.fetch=async(_url,options)=>{
   const param=JSON.parse(options.body).req_0.param;
   const album={mid:'AlbumMID',name:'Album',albumPic:cover};
   const body=param.search_type===0?{song:{list:[{mid:'song',album}]}}:param.search_type===1?{singer:{list:[{singerMID:'SingerMID',singerName:'Singer',singerPic:cover}]}}:{album:{list:[album]}};
   return Response.json({code:0,req_0:{code:0,data:{body,meta:{sum:1}}}});
  };
  try{
   assert.equal((await plugin.search({query:'fixture',kind:'tracks'})).tracks[0].album.imageUrl,secure);
   assert.equal((await plugin.search({query:'fixture',kind:'albums'})).albums[0].imageUrl,secure);
   assert.equal((await plugin.search({query:'fixture',kind:'artists'})).artists[0].imageUrl,secure);
   for(const invalid of ['javascript:alert(1)','https://user:password@qpic.y.qq.com/a.jpg','not a URL']){
    cover=invalid;assert.equal((await plugin.search({query:'fixture',kind:'albums'})).albums[0].imageUrl,'https://y.gtimg.cn/music/photo_new/T002R300x300M000AlbumMID.jpg');
    assert.equal((await plugin.search({query:'fixture',kind:'artists'})).artists[0].imageUrl,'https://y.gtimg.cn/music/photo_new/T001R300x300M000SingerMID.jpg');
   }
  }finally{globalThis.fetch=original;}
 });
}
