import { pickRegion } from './region-picker.js?v=20261103-zoom';
import { LABELS, BUFFS, KEY, loadConfig, saveConfig, ExperienceTracker, AlertGate } from './state.js?v=20261103-rows';
import { WorkerPool, cropVideo } from './workers.js?v=20261103-rows';

const config = loadConfig(window.storageManager?.loadConfig());
const root = document.getElementById('monitor-toolbox');
const pool = new WorkerPool();
const gate = new AlertGate();
const exp = new ExperienceTracker();
const statuses = {}, hits = new Map(), errors = new Map();
let generation = 0, streaming = false, lastRune = 0, lastLegacyRune = 0;
const soundPresets = [['chime','맑은 벨'],['rune','룬 아르페지오'],['beep','삐삐'],['siren','사이렌'],['bell','딩동'],['harp','하프']];
const soundFiles = await fetch(new URL('./sounds.json', import.meta.url)).then(r => r.json()).catch(() => []);
const colors = { rune: '#e569b9', popup: '#f5b568', buff: '#6ee0ab', exp: '#7dbdfb' };
const icons = { rune: '◆', popup: '!', buff: '✦', exp: '↗' };
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function persist() {
  try { saveConfig(config); }
  catch { document.getElementById('monitor-feedback').textContent = '설정 저장 공간이 부족합니다.'; }
}

function setStatus(key, message) {
  statuses[key] = message;
  const element = root.querySelector(`[data-status="${key}"]`);
  if (element && element.textContent !== message) {
    element.textContent = message;
    element.title = message;
  }
}

function rules(key, item) {
  if (key === 'popup') return '<span class="monitor-muted">팝업 7종 자동 감지</span>';
  if (key === 'rune') {
    return `<select aria-label="룬 감지 방식" data-field="mode">
      ${[['combined','기존 + 정밀'],['precision','정밀 모델'],['legacy','기존 감지']].map(([id,label]) =>
        `<option value="${id}" ${item.mode===id?'selected':''}>${label}</option>`).join('')}
    </select>`;
  }
  if (key === 'exp') return `<label><input aria-label="경험치 무변동 기준 초" type="number" min="3" max="300" data-field="stall" value="${esc(item.stall)}">초 변화 없음</label>`;
  return `<label><input aria-label="버프 종료 전 알림 초" type="number" min="0" max="120" data-field="lead" value="${esc(item.lead)}">초 전</label>
    <details class="buff-groups">
      <summary>버프 <span data-group-count>${item.groups.length}</span>종</summary>
      <div class="buff-choices">${BUFFS.map(buff =>
        `<label><input type="checkbox" data-group="${buff.id}" ${item.groups.includes(buff.id)?'checked':''}> ${buff.name}</label>`).join('')}
      </div>
    </details>`;
}

