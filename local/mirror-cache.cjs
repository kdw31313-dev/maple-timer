'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ORIGIN='https://maple-timer.com';
const ROOTS=['/assets/','/models/','/vendor/','/sounds/','/fonts/','/skill-icons/','/buff-icons/','/images/','/videos/','/guide-videos/','/icons/'];
const ROOT_FILES=new Set(['/favicon.ico','/favicon-16x16.png','/favicon-32x32.png','/favicon-48x48.png','/apple-touch-icon.png','/build-info.json','/release-notes.json']);
function assetPath(raw){
 if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//'))throw Error('invalid asset path');
 const decoded=decodeURIComponent(raw.split('?')[0]);
 if(decoded.includes('\\')||/[\u0000-\u001f:]/.test(decoded)||decoded.split('/').some(x=>x==='.'||x==='..'))throw Error('invalid asset path');
 if(!ROOTS.some(root=>decoded.startsWith(root))&&!ROOT_FILES.has(decoded))throw Error('asset outside approved roots');
 return decoded;
}
const mime=name=>({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.woff2':'font/woff2','.otf':'font/otf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.m4a':'audio/mp4','.mp3':'audio/mpeg','.webm':'video/webm','.mp4':'video/mp4'}[path.extname(name)]||'application/octet-stream');
class MirrorCache{
 constructor(root,{fetcher=fetch,offline=false}={}){this.root=path.resolve(root);this.fetcher=fetcher;this.offline=offline;this.pending=new Map();this.records=new Map();this.failures=new Map();}
 async initialize(){await fs.mkdir(this.root,{recursive:true});try{for(const [k,v]of Object.entries(JSON.parse(await fs.readFile(path.join(this.root,'manifest.json'),'utf8')).assets||{}))this.records.set(k,v);}catch(e){if(e.code!=='ENOENT')throw e;}}
 async get(raw){const name=assetPath(raw);if(this.pending.has(name))return this.pending.get(name);const job=this.load(name).finally(()=>this.pending.delete(name));this.pending.set(name,job);return job;}
 async load(name){
  const file=path.join(this.root,name.slice(1)),expected=this.records.get(name);
  try{const bytes=await fs.readFile(file);if(!expected||crypto.createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw Error('cache integrity mismatch: '+name);return{bytes,type:mime(name),cached:true};}catch(e){if(e.code!=='ENOENT')throw e;}
  if(this.offline)throw Error('offline cache miss: '+name);
  const response=await this.fetcher(ORIGIN+encodeURI(name),{redirect:'error',signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('upstream '+response.status+': '+name);
  if((response.headers.get('content-type')||'').includes('text/html'))throw Error('HTML returned for asset: '+name);
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>128*1024*1024)throw Error('asset exceeds 128 MiB');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temporary,bytes);await fs.rename(temporary,file);
  this.records.set(name,{sha256,bytes:size,source:ORIGIN+encodeURI(name),fetchedAt:new Date().toISOString()});this.failures.delete(name);
  return{bytes,type:mime(name),cached:false};
 }
 async saveManifest(){const value={schema:1,upstream:ORIGIN,assets:Object.fromEntries([...this.records].sort(([a],[b])=>a.localeCompare(b)))};const file=path.join(this.root,'manifest.json'),temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);}
 status(){return{offline:this.offline,assets:this.records.size,bytes:[...this.records.values()].reduce((n,x)=>n+x.bytes,0),pending:[...this.pending.keys()],failures:Object.fromEntries(this.failures)};}
}
function discover(text,base='/assets/main.js'){
 const found=new Set(),add=s=>{if(s.includes('$'+'{')||s.includes('matcher/reports/'))return;try{const u=new URL(s.startsWith('assets/')?'/'+s:s,ORIGIN+base);if(u.origin===ORIGIN)found.add(assetPath(u.pathname));}catch{}};
 for(const m of text.matchAll(/["'\x60]((?:\.\/|\/|assets\/)[^"'\x60\s<>]+?\.(?:js|css|wasm|onnx|bin|json|woff2|otf|png|jpg|jpeg|svg|ico|mp3|m4a|mp4|webm)(?:\?[^"'\x60\s]*)?)["'\x60]/g))if(!m[1].includes('$'+'{'))add(m[1]);
 for(const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/g))add(m[1]);
 for(const m of text.matchAll(/rootPath:["'](\/models\/[^"']+)["'],policyFile:["']([^"']+)["']/g))add(m[1]+'/'+m[2]);
 const vars=new Map();for(const m of text.matchAll(/\b([A-Za-z_$][\w$]*)=["'](\/(?:models|vendor)\/[^"']+)["']/g))vars.set(m[1],m[2]);
 for(const m of text.matchAll(/\x60\$\{([A-Za-z_$][\w$]*)\}([^\x60]+)\x60/g))if(vars.has(m[1])&&!m[2].includes('$'+'{'))add(vars.get(m[1])+m[2]);
 if(base.startsWith('/models/')&&base.endsWith('.json')){const walk=v=>{if(typeof v==='string'&&/\.(?:onnx|bin|json)(?:\?.*)?$/.test(v))add(v.startsWith('/')?v:new URL(v,ORIGIN+base).pathname);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};try{walk(JSON.parse(text));}catch{}}
 return[...found];
}
module.exports={MirrorCache,assetPath,discover,mime,ORIGIN};
