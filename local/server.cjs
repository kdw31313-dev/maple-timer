'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {MirrorCache,assetPath,mime}=require('./mirror-cache.cjs');
const PROJECT=path.resolve(__dirname,'..'),CACHE=path.join(PROJECT,'local-cache');
function sanitizeHtml(html){
 return html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi,(full,attrs)=>{const match=attrs.match(/\bsrc=["']([^"']+)["']/i);return match&&match[1].startsWith('/assets/')&&/type=["']module["']/.test(attrs)?full:'';})
 .replace('</head>','<link rel="stylesheet" href="/local/navigation.css"><script defer src="/legacy/js/거탐인식기기준.js"></script><script defer src="/legacy/js/imageAnalyzer.js"></script><script defer src="/legacy/js/검출정확도개선.js"></script><script defer src="/legacy/js/거탐검출정확도.js"></script><script defer src="/local/popup-bridge.js"></script></head>')
 .replace('<body>','<body><nav class="local-mode-nav"><a href="/">개인용 메이플 탐지기</a><strong>정밀 감지</strong><a href="/legacy/index.html" target="_blank" rel="noopener">기존 룬·거탐 열기 ↗</a><a href="/local/status" target="_blank" rel="noopener">모델 준비 상태</a></nav>');
}
const precisePolicy="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
async function createServer({offline=false,cacheRoot=CACHE}={}){
 const cache=new MirrorCache(cacheRoot,{offline});await cache.initialize();let saving=Promise.resolve();
 const save=()=>{saving=saving.catch(()=>{}).then(()=>cache.saveManifest());return saving;};
 const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:8765','localhost:8765'].includes(req.headers.host)){res.writeHead(403);res.end('Local host only');return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end('Read-only local server');return;}
  const raw=req.url.split('?')[0];let pathname;
  try{pathname=decodeURIComponent(raw);if(pathname.includes('\\')||/[\u0000-\u001f:]/.test(pathname)||pathname.split('/').some(x=>x==='..'||x==='.'))throw Error();}catch{res.writeHead(400);res.end('Invalid path');return;}
  const send=(code,bytes,type)=>{res.writeHead(code,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer','Content-Security-Policy':pathname.startsWith('/legacy/')?"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.telegram.org; worker-src 'self' blob:":precisePolicy});res.end(req.method==='HEAD'?undefined:bytes);};
  try{
   if(['/local/popup-bridge.js','/local/engine-test.html','/local/engine-test.js'].includes(pathname))return send(200,await fs.readFile(path.join(__dirname,path.basename(pathname))),mime(pathname));
   if(pathname==='/local/fixture-positive.jpg')return send(200,await fs.readFile(path.join(PROJECT,'테스트','자료','룬장식물_20260921','정상룬.jpg')),'image/jpeg');
   if(pathname==='/local/status')return send(200,JSON.stringify(cache.status(),null,2),'application/json; charset=utf-8');
   if(pathname==='/'||pathname==='/index.html')return send(200,await fs.readFile(path.join(__dirname,'launcher.html')),'text/html; charset=utf-8');
   if(pathname==='/precise'||pathname==='/guide')return send(200,sanitizeHtml(await fs.readFile(path.join(__dirname,'upstream.html'),'utf8')),'text/html; charset=utf-8');
   if(pathname==='/local/navigation.css')return send(200,await fs.readFile(path.join(__dirname,'navigation.css')),'text/css; charset=utf-8');
   if(pathname.startsWith('/legacy/')){
    const relative=pathname.slice('/legacy/'.length)||'index.html';
    if(!/^(index\.html|(?:js|css)\/[^/]+\.(?:js|css))$/.test(relative))return send(404,'Not found','text/plain');
    let bytes=await fs.readFile(path.join(PROJECT,relative));
    if(relative==='index.html')bytes=Buffer.from(bytes.toString().replace('</head>','<link rel="stylesheet" href="/local/navigation.css"></head>').replace('<body>','<body><nav class="local-mode-nav"><a href="/">모드 선택</a><strong>기존 룬·거탐</strong><a href="/precise" target="_blank" rel="noopener">정밀 감지 열기 ↗</a></nav>'));
    return send(200,bytes,mime(relative));
   }
   try{assetPath(raw);}catch{return send(403,'운영 서버 기능은 이 로컬 실행본에서 제공하지 않습니다.','text/plain; charset=utf-8');}
   let result;try{result=await cache.get(raw);}catch(e){cache.failures.set(pathname,e.message);throw e;}if(!result.cached)await save();
   return send(200,result.bytes,result.type);
  }catch(e){return send(e.code==='ENOENT'?404:502,JSON.stringify({error:e.message}),'application/json; charset=utf-8');}
 });
 return{server,cache,flush:()=>saving};
}
if(require.main===module)createServer({offline:process.argv.includes('--offline')}).then(({server})=>{server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(8765,'127.0.0.1',()=>console.log('메이플 탐지기: http://127.0.0.1:8765'));}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={createServer,sanitizeHtml};
