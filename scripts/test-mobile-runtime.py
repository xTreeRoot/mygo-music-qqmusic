# Read-only host snapshots; native libraries and synthetic account state stay in a temporary directory.
import argparse,base64,ctypes,hashlib,json,pathlib,re,subprocess,tempfile,urllib.parse
parser=argparse.ArgumentParser(description='Run the release bundle in MB iOS/Android native QuickJS without touching apps or devices.')
parser.add_argument('--mb',required=True,type=pathlib.Path,help='Read-only local MB repository containing the shared main sources')
parser.add_argument('--ref',default='main',help='Verified shared MB source revision')
options=parser.parse_args()
plugin=pathlib.Path(__file__).resolve().parent.parent
workspace=tempfile.TemporaryDirectory(prefix='qqmusic-native-')
root=pathlib.Path(workspace.name)
subprocess.run(['node','--input-type=module','-e',"import QRCode from 'qrcode'; import {writeFileSync} from 'node:fs'; writeFileSync(process.argv[1],await QRCode.toBuffer('https://open.weixin.qq.com/connect/confirm?uuid=fixture'));",str(root/'login.png')],cwd=plugin,check=True)
png=(root/'login.png').read_bytes()
for platform in ['ios','android']:
 paths=subprocess.check_output(['git','ls-tree','-r','--name-only',options.ref,'ios/Sources/MBJavaScript'],cwd=options.mb,text=True).splitlines()
 paths+=['ios/Sources/MBFoundation/Resources/PluginBootstrap.js']
 for name in paths:
  target=root/'runtime'/platform/name
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_bytes(subprocess.check_output(['git','show',options.ref+':'+name],cwd=options.mb))
 directory=root/'runtime'/platform/'ios/Sources/MBJavaScript'
 command=['clang','-shared','-fPIC','-O2','-DCONFIG_VERSION="2026-06-04"','-I'+str(directory/'include'),str(directory/'MBJavaScript.c')]+[str(directory/'vendor'/name) for name in ['quickjs.c','dtoa.c','libregexp.c','libunicode.c','cutils.c']]+['-o',str(root/'runtime'/(platform+'.dylib'))]
 subprocess.run(command,check=True,capture_output=True)
 print('Snapshot',platform,subprocess.check_output(['git','rev-parse',options.ref],cwd=options.mb,text=True).strip())
