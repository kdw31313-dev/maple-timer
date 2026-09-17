/* 숫자 대신 아이콘 내부의 곡선을 비교. 좌표별 재할당 및 무제한 정밀 탐색 금지. */
(() => {
 'use strict';
 const model=window.JANUS_TEXTURES;
 if(!model)throw new Error('야누스 곡선 표본 누락');
 const cache=new Map();
 function layout(width,size){
  const key=width+':'+size;
  if(!cache.has(key))cache.set(key,model.points.map(([x,y])=>(Math.round((y+.5)*size/16)*width+Math.round((x+.5)*size/16))*4));
  return cache.get(key);
 }
 const pixels=new Float64Array(model.points.length*3);
 const negativeMeans=model.negatives.map(t=>t.reduce((a,b)=>a+b,0)/t.length);
 function score(frame,x,y,size,limit=34,ending=false){
  const offsets=layout(frame.width,size),base=(y*frame.width+x)*4;
  let mean=0;
  for(let k=0;k<offsets.length;k++){const p=base+offsets[k];pixels[k*3]=frame.data[p];pixels[k*3+1]=frame.data[p+1];pixels[k*3+2]=frame.data[p+2];mean+=pixels[k*3]+pixels[k*3+1]+pixels[k*3+2];}
  mean/=pixels.length;
  let best=Infinity;
  for(const sample of model.samples){
   if((sample.kind==='ending')!==ending)continue;
   const t=sample.rgb;let sum=0;
   const max=Math.min(limit,best)*t.length;
   for(let i=0;i<t.length;i++){sum+=Math.abs(pixels[i]-t[i]);if(sum>max)break;}
   if(sum<=max)best=Math.min(best,sum/t.length);
  }
  if(best<=limit&&!ending){
   for(let k=0;k<model.negatives.length;k++){if(Math.abs(mean-negativeMeans[k])>best+3)continue;const t=model.negatives[k];let sum=0;const max=(best+3)*t.length;for(let i=0;i<t.length;i++){sum+=Math.abs(pixels[i]-t[i]);if(sum>max)break;}if(sum<=max)return Infinity;}
  }
  return best;
 }
 window.findJanusIcon=(frame,previous=null,endingOnly=false)=>{
  let best={score:Infinity,found:false};
  const probe=(x,y,size,limit=34)=>{
   if(x<0||y<0||x+size>=frame.width||y+size>=frame.height)return;
   const value=score(frame,x,y,size,limit,endingOnly);
   if(value<best.score)best={x,y,size,score:value};
  };
  if(previous){
   const radius=endingOnly?3:1;
   for(let y=Math.max(0,previous.y-radius);y<=previous.y+radius;y++)for(let x=Math.max(0,previous.x-radius);x<=previous.x+radius;x++)probe(x,y,previous.size);
   if(endingOnly)return {...best,found:best.score<=32};
   if(best.score<=32)return {...best,found:true};
   const ending=window.findJanusIcon(frame,previous,true);
   if(ending.found)return {...ending,kind:'ending'};
   // 버프 추가/삭제에 따른 한 줄 내 이동부터 확인한다.
   for(let n=-14;n<=14;n++)if(n)for(let dx=-1;dx<=1;dx++)probe(previous.x+Math.round(n*previous.size*45/44)+dx,previous.y,previous.size);
   if(best.score<=30)return {...best,found:true};
  }
  if(endingOnly)return {found:false};
  const sizes=previous?[previous.size]:[Math.round(frame.width/864*44)];
  const seeds=[];
  // 기본 버프 첫 줄을 먼저 검사. 전체 ROI 탐색은 첫 줄/이전 슬롯에서 실패할 때만 수행.
  for(const size of sizes){
   for(let x=0;x+size<frame.width;x+=3){const value=score(frame,x,0,size,34);if(value<34)seeds.push({x,y:0,size,score:value});}
  }
  seeds.sort((a,b)=>a.score-b.score);
  for(const seed of seeds.slice(0,6))for(let y=0;y<=2;y++)for(let x=Math.max(0,seed.x-2);x<=seed.x+2;x++)probe(x,y,seed.size);
  if(best.score<=30)return {...best,found:true};
  seeds.length=0;
  for(const size of sizes){
   if(size<16||size>100)continue;
   for(let y=0;y+size<frame.height;y+=6)for(let x=0;x+size<frame.width;x+=3){
    const value=score(frame,x,y,size,24);
    if(value<24)seeds.push({x,y,size,score:value});
   }
  }
  seeds.sort((a,b)=>a.score-b.score);
  const used=[];
  for(const seed of seeds){
   if(used.some(p=>Math.abs(p.x-seed.x)<seed.size/2&&Math.abs(p.y-seed.y)<seed.size/2))continue;
   used.push(seed);
   for(let y=Math.max(0,seed.y-2);y<=seed.y+2;y++)for(let x=Math.max(0,seed.x-2);x<=seed.x+2;x++)probe(x,y,seed.size);
   if(used.length>=6)break;
  }
  return {...best,found:best.score<=20};
 };
})();
