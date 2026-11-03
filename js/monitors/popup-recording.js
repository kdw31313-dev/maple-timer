const CLIP_MS = 20_000;
const ENABLED_KEY = 'maple-popup-recording-enabled';
const WRITE_PERMISSION = { mode: 'readwrite' };

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
      const request = folder ? store.put(folder, 'drive-folder') : store.get('drive-folder');
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

  async function restore() {
    try {
      toggle.checked = localStorage.getItem(ENABLED_KEY) === 'true';
      folder = await folderPreference();
      if (folder && await folder.queryPermission(WRITE_PERMISSION) === 'granted') {
        show('저장 폴더: ' + folder.name);
      } else if (folder) {
        show('자동 저장하려면 폴더 접근을 다시 허용하세요.');
      } else {
        show('Drive 동기화 폴더를 선택하면 자동 저장됩니다.');
      }
    } catch {
      show('Drive 동기화 폴더를 선택해주세요.');
    } finally {
      initialized = true;
      toggle.disabled = typeof MediaRecorder !== 'function';
      choose.disabled = toggle.disabled || typeof window.showDirectoryPicker !== 'function';
      if (toggle.disabled) show('이 브라우저는 화면 녹화를 지원하지 않습니다.');
      else if (choose.disabled) show('자동 저장은 폴더 접근을 지원하는 Chrome 또는 Edge에서 사용할 수 있습니다.');
    }
  }

  toggle.addEventListener('change', () => {
    try { localStorage.setItem(ENABLED_KEY, String(toggle.checked)); }
    catch { /* The choice still applies in the current page. */ }
  });

  choose.addEventListener('click', async () => {
    if (selecting || current) return;
    selecting = true;
    choose.disabled = true;
    try {
      const selected = await window.showDirectoryPicker({ ...WRITE_PERMISSION, id: 'maple-drive-recordings' });
      folder = selected;
      try { await folderPreference(selected); }
      catch {
        show('폴더를 연결했습니다. 새로고침하면 다시 선택해야 합니다.');
        return;
      }
      show('저장 폴더: ' + selected.name);
    } catch (error) {
      if (error.name !== 'AbortError') show('폴더를 열 수 없습니다. Drive 안의 하위 폴더를 선택해주세요.');
    } finally {
      selecting = false;
      choose.disabled = Boolean(current);
    }
  });

  download.addEventListener('click', () => {
    if (!latestClip) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(latestClip.blob);
    link.download = latestClip.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  async function saveClip(clip, destination) {
    latestClip = clip;
    download.hidden = false;
    if (!destination) {
      show('녹화 완료 · 다운로드하거나 Drive 폴더를 연결하세요.');
      return;
    }
    let output;
    try {
      if (await destination.queryPermission(WRITE_PERMISSION) !== 'granted') {
        show('녹화 완료 · 폴더 권한이 필요합니다. 영상은 다운로드할 수 있습니다.');
        return;
      }
      show('Drive 폴더에 저장 중…');
      const file = await destination.getFileHandle(clip.name, {create:true});
      output = await file.createWritable();
      await output.write(clip.blob);
      await output.close();
      show('Drive 폴더에 저장 완료 · 동기화는 Google Drive에서 확인하세요.');
    } catch {
      try { await output?.abort(); } catch { /* The stream may already be closed. */ }
      show('Drive 폴더 저장 실패 · 최근 영상을 다운로드할 수 있습니다.');
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
        choose.disabled = selecting || typeof window.showDirectoryPicker !== 'function';
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
          choose.disabled = selecting || typeof window.showDirectoryPicker !== 'function';
        }
      };
      recorder.start(1000);
      job.timeout = setTimeout(stop, CLIP_MS);
      choose.disabled = true;
      show('거탐 감지 · 공유 화면 20초 녹화 중…');
    } catch {
      current = undefined;
      show('공유 화면 녹화를 시작하지 못했습니다.');
    }
  }

  void restore();
  return { record, stop };
}