lyric='[00:01.00]中文歌词🎵'
large_qrc=re.search(r"const qingtian = '([0-9A-F]+)'",(plugin/'qrc.test.mjs').read_text()).group(1)
qrc=re.search(r"const lrc = '([0-9A-F]+)'",(plugin/'qrc.test.mjs').read_text()).group(1)
class Runtime:
 def __init__(self,platform):
  self.lib=ctypes.CDLL(str(root/'runtime'/(platform+'.dylib')))
  self.storage={};self.prompts=[];self.polls=0;self.requests=[];self.method='wechat'
  self.callback=ctypes.CFUNCTYPE(ctypes.c_void_p,ctypes.c_void_p,ctypes.c_char_p,ctypes.c_char_p)(self.host)
  self.lib.mbjs_create.argtypes=[type(self.callback),ctypes.c_void_p,ctypes.c_size_t];self.lib.mbjs_create.restype=ctypes.c_void_p
  self.lib.mbjs_evaluate.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_char_p,ctypes.c_int,ctypes.c_int]
  self.lib.mbjs_start.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_char_p,ctypes.c_int]
  self.lib.mbjs_settle.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_char_p,ctypes.c_int]
  for name in ['mbjs_take_event','mbjs_result']:
   getattr(self.lib,name).argtypes=[ctypes.c_void_p];getattr(self.lib,name).restype=ctypes.c_void_p
  self.lib.mbjs_free_string.argtypes=[ctypes.c_void_p];self.lib.mbjs_destroy.argtypes=[ctypes.c_void_p]
  self.libc=ctypes.CDLL(None);self.libc.strdup.argtypes=[ctypes.c_char_p];self.libc.strdup.restype=ctypes.c_void_p
  self.pointer=self.lib.mbjs_create(self.callback,None,256<<20)
  bootstrap=(root/'runtime'/platform/'ios/Sources/MBFoundation/Resources/PluginBootstrap.js').read_text()
  if platform=='android':bootstrap=bootstrap.replace('platform: "ios", arch: "arm64"','platform: "android", arch: "arm64", capabilities: Object.freeze({ webSignInHTML: true }), oauthSignIn: options => request({ kind: "oauthSignIn", options })')
  self.finish(self.lib.mbjs_evaluate(self.pointer,bootstrap.encode(),b'host.js',0,100))
  self.finish(self.lib.mbjs_evaluate(self.pointer,(plugin/'dist/index.js').read_bytes(),b'plugin.js',1,500))
 def text(self,name):
  ptr=getattr(self.lib,name)(self.pointer)
  if not ptr:return None
  value=ctypes.string_at(ptr).decode();self.lib.mbjs_free_string(ptr);return value
 def host(self,_opaque,operation,arguments):
  try:
   op=operation.decode();a=json.loads(arguments)
   if op=='storage.get':v=self.storage.get(a[0])
   elif op=='storage.set':self.storage[a[0]]=a[1];v=None
   elif op=='storage.remove':self.storage.pop(a[0],None);v=None
   elif op=='t':v=a[0]
   elif op=='setting':v=self.method
   elif op=='language':v='zh-CN'
   elif op=='console':v=None
   elif op=='prompt':self.prompts.append(a[0]);v=None
   elif op=='md5':v=hashlib.md5(a[0].encode()).hexdigest()
   elif op=='base64.decode':v=base64.b64decode(a[0]).decode('latin1')
   elif op=='base64.encode':v=base64.b64encode(a[0].encode('latin1')).decode()
   elif op=='url':
    u=urllib.parse.urlsplit(urllib.parse.urljoin(a[1],a[0]) if len(a)>1 else a[0]);v={'href':u.geturl(),'protocol':u.scheme+':','host':u.netloc,'hostname':u.hostname or '', 'pathname':u.path or '/', 'search':'?'+u.query if u.query else '', 'hash':'#'+u.fragment if u.fragment else ''}
   else:raise ValueError('Unexpected operation '+op)
   out={'value':v}
  except Exception as e:out={'error':str(e)}
  return self.libc.strdup(json.dumps(out,ensure_ascii=False).encode())
 def response(self,event):
  address=event['url'];self.requests.append(event)
  headers={};cookies=[];data=None;raw=None;status=200
  if '/ptqrshow' in address:raw=png;cookies=['qrsig='+80*'a'+'; Domain=.ptlogin2.qq.com; Path=/; Secure']
  elif '/ptqrlogin' in address:raw=b"ptuiCB('0','0','https://ssl.ptlogin2.graph.qq.com/check_sig?x=1','0','ok','fixture');"
  elif '/check_sig' in address:
   status=302;raw=b'';headers={'location':'https://graph.qq.com/oauth2.0/login_jump'};cookies=[v+'; Domain=.graph.qq.com; Path=/' for v in ['p_uin=o123','p_skey=fixture','pt_oauth_token=fixture']]
  elif '/oauth2.0/login_jump' in address:raw=b''
  elif '/oauth2.0/authorize' in address:
   state=urllib.parse.parse_qs(event['body'])['state'][0];status=302;raw=b'';headers={'location':'https://y.qq.com/portal/wx_redirect.html?code=ABCDEF0123456789ABCDEF0123456789&state='+urllib.parse.quote(state)}
  elif 'api.tencentmusic.com' in address:data={'data':{'data':{'q16':'qimei','q36':'qimei36'}}}
  elif '/connect/qrcode/' in address:raw=png
  elif '/connect/l/qrconnect' in address:
   self.polls+=1;raw=("window.wx_errcode=408;window.wx_code='';" if self.polls==1 else "window.wx_errcode=405;window.wx_code='fixture-code';").encode()
  elif '/connect/qrconnect' in address:raw=b'<img src="/connect/qrcode/fixture">'
  elif '/lyric/' in address:data={'code':0,'lyric':base64.b64encode(lyric.encode()).decode(),'trans':base64.b64encode(lyric.encode()).decode()}
  else:
   req=json.loads(event['body']);item=req.get('req_0',req.get('req'));method=item['method'];param=item['param']
   if method=='GetSession':d={'session':{'uid':'fixture-device','sid':'fixture-session'}}
   elif method=='QQLogin':d={'musicid':'12345','musickey':'Q_fixture','loginType':2}
   elif method=='Login':d={'str_musicid':'1152921504606846976','musickey':'W_fixture','loginType':1}
   elif method=='GetPlayLyricInfo':d={'lyric':large_qrc} if param.get('songMID')=='long-qrc' and param.get('crypt')==1 else {}
   elif method=='GetLoginUserInfo':d={'info':{'nick':'测试账号','headurl':'http://qpic.y.qq.com/avatar.jpg'}}
   elif method=='DoSearchForQQMusicDesktop':
    page=param['page_num'];d={'body':{'song':{'list':[{'mid':'song'+str(page),'title':'歌曲'+str(page),'interval':123,'album':{'mid':'album','name':'专辑','albumPic':'//qpic.y.qq.com/album.jpg?size=300'},'singer':[{'mid':'artist','name':'歌手','singerPic':'http://y.gtimg.cn/custom-artist.jpg'}]}]}},'meta':{'sum':40}}
   elif method=='get_song_detail_yqq':d={'track_info':{'mid':param['song_mid'],'file':{'media_mid':'fixture-media'}}}
   elif method in ['UrlGetVkey','CgiGetVkey']:d={'sip':['https://isure.stream.qqmusic.qq.com/'],'midurlinfo':[{'songmid':'song1','purl':'fixture.mp3'}]}
   else:raise ValueError('Unexpected API '+method)
   data={'code':0,('req_0' if 'req_0' in req else 'req'):{'code':0,'data':d}}
  if data is not None:raw=json.dumps(data,ensure_ascii=False).encode()
  return {'status':status,'url':address,'headers':headers,'setCookies':cookies,'body':raw.decode(errors='replace'),'base64':base64.b64encode(raw).decode()}
 def finish(self,status):
  for _ in range(4096):
   if status<0:raise RuntimeError(self.text('mbjs_result'))
   if status==1:return json.loads(self.text('mbjs_result'))
   event=json.loads(self.text('mbjs_take_event'))
   if event['kind']=='fetch':value=self.response(event)
   elif event['kind']=='timer':value=None
   elif event['kind']=='cancel':continue
   else:raise RuntimeError(event['kind'])
   status=self.lib.mbjs_settle(self.pointer,event['id'],1,json.dumps(value,ensure_ascii=False).encode(),100)
  raise RuntimeError('Too many events')
 def call(self,name,args=None):return self.finish(self.lib.mbjs_start(self.pointer,name.encode(),json.dumps(args or {},ensure_ascii=False).encode(),100))
 def close(self):self.lib.mbjs_destroy(self.pointer)