function render() {
  const previousPopupStatus = document.getElementById('popup-status-pill')?.textContent;
  const options = [...soundPresets, ...soundFiles.map(file => ['file:'+file, file.replace(/\.m4a$/,'')]),
    ...config.customSounds.map(sound => [sound.id, sound.name])];
  root.innerHTML = `
    <div class="monitor-list" aria-label="감시 항목">
      ${Object.entries(LABELS).map(([key, label]) => {
        const item = config.items[key];
        const status = item.enabled
          ? (key === 'popup' ? previousPopupStatus : statuses[key]) || '화면 공유 대기'
          : '감시 꺼짐';
        return `<section class="monitor-row" data-monitor="${key}" data-enabled="${Boolean(item.enabled)}" aria-label="${label}" style="--monitor-accent:${colors[key]}">
          <div class="monitor-identity">
            <span class="monitor-symbol" aria-hidden="true">${icons[key]}</span>
            <div><h3>${label}</h3><p role="status" ${key === 'rune' || key === 'popup' ? `id="${key}-status-pill"` : ''} data-status="${key}">${esc(status)}</p></div>
          </div>
          <div class="monitor-rules">${rules(key,item)}</div>
          <div class="monitor-region">
            ${key === 'popup' ? '<span class="monitor-muted">전체 화면</span>' : `<button type="button" class="btn btn-secondary" data-roi title="${label} 영역 드래그 지정">영역 지정</button>`}
          </div>
          <div class="monitor-audio">
            <select aria-label="${label} 알림음" data-field="sound">
              ${options.map(([id, title]) => `<option value="${esc(id)}" ${item.sound===id?'selected':''}>${esc(title)}</option>`).join('')}
            </select>
            <input type="range" aria-label="${label} 볼륨" min="0" max="100" value="${esc(item.volume)}" data-field="volume">
            <output aria-hidden="true">${esc(item.volume)}%</output>
            <button type="button" class="btn btn-secondary" data-test aria-label="${label} 소리 듣기" title="소리 듣기">▶</button>
          </div>
          <div class="monitor-delivery">
            ${key === 'popup' ? '' : `<select aria-label="${label} 반복 알림" data-field="repeat">
              ${[0,3,5,10,30,60].map(seconds => `<option value="${seconds}" ${Number(item.repeat)===seconds?'selected':''}>${seconds?seconds+'초 반복':'한 번만'}</option>`).join('')}
            </select>`}
            <label><input type="checkbox" data-field="telegram" ${item.telegram?'checked':''}> 텔레그램</label>
          </div>
          <label class="switch monitor-switch">
            <input type="checkbox" role="switch" aria-label="${label} 감시" data-field="enabled" ${item.enabled?'checked':''}>
            <span class="slider"></span>
          </label>
        </section>`;
      }).join('')}
    </div>
    <footer class="monitor-footer">
      <label class="btn btn-secondary">내 알림음 추가<input type="file" accept="audio/*" data-upload hidden></label>
      <button type="button" class="btn btn-secondary" data-backup>감시 설정 백업</button>
      <label class="btn btn-secondary">감시 설정 복원<input type="file" accept="application/json" data-restore hidden></label>
      <span id="monitor-feedback" role="status"></span>
    </footer>`;
}

function play(item, key) {
  const volume = Math.max(0, Math.min(1, Number(item.volume)/100));
  if (!volume) return;
  const url = item.sound.startsWith('file:')
    ? new URL('../../precise/runtime/sounds/'+encodeURIComponent(item.sound.slice(5)), import.meta.url).href
    : config.customSounds.find(sound => sound.id === item.sound)?.data;
  if (url) {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => setStatus(key, '소리 듣기를 눌러 재생을 허용해주세요.'));
  } else {
    const notifier = window.audioNotifier;
    const saved = notifier.volume;
    notifier.volume = volume;
    try { notifier.playSoundPreset(item.sound); }
    finally { notifier.volume = saved; }
  }
}

function notify(key, message, item, options) {
  play(item, key);
  window.audioNotifier.presentAlert(message);
  if (item.telegram && options?.telegram !== false) window.telegramNotifier?.sendAlert(message, key);
}

function emit(id, text, item) {
  if (!gate.accept(id, true, Date.now(), Number(item.repeat))) return;
  const key = id.split(':')[0];
  notify(key, text, item);
  setStatus(key, text);
}

function stable(id, active) {
  const n = active ? (hits.get(id) || 0) + 1 : 0;
  hits.set(id, n);
  return n >= 2;
}

function synchronize() {
  const rune = config.items.rune;
  document.getElementById('toggle-rune-detection').checked = rune.enabled && rune.mode !== 'precision';
  document.getElementById('toggle-popup-detection').checked = config.items.popup.enabled;
  const capture = window.screenCaptureManager;
  capture.runeRoi = { ...rune.roi };
  capture.drawOverlay();
}

root.addEventListener('input', event => {
  if (event.target.dataset.field === 'volume') {
    event.target.nextElementSibling.value = event.target.value + '%';
  }
});

