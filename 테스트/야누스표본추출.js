'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const file=process.argv[2];
const samples=[];
for(const time of [0,5,10,15,20,25,30,35]) {
  const r=spawnSync('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-vf','crop=44:44:1528:0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
  if(r.status!==0||r.stdout.length!==44*44*3)throw new Error('sample decode');
  const t=[];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const p=(Math.round((y+.5)*44/8)*44+Math.round((x+.5)*44/8))*3;
    t.push(...(x>=1&&x<=6&&y>=2&&y<=5?[-1,-1,-1]:[...r.stdout.subarray(p,p+3)]));
  }
  samples.push(t);
}
const dest=path.resolve(__dirname,'../js/야누스추가표본.js').replaceAll('\\','/');
const body='// 2026-09-17 첫 제공 영상의 0~35초 표본. 두 번째 영상은 추출에 사용하지 않음.\nwindow.BUFF_ICON_TEMPLATES.janusVariants.push(...'+JSON.stringify(samples)+');\n';
const patch='*** Begin Patch\n*** Add File: '+dest+'\n'+body.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch';
const applied=spawnSync('C:/Users/sch/AppData/Local/OpenAI/Codex/bin/fd4c151a749f3ab4/codex.exe',['--codex-run-as-apply-patch',patch],{encoding:'utf8'});
if(applied.status!==0)throw new Error(applied.stderr);
console.log(applied.stdout);
