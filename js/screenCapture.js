/**
 * ScreenCaptureManager - WebRTC Screen Capture & 200% 정밀 확대 ROI 모달 선택 모듈
 */
class ScreenCaptureManager {
  constructor() {
    this.mediaStream = null;
    this.videoEl = document.getElementById('game-video');
    this.analysisCanvas = document.getElementById('analysis-canvas');
    this.overlayCanvas = document.getElementById('roi-overlay-canvas');
    
    this.analysisCtx = this.analysisCanvas ? this.analysisCanvas.getContext('2d') : null;
    this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

    this.isStreaming = false;
    this.loopIntervalId = null;

    // ROI 좌표 (% 비율 단위)
    this.runeRoi = { x: 1, y: 1, w: 25, h: 25 }; // 메이플 좌측 상단 미니맵 기본 위치
    this.popupRoi = { x: 0, y: 0, w: 100, h: 100 }; // 메이플 전체 사냥 화면 범위
    this.janusRoi = { x: 70, y: 0, w: 30, h: 20 }; // 우측 상단 버프 영역 기본 위치

    // 200% 정밀 모달 관련 상태
    this.modalEl = document.getElementById('roi-modal');
    this.modalCanvas = document.getElementById('roi-modal-canvas');
    this.modalCtx = this.modalCanvas ? this.modalCanvas.getContext('2d') : null;
    this.modalWrapper = document.getElementById('roi-canvas-wrapper');
    this.modalViewport = document.getElementById('roi-modal-viewport');

    this.modalTarget = null; // 'rune' | 'janus'
    this.modalZoom = 2.0; // 기본 200% 확대
    this.modalTempRoi = { x: 0, y: 0, w: 0, h: 0 };
    this.isModalDragging = false;
    this.modalDragStart = { x: 0, y: 0 };
    this.modalDragCurrent = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    if (this.overlayCanvas) {
      this.overlayCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
      this.overlayCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      this.overlayCanvas.addEventListener('mouseup', () => this.handleMouseUp());
    }
    window.addEventListener('resize', () => this.resizeCanvas());

    this.initModalEvents();
  }

  initModalEvents() {
    if (!this.modalCanvas) return;

    // 모달 내 드래그 영역 선택
    this.modalCanvas.addEventListener('mousedown', (e) => {
      if (!this.modalTarget) return;
      const rect = this.modalCanvas.getBoundingClientRect();
      this.isModalDragging = true;
      this.modalDragStart = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      };
      this.modalDragCurrent = { ...this.modalDragStart };
    });

    this.modalCanvas.addEventListener('mousemove', (e) => {
      if (!this.isModalDragging) return;
      const rect = this.modalCanvas.getBoundingClientRect();
      this.modalDragCurrent = {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      };
      this.drawModalCanvas();
    });

    this.modalCanvas.addEventListener('mouseup', () => {
      if (!this.isModalDragging) return;
      this.isModalDragging = false;

      const x1 = Math.min(this.modalDragStart.x, this.modalDragCurrent.x);
      const y1 = Math.min(this.modalDragStart.y, this.modalDragCurrent.y);
      const w = Math.abs(this.modalDragCurrent.x - this.modalDragStart.x);
      const h = Math.abs(this.modalDragCurrent.y - this.modalDragStart.y);

      if (w > 0.01 && h > 0.01) {
        this.modalTempRoi = {
          x: Math.round(x1 * 100),
          y: Math.round(y1 * 100),
          w: Math.round(w * 100),
          h: Math.round(h * 100)
        };
      }
      this.drawModalCanvas();
    });