root.addEventListener('change', async event => {
  const control = event.target;
  const row = control.closest('[data-monitor]');
  if (row) {
    const key = row.dataset.monitor;
    const item = config.items[key];
    const field = control.dataset.field;
    if (field) {
      let value = control.type === 'checkbox' ? control.checked : control.value;
      if (control.type === 'number' || control.type === 'range') {
        value = Math.max(Number(control.min), Math.min(Number(control.max), Number(value)));
        control.value = value;
      }
      item[field] = value;
      if (field === 'enabled') {
        row.dataset.enabled = String(value);
        setStatus(key, value ? (window.screenCaptureManager.isStreaming ? '감시 중' : '화면 공유 대기') : '감시 꺼짐');
      }
    } else if (control.dataset.group) {
      const groups = row.querySelectorAll('[data-group]:checked');
      item.groups = [...groups].map(input => input.dataset.group);
      row.querySelector('[data-group-count]').textContent = item.groups.length;
    }
    if (!['volume','sound','telegram','repeat'].includes(field)) {
      generation++;
      errors.clear();
      hits.clear();
      gate.reset();
      exp.reset();
      synchronize();
    }
    persist();
  }

  if (control.hasAttribute('data-upload') && control.files[0]) {
    const file = control.files[0];
    if (file.size > 1500000) {
      document.getElementById('monitor-feedback').textContent = '음원은 1.5MB 이하로 선택해주세요.';
      return;
    }
    const data = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    config.customSounds.push({id:'custom:'+Date.now(), name:file.name, data});
    render();
    synchronize();
    persist();
  }
  if (control.hasAttribute('data-restore') && control.files[0]) {
    try {
      const restored = JSON.parse(await control.files[0].text());
      if (restored.version === 1 && restored.items && typeof restored.items === 'object') {
        saveConfig(restored);
        if (restored.common) {
          const legacy = window.storageManager.loadConfig();
          for (const key of ['ttsVoice', 'visualFlash']) {
            if (typeof restored.common[key] === 'boolean') legacy[key] = restored.common[key];
          }
          window.storageManager.saveConfig(legacy);
        }
      } else if (restored.runeRoi && typeof restored.ttsVoice === 'boolean') {
        const legacy = window.storageManager.importConfig(JSON.stringify(restored));
        if (!legacy) throw Error();
        const roi = legacy.runeRoi;
        if ([roi.x,roi.y,roi.w,roi.h].every(Number.isFinite)) config.items.rune.roi = roi;
        config.items.popup.sound = legacy.customSounds?.popup || 'siren';
        if (Number.isFinite(legacy.volume)) config.items.popup.volume = legacy.volume;
        saveConfig(config);
      } else {
        throw Error();
      }
      location.reload();
    } catch {
      document.getElementById('monitor-feedback').textContent = '올바른 감시 설정 파일을 선택해주세요.';
    }
  }
});

root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const key = button.closest('[data-monitor]')?.dataset.monitor;
  if (button.hasAttribute('data-test')) play(config.items[key], key);
  if (button.hasAttribute('data-roi')) selectRegion(key);
  if (button.hasAttribute('data-backup')) {
    const link = document.createElement('a');
    const {ttsVoice, visualFlash} = window.storageManager.loadConfig();
    const backup = {...config, common:{ttsVoice, visualFlash}};
    link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'}));
    link.download = 'maple-monitor-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
});