for platform in ['ios','android']:
 r=Runtime(platform)
 try:
  one=r.call('search',{'query':'音乐','kind':'tracks','offset':0});two=r.call('search',{'query':'音乐','kind':'tracks','offset':1})
  assert one['tracks'][0]['id']=='song1' and two['tracks'][0]['id']=='song2'
  assert one['tracks'][0]['duration']==123000 and one['more']
  assert one['tracks'][0]['album']['imageUrl']=='https://qpic.y.qq.com/album.jpg?size=300'
  assert one['tracks'][0]['artists'][0]['imageUrl']=='https://y.gtimg.cn/custom-artist.jpg'
  result=r.call('lyrics',{'id':'song1'});assert result['lrc']==lyric
  long=r.call('lyrics',{'id':'long-qrc'});assert len(long['lines'])>20 and any(line.get('words') for line in long['lines'])
  assert '[00:' in r.call('decodeQRC',qrc)
  audio=r.call('stream',{'id':'song1','quality':'standard'});assert audio['type']=='mp3' and audio['url'].endswith('fixture.mp3')
  profile=r.call('signIn');assert profile['imageUrl']=='https://qpic.y.qq.com/avatar.jpg';assert profile['id']=='1152921504606846976' and any(p.get('qr') for p in r.prompts)
  count=len(r.requests);r.call('signOut');assert r.call('account') is None and len(r.requests)==count
  assert r.storage['qqmusic.auth.v1']['musicid']==profile['id']
  r.call('search',{'query':'匿名','kind':'tracks'});assert 'cookie' not in {k.lower() for k in r.requests[-1]['headers']}
  prompts=len(r.prompts);assert r.call('signIn')['id']==profile['id'] and len(r.prompts)==prompts
  previous=r.storage['qqmusic.auth.v1'].copy();r.method='qq';r.prompts=[]
  qq=r.call('signIn');assert qq['id']=='12345' and r.storage['qqmusic.auth.v1']['loginType']==2 and any('QQ' in p.get('text','') and p.get('qr') for p in r.prompts)
  r.method='wechat';r.prompts=[];wechat=r.call('signIn')
  assert wechat['id']==previous['musicid'] and r.storage['qqmusic.auth.v1']['loginType']==1 and any('微信' in p.get('text','') and p.get('qr') for p in r.prompts)
  print('PASS',platform,'native QuickJS: bundle/search/paging/HTTPS artwork/UTF-8/QRC/audio/QQ+WeChat QR/provider switching/retained-session reuse')
 finally:r.close()
