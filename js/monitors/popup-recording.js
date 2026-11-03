const CLIP_MS = 20_000;
const ENABLED_KEY = 'maple-popup-recording-enabled';
const WRITE_PERMISSION = { mode: 'readwrite' };
const CHOOSE_FOLDER = '바탕화면에 메이플 녹화 같은 하위 폴더를 만들어 선택하세요. 미선택 시 브라우저 다운로드 위치에 저장합니다.';

async function folderPreference(folder) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('maple-recording', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('preferences');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('preferences', folder ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('preferences');
      const request = folder ? store.put(folder, 'desktop-folder') : store.get('desktop-folder');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function bindPopupRecording(panel) {
  const toggle = panel.querySelector('[data-record-enabled]');
  const choose = panel.querySelector('[data-record-folder]');
  const reauthorize = panel.querySelector('[data-record-reauthorize]');
  const download = panel.querySelector('[data-record-download]');
  const status = panel.querySelector('[data-record-status]');
  let folder;
  let current;
  let latestClip;
  let initialized = false;
  let selecting = false;

  function show(message) {
    status.textContent = message;
  }

  function updateButtons() {
    choose.disabled = !initialized || toggle.disabled || selecting || Boolean(current) ||
      typeof window.showDirectoryPicker !== 'function';
    reauthorize.disabled = !initialized || toggle.disabled || selecting || Boolean(current);
  }

  function showPermission(granted) {
    reauthorize.hidden = granted || typeof folder?.requestPermission !== 'function';
    show(granted
      ? '저장 폴더: ' + folder.name
      : '폴더 쓰기 권한이 필요합니다. 저장 권한을 다시 허용하거나 다른 폴더를 선택하세요.');
  }

  async function restore() {
    try {
      toggle.checked = localStorage.getItem(ENABLED_KEY) === 'true';
      folder = await folderPreference();
      if (folder) showPermission(await folder.queryPermission(WRITE_PERMISSION) === 'granted');
      else show(CHOOSE_FOLDER);
    } catch {
      if (folder) showPermission(false);
      else show(CHOOSE_FOLDER);
    } finally {
      initialized = true;
      toggle.disabled = typeof MediaRecorder !== 'function';
      updateButtons();
      if (toggle.disabled) {
        reauthorize.hidden = true;
        show('이 브라우저는 화면 녹화를 지원하지 않습니다.');
      } else if (choose.disabled && !folder) {
        show('이 브라우저에서는 기본 다운로드 위치에 저장합니다.');
      }
    }
  }

  toggle.addEventListener('change', () => {
    try { localStorage.setItem(ENABLED_KEY, String(toggle.checked)); }
    catch { /* The choice still applies in the current page. */ }
  });

  choose.addEventListener('click', async () => {
    if (selecting || current) return;
    selecting = true;
    updateButtons();
    try {
      const selected = await window.showDirectoryPicker({ ...WRITE_PERMISSION, id: 'maple-desktop-recordings', startIn: 'desktop' });
      folder = selected;
      const granted = await selected.queryPermission(WRITE_PERMISSION) === 'granted';
      showPermission(granted);
      try { await folderPreference(selected); }
      catch {
        if (granted) show('저장 폴더: ' + selected.name + ' · 새로고침하면 다시 선택해야 합니다.');
      }
    } catch (error) {
      if (error.name === 'SecurityError') {
        show('브라우저가 폴더 접근을 막았습니다. Chrome 또는 Edge의 일반 탭에서 페이지를 열고 다시 선택하세요.');
      } else {
        show('폴더 선택이 완료되지 않았습니다. ' + CHOOSE_FOLDER);
      }
    } finally {
      selecting = false;
      updateButtons();
    }
  });

  reauthorize.addEventListener('click', async () => {
    if (selecting || current || !folder) return;
    selecting = true;
    updateButtons();
    try {
      showPermission(await folder.requestPermission(WRITE_PERMISSION) === 'granted');
    } catch {
      showPermission(false);
    } finally {
      selecting = false;
      updateButtons();
    }
  });

  function downloadClip(clip) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(clip.blob);
    link.download = clip.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  download.addEventListener('click', () => {
    if (latestClip) downloadClip(latestClip);
  });

  async function saveClip(clip, destination) {
    latestClip = clip;
    download.hidden = false;
    let output;
    let permissionMissing = false;
    try {
      permissionMissing = Boolean(destination) && await destination.queryPermission(WRITE_PERMISSION) !== 'granted';
      if (destination && !permissionMissing) {
        show('선택한 폴더에 저장 중…');
        const file = await destination.getFileHandle(clip.name, {create:true});
        output = await file.createWritable();
        await output.write(clip.blob);
        await output.close();
        if (destination === folder) reauthorize.hidden = true;
        show('녹화 저장 완료 · ' + destination.name);
        return;
      }
    } catch (error) {
      permissionMissing = error.name === 'NotAllowedError' || error.name === 'SecurityError';
      try { await output?.abort(); } catch { /* The stream may already be closed. */ }
    }
    downloadClip(clip);
    if (permissionMissing && destination === folder && typeof destination?.requestPermission === 'function') {
      reauthorize.hidden = false;
      show('폴더 쓰기 권한이 없어 브라우저 다운로드를 요청했습니다. 다음 녹화 전에 저장 권한을 다시 허용하세요.');
    } else {
      show('브라우저 다운로드 요청 완료 · 차단되면 최근 영상 다운로드를 눌러주세요.');
    }
  }

  function stop() {
    if (!current) return;
    clearTimeout(current.timeout);
    if (current.recorder.state !== 'inactive') current.recorder.stop();
  }

  function record(stream) {
    if (!initialized || !toggle.checked || current || typeof MediaRecorder !== 'function') return;
    const tracks = stream?.getVideoTracks().filter(track => track.readyState === 'live') || [];
    if (!tracks.length) return;

    const mimeType = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      .find(type => MediaRecorder.isTypeSupported(type));
    try {
      const recorder = new MediaRecorder(new MediaStream(tracks), {
        ...(mimeType ? {mimeType} : {}),
        videoBitsPerSecond: 2_000_000,
      });
      const chunks = [];
      const destination = folder;
      const recordedAt = new Date().toISOString().replace(/[:.]/g, '-');
      const job = { recorder, timeout: null };
      current = job;
      recorder.ondataavailable = ({data}) => { if (data.size) chunks.push(data); };
      recorder.onerror = () => {
        clearTimeout(job.timeout);
        if (current === job) current = undefined;
        updateButtons();
        show('공유 화면을 녹화하지 못했습니다.');
      };
      recorder.onstop = async () => {
        if (current !== job) return;
        clearTimeout(job.timeout);
        try {
          if (!chunks.length) {
            show('공유 화면이 종료돼 저장할 영상이 없습니다.');
            return;
          }
          const type = recorder.mimeType || chunks[0].type || 'video/webm';
          const extension = type.includes('mp4') ? 'mp4' : 'webm';
          const name = `메이플-거탐-${recordedAt}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
          await saveClip({name, blob:new Blob(chunks, {type})}, destination);
        } finally {
          current = undefined;
          updateButtons();
        }
      };
      recorder.start(1000);
      job.timeout = setTimeout(stop, CLIP_MS);
      updateButtons();
      show('거탐 감지 · 공유 화면 20초 녹화 중…');
    } catch {
      current = undefined;
      updateButtons();
      show('공유 화면 녹화를 시작하지 못했습니다.');
    }
  }

  void restore();
  return { record, stop };
}