function selectRegion(key) {
  const capture = window.screenCaptureManager;
  if (!capture?.isStreaming || !capture.videoEl?.videoWidth || capture.videoEl.readyState < 2) {
    setStatus(key, '먼저 게임 창을 공유해주세요.');
    return;
  }
  const hints = {
    rune: '미니맵 안쪽을 드래그하세요.',
    buff: '버프 아이콘과 남은 시간이 표시되는 곳을 드래그하세요.',
    exp: '하단의 현재 경험치 숫자와 퍼센트를 함께 드래그하세요.',
  };
  pickRegion(capture.videoEl, {
    label: LABELS[key], color: colors[key], initial: config.items[key].roi, hint: hints[key],
    onSave(roi) {
      config.items[key].roi = roi;
      generation++;
      exp.reset();
      gate.reset();
      persist();
      synchronize();
    },
  });
}
async function analyze(key,video,epoch){const item=config.items[key];if(!item.enabled)return;const capture=cropVideo(video,item.roi);const now=Date.now();let result;
 if(key==='rune'){if(item.mode==='legacy')return;result=await pool.call(key,{type:'detect-v15',...capture,context:{engine:'v15',frameId:'native:'+now,sampledAt:now,roi:capture.roi,sourceSize:capture.sourceSize}});if(epoch!==generation||!window.screenCaptureManager?.isStreaming)return;const active=result.result?.objects?.length>0;if(stable('rune-model',active)){lastRune=now;emit('rune','미니맵에서 룬이 감지됐어요.',item);}else if(!active&&now-Math.max(lastRune,lastLegacyRune)>5000)gate.reset('rune');setStatus(key,active?'룬 발견':'정밀 미니맵 감시 중');}
 if(key==='buff'){if(!item.groups.length){setStatus(key,'감시할 버프 그룹을 선택해주세요.');return;}result=await pool.call(key,{type:'process',imageData:capture.imageData,sourceSize:{width:capture.imageData.width,height:capture.imageData.height},activeGroups:item.groups,buffSlotInputMode:'croppedRoi',sampledAt:now});if(epoch!==generation||!window.screenCaptureManager?.isStreaming)return;const rows=result.bestByGroup||[];let found=0;for(const row of Array.isArray(rows)?rows:Object.values(rows)){if(!row.accepted||!item.groups.includes(row.group))continue;const seconds=row.countdown?.totalSeconds;if(!Number.isFinite(seconds))continue;found++;const id='buff:'+row.group,active=seconds<=item.lead;if(stable(id,active))emit(id,(BUFFS.find(x=>x.id===row.group)?.name||'버프')+' 종료까지 '+seconds+'초',item);if(!active)gate.reset(id);}setStatus(key,result.performance?.matcherModelStatus==='loading'?'버프 모델 준비 중':found+'개 버프 시간 인식 · 감시 중');}
 if(key==='exp'){result=await pool.call(key,{type:'process',sourceWidth:video.videoWidth,sourceHeight:video.videoHeight,barStrips:[],candidates:[{label:'manual',regionPixels:capture.roi,imageData:capture.imageData}],includePreview:false});if(epoch!==generation||!window.screenCaptureManager?.isStreaming)return;const state=exp.observe(result.reading,Date.now(),item.stall);if(state.stalled)emit('exp','경험치가 '+state.seconds+'초 동안 오르지 않았어요.',item);else gate.reset('exp');setStatus(key,state.ready?'경험치 '+state.value+' · '+state.seconds+'초 유지':'경험치 숫자 판독 대기 · 영역을 확인하세요');}
}
async function tick(){try{const manager=window.screenCaptureManager,video=manager?.videoEl;const live=manager?.isStreaming&&video?.readyState>=2;if(!live){if(streaming){generation++;pool.close();gate.reset();exp.reset();hits.clear();for(const key in LABELS)setStatus(key,config.items[key].enabled?'화면 공유 대기':'감시 꺼짐');}streaming=false;return;}streaming=true;const epoch=generation;for(const key of ['rune','buff','exp']){if(!config.items[key].enabled){setStatus(key,'감시 꺼짐');continue;}if(Date.now()<(errors.get(key)||0))continue;try{await analyze(key,video,epoch);}catch(error){errors.set(key,Date.now()+10000);setStatus(key,'감지 오류 · '+error.message);}if(epoch!==generation)break;}}finally{setTimeout(tick,500);}}
const captureManager = window.screenCaptureManager;
captureManager.getMonitorRegions = () => Object.entries(config.items)
  .filter(([, item]) => item.enabled && item.roi)
  .map(([key, item]) => ({ roi: item.roi, color: colors[key], label: LABELS[key] }));

document.body.classList.add('native-monitors-ready');
render();
synchronize();

const originalNotify = window.audioNotifier.notify.bind(window.audioNotifier);
window.audioNotifier.notify = (message, category, options) => {
  if (category === 'rune') {
    const rune = config.items.rune;
    if (rune.enabled && rune.mode !== 'precision') {
      if (Date.now()-lastLegacyRune>6000 && Date.now()-lastRune>6000) gate.reset('rune');
      lastLegacyRune = Date.now();
      emit('rune', message, rune);
    }
  } else if (category === 'popup') {
    const popup = config.items.popup;
    if (!popup.enabled) return;
    notify('popup', message, popup, options);
    setTimeout(() => { if (popup.enabled && captureManager.isStreaming) play(popup, 'popup'); }, 400);
  } else {
    return originalNotify(message, category, options);
  }
};

const originalStop = captureManager.stopCapture.bind(captureManager);
captureManager.stopCapture = () => {
  generation++;
  pool.close();
  gate.reset();
  exp.reset();
  hits.clear();
  return originalStop();
};
window.addEventListener('pagehide', () => pool.close());
window.mapleNativeMonitors = {
  config, pool, analyze,
  stop: () => { generation++; pool.close(); },
  getStatuses: () => ({...statuses}),
  resetSettings: () => localStorage.removeItem(KEY),
};
tick();
