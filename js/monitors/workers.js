const ROOT=new URL('../../precise/runtime/assets/',import.meta.url);
const FILES={rune:'runeDetection.worker-B_C0yRcq.js',buff:'buffExpiryPrecision.worker-CiNT21Gn.js',skill:'skillPrecisionAnalysis.worker-QLy_dNyi.js'};
export class WorkerPool {
 constructor(){this.entries=new Map();this.sequence=0;}
 async call(kind,message){let entry=this.entries.get(kind);if(!entry){const worker=new Worker(kind==='exp'?new URL('./experience.worker.js',import.meta.url):new URL(FILES[kind],ROOT),{type:'module'});entry={worker,pending:new Map()};this.entries.set(kind,entry);worker.onmessage=({data})=>{const id=data.requestId??data.id;const p=entry.pending.get(id);if(!p)return;entry.pending.delete(id);clearTimeout(p.timer);if(data.ok===false||data.type==='error')p.reject(Error(data.error||data.message));else p.resolve(data.response??data);};worker.onerror=()=>this.drop(kind,'감지 워커 로딩 실패');}
 const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.drop(kind,'모델 응답 시간 초과'),60000);entry.pending.set(id,{resolve,reject,timer});try{entry.worker.postMessage({...message,id,requestId:id});}catch(error){entry.pending.delete(id);clearTimeout(timer);reject(error);}});
 }
 drop(kind,reason='감시 중지'){const e=this.entries.get(kind);if(!e)return;e.worker.terminate();for(const p of e.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}this.entries.delete(kind);}
 close(){for(const k of [...this.entries.keys()])this.drop(k);}
}
export function cropVideo(video,roi){const w=video.videoWidth,h=video.videoHeight;const x=Math.min(w-1,Math.max(0,Math.round(w*roi.x/100))),y=Math.min(h-1,Math.max(0,Math.round(h*roi.y/100)));const width=Math.max(1,Math.min(w-x,Math.round(w*roi.w/100))),height=Math.max(1,Math.min(h-y,Math.round(h*roi.h/100)));const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,x,y,width,height,0,0,width,height);return {imageData:ctx.getImageData(0,0,width,height),roi:{x,y,width,height},sourceSize:{width:w,height:h}};}
