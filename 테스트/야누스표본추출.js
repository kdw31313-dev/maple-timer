'use strict';
// 네 원본 영상의 사람이 확인한 슬롯에서만 표본을 추출한다. 중앙 숫자/바깥 테두리는 제외.
const {spawnSync}=require('node:child_process');
const ids=['133329603','133952226','144727069','145005811'];
const labels=[[[5,1528],[15,1528],[25,1528],[35,1528,'ending']],[[35,1528],[50,1528],[65,1528],[80,1528]],[[0,1528],[10,1663],[25,1663],[40,1708],[55,1708],[64,1708,'ending']],[[30,1483],[100,1528],[130,1528],[150,1528],[156,1528,'ending'],[158,1528,'ending'],[160,1528,'ending']]];
const points=[];
labels[0].push([38,1528,'ending'],[39,1528,'ending']);
labels[1].push([102,1483]);
labels[1].push([100.5,1438],[101.5,1483]);
labels[2].push([65,1708,'ending'],[65.5,1708,'ending']);
for(let y=2;y<=13;y++)for(let x=2;x<=13;x++)if(y<=4||y>=11||x===2||x===13)points.push([x,y]);
const samples=[];
const crops=[];
for(let v=0;v<4;v++)for(const [time,x,kind='active'] of labels[v]){
 const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',`C:/Users/sch/Documents/카카오톡 받은 파일/KakaoTalk_20260917_${ids[v]}.mp4`,'-vf',`crop=44:44:${x}:0:exact=1`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1']);
 if(r.status!==0||r.stdout.length!==44*44*4)throw Error(r.stderr.toString());
 crops.push(r.stdout);
 const rgb=points.flatMap(([gx,gy])=>{const i=(Math.round((gy+.5)*44/16)*44+Math.round((gx+.5)*44/16))*4;return [...r.stdout.subarray(i,i+3)];});
 samples.push({video:v+1,time,kind,rgb});
}
// 소멸 이후의 다른 버프들: 비슷한 색/곡선을 가진 아이콘을 음성 표본으로 비교한다.
const negatives=[];
for(const [v,time] of [[0,41],[1,95],[2,72],[3,168]]){
 const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',`C:/Users/sch/Documents/카카오톡 받은 파일/KakaoTalk_20260917_${ids[v]}.mp4`,'-vf','crop=864:259:1056:0:exact=1','-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1']);
 if(r.stdout.length!==864*259*4)throw Error('음성 표본 디코딩 실패');
 for(const y of [0,49,98,147])for(let x=247;x<=787;x+=45){
  const rgb=points.flatMap(([gx,gy])=>{const i=((y+Math.round((gy+.5)*44/16))*864+x+Math.round((gx+.5)*44/16))*4;return [...r.stdout.subarray(i,i+3)];});
  negatives.push(rgb);
 }
}
const body='// 네 영상에서 확인한 야누스 내부 곡선 표본. 독립 검증 자료가 아닌 보정 자료입니다.\nwindow.JANUS_TEXTURES = '+JSON.stringify({points,samples:[],negatives:[]})+';\n// END\n';
spawnSync('ffmpeg',['-v','error','-f','rawvideo','-pix_fmt','rgba','-s','44x44','-i','pipe:0','-vf','scale=176:176:flags=neighbor,tile=5x6','-frames:v','1','-y','../야누스_검증자료_20260917/곡선표본확인.jpg'],{input:Buffer.concat(crops)});
const patch='*** Begin Patch\n*** Add File: js/야누스곡선표본.js\n'+body.trimEnd().split('\n').map(x=>'+'+x).join('\n')+'\n*** End Patch';
function apply(p){const r=spawnSync('C:/Users/sch/AppData/Local/OpenAI/Codex/bin/12219cbfbcbddde7/codex.exe',['--codex-run-as-apply-patch',p],{encoding:'utf8'});if(r.error||r.status)throw Error(String(r.error||r.stderr));}
apply(patch);
for(let i=0;i<samples.length;i+=10)apply('*** Begin Patch\n*** Update File: js/야누스곡선표본.js\n@@\n-// END\n+window.JANUS_TEXTURES.samples.push(...'+JSON.stringify(samples.slice(i,i+10))+');\n+// END\n*** End Patch');
for(let i=0;i<negatives.length;i+=10)apply('*** Begin Patch\n*** Update File: js/야누스곡선표본.js\n@@\n-// END\n+window.JANUS_TEXTURES.negatives.push(...'+JSON.stringify(negatives.slice(i,i+10))+');\n+// END\n*** End Patch');
console.log('검수 양성 '+samples.length+'개, 다른 버프 음성 '+negatives.length+'개');
