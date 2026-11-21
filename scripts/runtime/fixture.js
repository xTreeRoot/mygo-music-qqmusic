const saved=new Map();
globalThis.host={platform:'darwin',setting:()=>'',t:s=>s,signInPrompt:()=>{throw Error('Unexpected QR')},storage:{get:k=>saved.get(k),set:(k,v)=>saved.set(k,v),remove:k=>saved.delete(k)}};
saved.set('qqmusic.auth.v1',{musicid:'1152921504606846976',musickey:'W_fixture',loginType:1});
globalThis.fetch=async(url,options={})=>{
 if(String(url).includes('/lyric/'))return new Response(JSON.stringify({code:0,lyric:'WzAwOjAxLjAwXeS4reaWh+atjOivjfCfjrU=',trans:'WzAwOjAxLjAwXeS4reaWh+atjOivjfCfjrU='}));
 const req=JSON.parse(options.body).req_0;let data;
 if(req.method==='GetPlayLyricInfo')data={};
 else if(req.method==='GetLoginUserInfo')data={info:{nick:'Fixture'}};
 else if(req.method==='DoSearchForQQMusicDesktop')data={body:{song:{list:[{mid:'song'+req.param.page_num,title:'歌曲',interval:123}]}},meta:{sum:40}};
 else if(req.method==='get_song_detail_yqq')data={track_info:{mid:req.param.song_mid,file:{media_mid:'media'}}};
 else if(req.method==='UrlGetVkey')data={sip:['https://isure.stream.qqmusic.qq.com/'],midurlinfo:[{songmid:'song1',purl:'fixture.mp3'}]};
 else throw Error('Unexpected '+req.method);
 return new Response(JSON.stringify({code:0,req_0:{code:0,data}}));
};
