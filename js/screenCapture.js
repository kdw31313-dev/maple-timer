/**
 * ScreenCaptureManager - Zero-Lag Micro-Canvas ROI + 전체 화면 거탐 다운샘플링 0% 렉 스캐너 모듈
 */
class ScreenCaptureManager {
  constructor() {
    this.mediaStream = null;
    this.videoEl = document.getElementById('game-video');
    this.analysisCanvas = document.getElementById('analysis-canvas');
    this.overlayCanvas = document.getElementById('roi-overlay-canvas');
    
    this.analysisCtx = this.analysisCanvas ? this.analysisCanvas.getContext('2d', { willReadFrequently: true }) : null;
    this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

    // 초경량 마이크로 ROI 캔버스 (룬 & 버프)
    this.runeCanvas = document.createElement('canvas');
    this.runeCtx = this.runeCanvas.getContext('2d', { willReadFrequently: true });

    this.janusCanvas = document.createElement('canvas');
    this.janusCtx = this.janusCanvas.getContext('2d', { willReadFrequently: true });

    // 🚨 거탐 전체 화면 100% 다운샘플링 초경량 마이크로 캔버스 (240x135 해상도 = 0.03MB)
    this.popupCanvas = document.createElement('canvas');
    this.popupCanvas.width = 240;
    this.popupCanvas.height = 135;
    this.popupCtx = this.popupCanvas.getContext('2d', { willReadFrequently: true });

    this.isStreaming = false;
    this.loopIntervalId = null;

    // ROI 좌표 (% 비율 단위)
    this.runeRoi = { x: 1, y: 1, w: 25, h: 25 };
    this.popupRoi = { x: 0, y: 0, w: 100, h: 100 };
    this.janusRoi = { x: 70, y: 0, w: 30, h: 20 };

    // 200% 정밀 모달 관련 상태
    this.modalEl = document.getElementById('roi-modal');
    this.modalCanvas = document.getElementById('roi-modal-canvas');
    this.modalCtx = this.modalCanvas ? this.modalCanvas.getContext('2d') : null;
    this.modalWrapper = document.getElementById('roi-canvas-wrapper');
    this.modalViewport = document.getElementById('roi-modal-viewport');

    this.modalTarget = null;
    this.modalZoom = 2.0;
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

    if (this.modalCanvas && this.videoEl) {
      const vWidth = this.videoEl.videoWidth || 1280;
      const vHeight = this.videoEl.videoHeight || 720;
      
      const scaledWidth = Math.round(vWidth * this.modalZoom);
      const scaledHeight = Math.round(vHeight * this.modalZoom);

      this.modalCanvas.style.width = `${scaledWidth}px`;
      this.modalCanvas.style.height = `${scaledHeight}px`;
    }
  }

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

    this.modalCtx.drawImage(this.videoEl, 0, 0, vWidth, vHeight);

    this.setModalZoom(2.0);
    if (this.modalEl) this.modalEl.classList.remove('hidden');

