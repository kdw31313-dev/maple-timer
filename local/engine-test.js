document.querySelector('#run').onclick=async()=>{
 const result=document.querySelector('#result');result.textContent='모델 로딩 중';
 const invoke=(message,url='/assets/runeDetection.worker-B_C0yRcq.js')=>new Promise((resolve,reject)=>{
  const worker=new Worker(url,{type:'module'});
  const finish=(error,data)=>{clearTimeout(timeout);worker.terminate();error?reject(error):resolve(data);};
  const timeout=setTimeout(()=>finish(Error('worker timeout')),90000);
  worker.onmessage=e=>finish(e.data.type==='error'||e.data.ok===false?Error(e.data.message||e.data.error):null,e.data);
  worker.onerror=e=>finish(Error(e.message));worker.postMessage(message);
 });
 try{
  const width=180,height=120,data=new Uint8ClampedArray(width*height*4);for(let i=3;i<data.length;i+=4)data[i]=255;
  const imageData=new ImageData(data,width,height),v14=await invoke({type:'detect',id:1,imageData});
  const v15=await invoke({type:'detect-v15',id:2,imageData,context:{engine:'v15',frameId:'synthetic:1',sampledAt:Date.now(),roi:{x:0,y:0,width,height},sourceSize:{width,height}}});
  const buff=await invoke({type:'preload',requestId:3,activeGroups:['unionWealth','unionLuck','potion','expCoupon']},'/assets/buffExpiryPrecision.worker-CiNT21Gn.js');
  const sample=new Image();sample.src='/local/fixture-positive.jpg';await sample.decode();
  const crop=document.createElement('canvas');crop.width=172;crop.height=75;const cropCtx=crop.getContext('2d');cropCtx.drawImage(sample,0,64,172,75,0,0,172,75);
  const positive=await invoke({type:'detect-v15',id:4,imageData:cropCtx.getImageData(0,0,172,75),context:{engine:'v15',frameId:'fixture:positive',sampledAt:Date.now(),roi:{x:0,y:0,width:172,height:75},sourceSize:{width:172,height:75}}});
  result.textContent=JSON.stringify({positive,buff,fixture:'검은 합성 프레임; 실제 게임 정확도 검증 아님',v14,v15},null,2);
 }catch(e){result.textContent='실패: '+e.message;}
};