    // 휠 스크롤 줌
    if (this.modalViewport) {
      this.modalViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.setModalZoom(this.modalZoom + 0.25);
        } else {
          this.setModalZoom(this.modalZoom - 0.25);
        }
      }, { passive: false });
    }

    // 모달 버튼들
    const btnZoomOut = document.getElementById('btn-modal-zoom-out');
    const btnZoomIn = document.getElementById('btn-modal-zoom-in');
    const btnZoomReset = document.getElementById('btn-modal-zoom-reset');
    const btnClose = document.getElementById('btn-modal-close');
    const btnApply = document.getElementById('btn-modal-apply');

    if (btnZoomOut) btnZoomOut.onclick = () => this.setModalZoom(this.modalZoom - 0.5);
    if (btnZoomIn) btnZoomIn.onclick = () => this.setModalZoom(this.modalZoom + 0.5);
    if (btnZoomReset) btnZoomReset.onclick = () => this.setModalZoom(1.0);
    if (btnClose) btnClose.onclick = () => this.closeRoiModal();
    if (btnApply) btnApply.onclick = () => this.applyRoiModal();
  }

  setModalZoom(zoomVal) {
    this.modalZoom = Math.max(1.0, Math.min(4.0, zoomVal));
    const txtZoom = document.getElementById('txt-modal-zoom');
    if (txtZoom) txtZoom.textContent = `${Math.round(this.modalZoom * 100)}%`;

    if (this.modalWrapper) {
      this.modalWrapper.style.transform = `scale(${this.modalZoom})`;
    }
  }

  /**
   * 🔍 200% 정밀 확대 모달 오픈
   */
  openRoiModal(targetType) {
    if (!this.isStreaming || !this.videoEl) {
      alert('먼저 상단의 [▶ 게임 창 공유 시작] 버튼을 눌러 메이플 화면을 연결해 주세요!');
      return;
    }

    this.modalTarget = targetType;
    this.modalTempRoi = targetType === 'rune' ? { ...this.runeRoi } : { ...this.janusRoi };

    const titleEl = document.getElementById('roi-modal-title');
    const subTitleEl = document.getElementById('roi-modal-subtitle');

    if (targetType === 'rune') {
      if (titleEl) titleEl.textContent = '📍 미니맵 영역 지정 (200% 정밀 확대)';
      if (subTitleEl) subTitleEl.textContent = '미니맵의 내부 지도 영역만 마우스 드래그로 직사각형으로 지정하세요.';
    } else {
      if (titleEl) titleEl.textContent = '⚡ 버프 영역 지정 (200% 정밀 확대)';
      if (subTitleEl) subTitleEl.textContent = '야누스, 경쿠, 소형재획비 버프 아이콘이 표시되는 우측 상단 영역을 드래그하세요.';
    }

    const vWidth = this.videoEl.videoWidth || 1280;
    const vHeight = this.videoEl.videoHeight || 720;

    this.modalCanvas.width = vWidth;
    this.modalCanvas.height = vHeight;

    // 현재 화면 프레임 캡처
    this.modalCtx.drawImage(this.videoEl, 0, 0, vWidth, vHeight);

    this.setModalZoom(2.0); // 200% 기본 확대
    if (this.modalEl) this.modalEl.classList.remove('hidden');

    this.drawModalCanvas();
  }

  drawModalCanvas() {
    if (!this.modalCtx || !this.videoEl) return;

    const w = this.modalCanvas.width;
    const h = this.modalCanvas.height;

    // 비디오 프레임 그리기
    this.modalCtx.drawImage(this.videoEl, 0, 0, w, h);

    // 반투명 어두운 오버레이
    this.modalCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.modalCtx.fillRect(0, 0, w, h);

    // 드래그 중이거나 선택된 영역
    let roi = this.modalTempRoi;
    if (this.isModalDragging) {
      const x1 = Math.min(this.modalDragStart.x, this.modalDragCurrent.x);
      const y1 = Math.min(this.modalDragStart.y, this.modalDragCurrent.y);
      const mw = Math.abs(this.modalDragCurrent.x - this.modalDragStart.x);
      const mh = Math.abs(this.modalDragCurrent.y - this.modalDragStart.y);
      roi = { x: x1 * 100, y: y1 * 100, w: mw * 100, h: mh * 100 };
    }

    const rx = (roi.x / 100) * w;
    const ry = (roi.y / 100) * h;
    const rw = (roi.w / 100) * w;
    const rh = (roi.h / 100) * h;

    // 선택 영역 명확히 잘라내서 원본 출력
    this.modalCtx.drawImage(this.videoEl, rx, ry, rw, rh, rx, ry, rw, rh);

    const color = this.modalTarget === 'rune' ? '#ff0080' : '#9b59b6';
    const label = this.modalTarget === 'rune' ? '📍 미니맵 지도 선택 영역' : '⚡ 버프 감지 선택 영역';

    this.modalCtx.strokeStyle = color;
    this.modalCtx.lineWidth = 3;
    this.modalCtx.strokeRect(rx, ry, rw, rh);

    this.modalCtx.fillStyle = color;
    this.modalCtx.font = 'bold 16px sans-serif';
    this.modalCtx.fillText(label, rx + 6, ry > 22 ? ry - 8 : ry + 20);
  }

  closeRoiModal() {
    if (this.modalEl) this.modalEl.classList.add('hidden');
    this.modalTarget = null;
  }

  applyRoiModal() {
    if (!this.modalTarget || this.modalTempRoi.w <= 0) return;

    if (this.modalTarget === 'rune') {
      this.runeRoi = { ...this.modalTempRoi };
    } else if (this.modalTarget === 'janus') {
      this.janusRoi = { ...this.modalTempRoi };
    }

    this.drawOverlay();
    this.closeRoiModal();
  }

  startCapture() {
    if (window.audioNotifier) {
      window.audioNotifier.initAudioContext();
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      alert('현재 브라우저 환경에서 화면 공유(WebRTC)를 지원하지 않거나 보안 연결이 아닙니다.');
      return;
    }

    navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    })
    .then((stream) => {
      this.mediaStream = stream;
      this.videoEl.srcObject = stream;
      this.isStreaming = true;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopCapture();
        };
      }

      this.videoEl.play().catch(e => console.log('비디오 재생:', e));

      const placeholder = document.getElementById('screen-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      if (this.videoEl) this.videoEl.classList.remove('hidden');
      if (this.analysisCanvas) this.analysisCanvas.classList.remove('hidden');

      this.updateStatusBadge(true);
      this.resizeCanvas();
      this.startLoop();
    })
    .catch((err) => {
      console.error('화면 공유 실패/취소:', err);
      if (err.name !== 'NotAllowedError' && !err.message?.includes('Permission denied')) {
        alert('화면 공유 팝업 창 호출 중 오류가 발생했습니다: ' + err.message);
      }
    });
  }

  stopCapture() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isStreaming = false;
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }

    if (this.videoEl) this.videoEl.classList.add('hidden');
    if (this.analysisCanvas) this.analysisCanvas.classList.add('hidden');
    const placeholder = document.getElementById('screen-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');

    this.updateStatusBadge(false);
    if (window.imageAnalyzer) window.imageAnalyzer.reset();
  }

  updateStatusBadge(isConnected) {
    const badge = document.getElementById('stream-status-badge');
    const text = document.getElementById('stream-status-text');
    const startBtn = document.getElementById('btn-start-share');
    const stopBtn = document.getElementById('btn-stop-share');

    if (badge) {
      badge.className = isConnected ? 'status-badge live' : 'status-badge disconnected';
    }
    if (text) {
      text.textContent = isConnected ? '🟢 실시간 화면 무한 연속 감지 중 (10 FPS)' : '연결 안 됨';
    }
    if (startBtn) startBtn.classList.toggle('hidden', isConnected);
    if (stopBtn) stopBtn.classList.toggle('hidden', !isConnected);
  }

  resizeCanvas() {
    if (!this.videoEl || !this.analysisCanvas || !this.overlayCanvas) return;
    const width = this.videoEl.videoWidth || 1280;
    const height = this.videoEl.videoHeight || 720;

    if (this.analysisCanvas.width !== width || this.analysisCanvas.height !== height) {
      this.analysisCanvas.width = width;
      this.analysisCanvas.height = height;
    }

    const rect = this.videoEl.getBoundingClientRect();
    if (this.overlayCanvas.width !== rect.width || this.overlayCanvas.height !== rect.height) {
      this.overlayCanvas.width = rect.width;
      this.overlayCanvas.height = rect.height;
    }

    this.drawOverlay();
  }

  drawOverlay() {
    if (!this.overlayCtx) return;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    this.overlayCtx.clearRect(0, 0, w, h);

    if (!this.isStreaming) return;

    this.drawRoiBox(this.runeRoi, 'rgba(255, 0, 128, 0.8)', '📍 미니맵 (룬/거탐)');
    this.drawRoiBox(this.janusRoi, 'rgba(155, 89, 182, 0.8)', '⚡ 버프 영역 (야누스/경쿠)');
  }

  drawRoiBox(roi, color, label) {
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    const rx = (roi.x / 100) * w;
    const ry = (roi.y / 100) * h;
    const rw = (roi.w / 100) * w;
    const rh = (roi.h / 100) * h;

    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 2;
    this.overlayCtx.strokeRect(rx, ry, rw, rh);

    this.overlayCtx.fillStyle = color;
    this.overlayCtx.font = '12px sans-serif';
    this.overlayCtx.fillText(label, rx + 4, ry > 16 ? ry - 4 : ry + 14);
  }

  startLoop() {
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
    }

    this.loopIntervalId = setInterval(() => {
      if (!this.isStreaming || !this.videoEl) return;

      if (this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
        if (this.videoEl.videoWidth !== this.analysisCanvas.width ||
            this.videoEl.videoHeight !== this.analysisCanvas.height) {
          this.resizeCanvas();
        }

        this.analysisCtx.drawImage(
          this.videoEl,
          0, 0,
          this.analysisCanvas.width,
          this.analysisCanvas.height
        );

        const imageData = this.analysisCtx.getImageData(
          0, 0,
          this.analysisCanvas.width,
          this.analysisCanvas.height
        );

        if (window.imageAnalyzer) {
          window.imageAnalyzer.analyzeFrame(imageData, {
            runeRoi: this.runeRoi,
            popupRoi: this.popupRoi,
            janusRoi: this.janusRoi
          });
        }
      }
    }, 100);
  }
}

window.screenCaptureManager = new ScreenCaptureManager();
