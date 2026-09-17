/* 야누스 전용 숫자 제외 외곽 매칭. 과거 표본은 재사용하고 전역 버프 탐색은 호출하지 않는다. */
(() => {
  'use strict';
  const source = window.BUFF_ICON_TEMPLATES || {};
  const compile = list => list.filter(Boolean).map(t => {
    const points = [];
    for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
      const i=(y*8+x)*3;
      if(t[i]<0 || (x>=1&&x<=6&&y>=2&&y<=5)) continue;
      points.push([x,y,t[i],t[i+1],t[i+2]]);
    }
    return points;
  });
  const active = compile([source.janus,...(source.janusVariants||[])]);
  const ending = compile([source.janusEnding,...(source.janusEndingVariants||[])]);
  function score(frame,x,y,size,templates) {
    let best=Infinity;
    for(const points of templates) {
      let total=0,n=0;
      for(const [gx,gy,r,g,b] of points) {
        const p=((y+Math.round((gy+.5)*size/8))*frame.width+x+Math.round((gx+.5)*size/8))*4;
        const pr=frame.data[p],pg=frame.data[p+1],pb=frame.data[p+2];
        if(pr>=145&&pg>=135&&pb<=125) continue;
        total+=Math.abs(pr-r)+Math.abs(pg-g)+Math.abs(pb-b);n+=3;
      }
      if(n>=54) best=Math.min(best,total/n);
    }
    return best;
  }
  window.findJanusIcon = (frame, previous=null, endingOnly=false) => {
    const templates=endingOnly?ending:active;
    const sizes=previous?[previous.size]:[44,33,56,66];
    let best={score:Infinity,found:false};
    const probe=(x,y,size)=>{
      if(x<0||y<0||x+size>=frame.width||y+size>=frame.height)return;
      const value=score(frame,x,y,size,templates);
      if(value<best.score)best={x,y,size,score:value};
    };
    if(previous) {
      for(let y=Math.max(0,previous.y-3);y<=previous.y+3;y++)for(let x=Math.max(0,previous.x-3);x<=previous.x+3;x++)probe(x,y,previous.size);
      // 이미 확인한 동일 슬롯은 압축·반투명 위상 변화를 허용한다. 최초/전역 탐색은 20 유지.
      if(!endingOnly&&best.score<=28)return {...best,found:true};
      if(endingOnly)return {...best,found:best.score<=14};
    }
    // 6px 격자로 상위 후보를 얻은 뒤 1px로 맞춘다. 특정 버프 줄/화살표에 묶지 않는다.
    const seeds=[];
    for(const size of sizes)for(let y=0;y+size<frame.height;y+=6)for(let x=0;x+size<frame.width;x+=6){
      const value=score(frame,x,y,size,templates);
      if(value<32)seeds.push({x,y,size,score:value});
    }
    seeds.sort((a,b)=>a.score-b.score);
    for(const seed of seeds.slice(0,12))for(let y=Math.max(0,seed.y-5);y<=seed.y+5;y++)for(let x=Math.max(0,seed.x-5);x<=seed.x+5;x++)probe(x,y,seed.size);
    return {...best,found:best.score<=(endingOnly?14:20)};
  };
})();
