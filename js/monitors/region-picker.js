const MAX_ZOOM = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function pickRegion(video, { label, color, initial, hint, onSave }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'monitor-roi-dialog';
  dialog.setAttribute('aria-labelledby', 'monitor-roi-title');
  dialog.innerHTML = `
    <h3 id="monitor-roi-title"></h3>
    <p class="monitor-roi-hint"></p>
    <div class="monitor-roi-toolbar">
      <button type="button" class="btn btn-secondary" data-pan aria-pressed="false">화면 이동</button>
      <button type="button" class="btn btn-secondary" data-zoom="out" aria-label="축소">−</button>
      <output data-scale aria-label="확대 배율">100%</output>
      <button type="button" class="btn btn-secondary" data-zoom="in" aria-label="확대">+</button>
      <button type="button" class="btn btn-secondary" data-reset>전체 보기</button>
    </div>
    <canvas aria-label="감지 영역을 지정할 게임 화면"></canvas>
    <footer class="monitor-roi-actions">
      <button type="button" class="btn btn-primary" data-save>영역 저장</button>
      <button type="button" class="btn btn-secondary" data-cancel>취소</button>
    </footer>`;

  const canvas = dialog.querySelector('canvas');
  const context = canvas.getContext('2d');
  const frame = document.createElement('canvas');
  frame.width = video.videoWidth;
  frame.height = video.videoHeight;
  frame.getContext('2d').drawImage(video, 0, 0);

  const pan = dialog.querySelector('[data-pan]');
  const scaleText = dialog.querySelector('[data-scale]');
  const save = dialog.querySelector('[data-save]');
  dialog.querySelector('h3').textContent = label + ' 영역 지정';
  dialog.querySelector('.monitor-roi-hint').textContent = hint + ' 휠로 확대·축소하고, 화면 이동을 켜거나 휠 버튼을 누른 채 드래그하세요.';

  let roi = { ...initial };
  let zoom = 1;
  let offset = { x: 0, y: 0 };
  let viewport = { width: 1, height: 1 };
  let gesture;

  function projection() {
    const fit = Math.min(viewport.width / frame.width, viewport.height / frame.height);
    const width = frame.width * fit * zoom;
    const height = frame.height * fit * zoom;
    return {
      width, height,
      x: (viewport.width - width) / 2 + offset.x,
      y: (viewport.height - height) / 2 + offset.y,
    };
  }

  function clampOffset() {
    const image = projection();
    const limitX = Math.max(0, (image.width - viewport.width) / 2);
    const limitY = Math.max(0, (image.height - viewport.height) / 2);
    offset.x = clamp(offset.x, -limitX, limitX);
    offset.y = clamp(offset.y, -limitY, limitY);
  }

  function paint() {
    clampOffset();
    const image = projection();
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.drawImage(frame, image.x, image.y, image.width, image.height);
    const x = image.x + roi.x / 100 * image.width;
    const y = image.y + roi.y / 100 * image.height;
    const width = roi.w / 100 * image.width;
    const height = roi.h / 100 * image.height;
    context.fillStyle = color + '33';
    context.fillRect(x, y, width, height);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    scaleText.value = Math.round(zoom * 100) + '%';
    save.disabled = roi.w < .1 || roi.h < .1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    viewport = { width: rect.width, height: rect.height };
    if (!viewport.width || !viewport.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewport.width * pixelRatio);
    canvas.height = Math.round(viewport.height * pixelRatio);
    context.setTransform(canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0);
    paint();
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function imagePoint(position, image = projection()) {
    return {
      x: clamp((position.x - image.x) / image.width * 100, 0, 100),
      y: clamp((position.y - image.y) / image.height * 100, 0, 100),
    };
  }

  function zoomAt(next, anchor) {
    if (gesture) return;
    const previous = imagePoint(anchor);
    zoom = clamp(next, 1, MAX_ZOOM);
    const image = projection();
    offset.x = anchor.x - (viewport.width - image.width) / 2 - previous.x / 100 * image.width;
    offset.y = anchor.y - (viewport.height - image.height) / 2 - previous.y / 100 * image.height;
    paint();
  }

  canvas.addEventListener('wheel', event => {
    if (event.ctrlKey || !event.deltaY) return;
    event.preventDefault();
    const factor = event.deltaMode === 0 ? clamp(Math.abs(event.deltaY) / 100, .12, 3) : 1;
    zoomAt(zoom * 1.25 ** (-Math.sign(event.deltaY) * factor), point(event));
  }, { passive: false });

  canvas.addEventListener('pointerdown', event => {
    if (gesture || (event.button !== 0 && event.button !== 1)) return;
    event.preventDefault();
    const origin = point(event);
    const moving = event.button === 1 || pan.getAttribute('aria-pressed') === 'true';
    gesture = { id: event.pointerId, origin, moving, offset: { ...offset }, start: imagePoint(origin), previousRoi: roi };
    canvas.setPointerCapture(event.pointerId);
    if (moving) canvas.classList.add('is-panning');
  });
  canvas.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const position = point(event);
    if (gesture.moving) {
      offset.x = gesture.offset.x + position.x - gesture.origin.x;
      offset.y = gesture.offset.y + position.y - gesture.origin.y;
    } else {
      const start = gesture.start;
      const end = imagePoint(position);
      roi = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) };
    }
    paint();
  });
  function endGesture(event) {
    if (gesture?.id !== event.pointerId) return;
    if (!gesture.moving && (event.type !== 'pointerup' || roi.w < .1 || roi.h < .1)) roi = gesture.previousRoi;
    gesture = undefined;
    canvas.classList.remove('is-panning');
    paint();
  }
  for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event, endGesture);
  canvas.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });

  pan.onclick = () => {
    const enabled = pan.getAttribute('aria-pressed') !== 'true';
    pan.setAttribute('aria-pressed', String(enabled));
    canvas.classList.toggle('pan-mode', enabled);
  };
  for (const button of dialog.querySelectorAll('[data-zoom]')) {
    button.onclick = () => zoomAt(zoom * (button.dataset.zoom === 'in' ? 1.25 : .8),
      { x: viewport.width / 2, y: viewport.height / 2 });
  }
  dialog.querySelector('[data-reset]').onclick = () => {
    zoom = 1;
    offset = { x: 0, y: 0 };
    paint();
  };
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  save.onclick = () => {
    onSave(roi);
    dialog.close();
  };
  const observer = new ResizeObserver(resize);
  dialog.addEventListener('close', () => {
    observer.disconnect();
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  resize();
  observer.observe(canvas);
}