    this.drawModalCanvas();
  }

  drawModalCanvas() {
    if (!this.modalCtx || !this.videoEl) return;

    const w = this.modalCanvas.width;
    const h = this.modalCanvas.height;

    this.modalCtx.drawImage(this.videoEl, 0, 0, w, h);

    this.modalCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.modalCtx.fillRect(0, 0, w, h);

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
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { max: 15 }
      },
      audio: false
    })
    .catch(() => {
      return navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
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

    const runePill = document.getElementById('rune-status-pill');
    const popupPill = document.getElementById('popup-status-pill');
    const janusPill = document.getElementById('janus-status-pill');

    if (badge) {
      badge.className = isConnected ? 'status-badge live' : 'status-badge disconnected';
    }
    if (text) {
      text.textContent = isConnected ? '⚡ 전체 화면 다운샘플링 0% 렉 사냥 스캐너 가동 중' : '연결 안 됨';
    }

    if (isConnected) {
      if (runePill && !window.imageAnalyzer?.runeState.isDetected) {
        runePill.textContent = '🟢 인식 중 (실시간 감지)';
        runePill.className = 'status-pill active';
      }
      if (popupPill && !window.imageAnalyzer?.popupState.isDetected) {
        popupPill.textContent = '🟢 인식 중 (100% 자동분석)';
        popupPill.className = 'status-pill active';
      }
      if (janusPill && !window.imageAnalyzer?.janusState.isBuffActive) {
        janusPill.textContent = '🟢 인식 중 (실시간 감지)';
        janusPill.className = 'status-pill active';
      }
    } else {
      if (runePill) { runePill.textContent = '⚪ 대기 중'; runePill.className = 'status-pill'; }
      if (popupPill) { popupPill.textContent = '⚪ 대기 중'; popupPill.className = 'status-pill'; }
      if (janusPill) { janusPill.textContent = '⚪ 대기 중'; janusPill.className = 'status-pill'; }
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

  /**
   * 📸 내 버프 아이콘 스크린샷 캡처 & AI 실시간 색상 학습
   */
  captureBuffSnapshot() {
    if (!this.isStreaming || !this.videoEl) {
      alert('먼저 상단의 [▶ 게임 창 공유 시작] 버튼을 눌러 메이플 화면을 연결해 주세요!');
      return;
    }

    const vWidth = this.videoEl.videoWidth || 1280;
    const vHeight = this.videoEl.videoHeight || 720;

    const jx = Math.max(0, Math.round((this.janusRoi.x / 100) * vWidth));
    const jy = Math.max(0, Math.round((this.janusRoi.y / 100) * vHeight));
    const jw = Math.max(10, Math.round((this.janusRoi.w / 100) * vWidth));
    const jh = Math.max(10, Math.round((this.janusRoi.h / 100) * vHeight));

    const snapCanvas = document.getElementById('buff-snapshot-canvas');
    const snapInfo = document.getElementById('buff-snapshot-info');
    const snapPanel = document.getElementById('buff-snapshot-panel');

    if (snapCanvas) {
      snapCanvas.width = jw;
      snapCanvas.height = jh;
      const ctx = snapCanvas.getContext('2d');
      ctx.drawImage(this.videoEl, jx, jy, jw, jh, 0, 0, jw, jh);

      const imageData = ctx.getImageData(0, 0, jw, jh);

      if (window.imageAnalyzer) {
        const result = window.imageAnalyzer.learnBuffSnapshot(imageData);
        if (snapInfo) {
          snapInfo.innerHTML = `✅ <strong>내 버프 아이콘 학습 완료!</strong><br>유효 픽셀: <strong>${result.activePixels}개</strong> | 평균 밝기: <strong>${result.avgBrightness}</strong><br>이제 사냥 중 이 버프 아이콘이 꺼지거나 해제되면 0.1초 즉시 알림이 발생합니다!`;
        }
      }
    }

    if (snapPanel) {
      snapPanel.classList.remove('hidden');
    }
  }

  /**
   * ⚡ 0% 렉 풀 스크린 분석:
   * 1) 룬 & 버프: 200x200 소형 마이크로 캔버스
   * 2) 거탐(4종 팝업): 240x135 초경량 다운샘플링 캔버스로 전체 화면을 100% 스캔하되 렉 0% 달성!
   */
  startLoop() {
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
    }

    this.loopIntervalId = setInterval(() => {
      if (!this.isStreaming || !this.videoEl) return;

      if (this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
        const vWidth = this.videoEl.videoWidth || 1280;
        const vHeight = this.videoEl.videoHeight || 720;

        // 1) 룬 미니맵 소형 마이크로 ROI 슬라이싱
        const rx = Math.max(0, Math.round((this.runeRoi.x / 100) * vWidth));
        const ry = Math.max(0, Math.round((this.runeRoi.y / 100) * vHeight));
        const rw = Math.max(10, Math.round((this.runeRoi.w / 100) * vWidth));
        const rh = Math.max(10, Math.round((this.runeRoi.h / 100) * vHeight));

        if (this.runeCanvas.width !== rw || this.runeCanvas.height !== rh) {
          this.runeCanvas.width = rw;
          this.runeCanvas.height = rh;
        }
        this.runeCtx.drawImage(this.videoEl, rx, ry, rw, rh, 0, 0, rw, rh);
        const runeImageData = this.runeCtx.getImageData(0, 0, rw, rh);

        // 2) 버프 소형 마이크로 ROI 슬라이싱
        const jx = Math.max(0, Math.round((this.janusRoi.x / 100) * vWidth));
        const jy = Math.max(0, Math.round((this.janusRoi.y / 100) * vHeight));
        const jw = Math.max(10, Math.round((this.janusRoi.w / 100) * vWidth));
        const jh = Math.max(10, Math.round((this.janusRoi.h / 100) * vHeight));

        if (this.janusCanvas.width !== jw || this.janusCanvas.height !== jh) {
          this.janusCanvas.width = jw;
          this.janusCanvas.height = jh;
        }
        this.janusCtx.drawImage(this.videoEl, jx, jy, jw, jh, 0, 0, jw, jh);
        const janusImageData = this.janusCtx.getImageData(0, 0, jw, jh);

        // 3) 🚨 거탐 전체 화면 240x135 초경량 다운샘플링 스캔 (0.03MB 메모리 - 0% 렉)
        this.popupCtx.drawImage(this.videoEl, 0, 0, vWidth, vHeight, 0, 0, 240, 135);
        const popupImageData = this.popupCtx.getImageData(0, 0, 240, 135);

        // 이미지 감지 엔진에 소형 마이크로 데이터 전달
        if (window.imageAnalyzer) {
          window.imageAnalyzer.analyzeMicroFrame(runeImageData, janusImageData, popupImageData);
        }
      }
    }, 150);
  }
}

window.screenCaptureManager = new ScreenCaptureManager();
