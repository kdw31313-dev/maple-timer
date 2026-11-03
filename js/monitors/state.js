export const SKILLS = [
 {id:'janus',name:'솔 야누스 : 새벽',matcherSkillId:'janus'},
 {id:'fountain',name:'에르다 파운틴',matcherSkillId:'fountain'},
 {id:'hologramGraffitiBarrierVi',name:'홀로그램 그래피티 : 역장 VI',matcherSkillId:'barrier'},
 {id:'maehwaYein',name:'매화검 3초식 : 예인 VI',matcherSkillId:'maehwaYein'}
];
export const BUFFS = [{id:'unionWealth',name:'유니온의 부'},{id:'unionLuck',name:'유니온의 행운'},{id:'potion',name:'비약'},{id:'expCoupon',name:'경험치 쿠폰'}];
export const LABELS={rune:'룬',skill:'스킬',buff:'버프 종료',exp:'경험치 정체'};
export const KEY='maple-native-monitors-v1';
export function defaults(){const sound={sound:'chime',volume:80,repeat:0,telegram:true};return {version:1,tab:'rune',items:{rune:{...sound,enabled:true,sound:'rune',mode:'combined',roi:{x:.3,y:8.3,w:14.5,h:13}},skill:{...sound,enabled:false,lead:10,roi:{x:50,y:0,w:50,h:35}},buff:{...sound,enabled:false,lead:20,roi:{x:50,y:0,w:50,h:35},groups:BUFFS.map(x=>x.id)},exp:{...sound,enabled:false,stall:10,roi:{x:25,y:94,w:50,h:6}}},skills:SKILLS.map((x,i)=>({...x,...sound,enabled:i<2,lead:10})),customSounds:[]};}
export function loadConfig(){const d=defaults();try{const p=JSON.parse(localStorage.getItem(KEY));if(p?.version!==1)return d;for(const k in d.items)d.items[k]={...d.items[k],...p.items?.[k]};d.skills=SKILLS.map(x=>({...d.skills.find(y=>y.id===x.id),...p.skills?.find(y=>y.id===x.id)}));d.customSounds=Array.isArray(p.customSounds)?p.customSounds:[];d.tab=LABELS[p.tab]?p.tab:'rune';}catch{}return d;}
export function saveConfig(c){localStorage.setItem(KEY,JSON.stringify(c));}
// Reset on unreadable frames. A stale OCR value must never look like stopped hunting.
export class ExperienceTracker {
 constructor(){this.reset();}
 reset(){this.value=null;this.changedAt=0;this.lastAt=0;this.samples=0;}
 observe(reading,now,threshold){const value=reading?.recognizedText;if(!value||reading.confidence<.5){this.reset();return {ready:false,stalled:false};}if(this.lastAt&&now-this.lastAt>4000)this.reset();if(this.value!==value){this.value=value;this.changedAt=now;this.samples=0;}this.lastAt=now;this.samples++;return {ready:this.samples>=2,stalled:this.samples>=2&&now-this.changedAt>=threshold*1000,seconds:Math.floor((now-this.changedAt)/1000),value};}
}
export class AlertGate {
 constructor(){this.states=new Map();}
 reset(key){if(key)this.states.delete(key);else this.states.clear();}
 accept(key,active,now,repeat=0){if(!active){this.reset(key);return false;}const prev=this.states.get(key);if(prev!==undefined&&(!repeat||now-prev<repeat*1000))return false;this.states.set(key,now);return true;}
}
