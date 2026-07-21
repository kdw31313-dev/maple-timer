/**
 * ScreenCaptureManager - WebRTC Screen Capture & ROI 선택 인터랙션 관리 모듈
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
    this.animationFrameId = null;

    // ROI 좌표 (% 비율 단위)
    this.runeRoi = { x: 1, y: 1, w: 22, h: 22 }; // 메이플 좌측 상단 미니맵 기본 위치
    this.popupRoi = { x: 0, y: 0, w: 100, h: 100 }; // 메이플 전체 사냥 화면 범위
    this.janusRoi = { x: 75, y: 1, w: 24, h: 15 }; // 우측 상단 버프 영역 기본 위치

    // ROI 드래그 선택 상태
    this.selectingTarget = null; // 'rune' | 'popup' | null
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    if (!this.overlayCanvas) return;

    // 드래그 영역 선택 이벤트
    this.overlayCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.overlayCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.overlayCanvas.addEventListener('mouseup', () => this.handleMouseUp());
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  async startCapture() {
    try {
      // ⚠️ 크롬 보안 정책: 버튼 클릭 유저 제스처(User Gesture) 유효 시간 내에 getDisplayMedia를 즉시 호출해야 합니다.
      const capturePromise = navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      this.mediaStream = await capturePromise;

      this.videoEl.srcObject = this.mediaStream;
      this.isStreaming = true;

      // 스트림 종결 감지 (사용자가 공유 중지 누름)
      this.mediaStream.getVideoTracks()[0].onended = () => {
        this.stopCapture();
      };

      await this.videoEl.play();
      
      document.getElementById('screen-placeholder').classList.add('hidden');
      this.videoEl.classList.remove('hidden');
      this.analysisCanvas.classList.remove('hidden');

      this.updateStatusBadge(true);
      this.resizeCanvas();
      this.startLoop();

      return true;
    } catch (err) {
      console.error('화면 공유 실패/취소:', err);
      if (err.name !== 'NotAllowedError') {
        alert('게임 창 공유를 시작할 수 없습니다. 크롬 주소창을 재접속하신 후 다시 클릭해 주세요.');
      }
      return false;
    }
  }

  stopCapture() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isStreaming = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.videoEl.classList.add('hidden');
    this.analysisCanvas.classList.add('hidden');
    document.getElementById('screen-placeholder').classList.remove('hidden');

    this.updateStatusBadge(false);
    window.imageAnalyzer.reset();
  }

  updateStatusBadge(isConnected) {
    const badge = document.getElementById('stream-status-badge');
    const text = document.getElementById('stream-status-text');
    const startBtn = document.getElementById('btn-start-share');
    const stopBtn = document.getElementById('btn-stop-share');

    if (isConnected) {
      badge.className = 'status-badge connected';
      text.textContent = '메이플 창 분석 중';
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      badge.className = 'status-badge disconnected';
      text.textContent = '화면 공유 대기 중';
      startBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }

  resizeCanvas() {
    const container = document.getElementById('video-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.overlayCanvas.width = rect.width;
    this.overlayCanvas.height = rect.height;

    if (this.videoEl.videoWidth) {
      this.analysisCanvas.width = this.videoEl.videoWidth;
      this.analysisCanvas.height = this.videoEl.videoHeight;
    }
  }

  startLoop() {
    let lastAnalyzeTime = 0;

    const loop = (timestamp) => {
      if (!this.isStreaming) return;

      if (this.videoEl.readyState >= 2) {
        // 비디오 프레임을 캔버스에 그리기
        this.analysisCtx.drawImage(this.videoEl, 0, 0, this.analysisCanvas.width, this.analysisCanvas.height);

        // 초당 약 4~5회 화면 분석 실행 (CPU 부담 최소화)
        if (timestamp - lastAnalyzeTime > 220) {
          lastAnalyzeTime = timestamp;
          this.runAnalysis();
        }
      }

      // ROI 박스 오버레이 그리기
      this.drawRoiOverlay();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  runAnalysis() {
    const vWidth = this.analysisCanvas.width;
    const vHeight = this.analysisCanvas.height;
    if (!vWidth || !vHeight) return;

    // 1. 룬 ROI 처리
    if (document.getElementById('toggle-rune-detection')?.checked) {
      const rx = Math.floor((this.runeRoi.x / 100) * vWidth);
      const ry = Math.floor((this.runeRoi.y / 100) * vHeight);
      const rw = Math.floor((this.runeRoi.w / 100) * vWidth);
      const rh = Math.floor((this.runeRoi.h / 100) * vHeight);

      if (rw > 10 && rh > 10) {
        const runeData = this.analysisCtx.getImageData(rx, ry, rw, rh);
        window.imageAnalyzer.processRuneFrame(runeData);
      }
    }

    // 2. 팝업 ROI 처리
    if (document.getElementById('toggle-popup-detection')?.checked) {
      const px = Math.floor((this.popupRoi.x / 100) * vWidth);
      const py = Math.floor((this.popupRoi.y / 100) * vHeight);
      const pw = Math.floor((this.popupRoi.w / 100) * vWidth);
      const ph = Math.floor((this.popupRoi.h / 100) * vHeight);

      if (pw > 10 && ph > 10) {
        const popupData = this.analysisCtx.getImageData(px, py, pw, ph);
        window.imageAnalyzer.processPopupFrame(popupData);
      }
    }
  }

    // 3. 솔 야누스 버프 ROI 처리
    if (document.getElementById('toggle-janus-detection')?.checked) {
      const jx = Math.floor((this.janusRoi.x / 100) * vWidth);
      const jy = Math.floor((this.janusRoi.y / 100) * vHeight);
      const jw = Math.floor((this.janusRoi.w / 100) * vWidth);
      const jh = Math.floor((this.janusRoi.h / 100) * vHeight);

      if (jw > 10 && jh > 10) {
        const janusData = this.analysisCtx.getImageData(jx, jy, jw, jh);
        window.imageAnalyzer.processJanusFrame(janusData);
      }
    }
  }

  /* ===================================================
   * ROI 드래그 및 박스 그리기
   * =================================================== */
  setSelectionMode(target) {
    this.selectingTarget = target;
    this.overlayCanvas.style.cursor = 'crosshair';
  }

  handleMouseDown(e) {
    if (!this.selectingTarget) return;

    const rect = this.overlayCanvas.getBoundingClientRect();
    this.isDragging = true;
    this.dragStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.dragCurrent = { ...this.dragStart };
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;

    const rect = this.overlayCanvas.getBoundingClientRect();
    this.dragCurrent = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  handleMouseUp() {
    if (!this.isDragging || !this.selectingTarget) return;

    this.isDragging = false;
    const cWidth = this.overlayCanvas.width;
    const cHeight = this.overlayCanvas.height;

    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
    const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
    const h = Math.abs(this.dragCurrent.y - this.dragStart.y);

    if (w > 15 && h > 15) {
      const roiPercent = {
        x: Math.round((x1 / cWidth) * 100),
        y: Math.round((y1 / cHeight) * 100),
        w: Math.round((w / cWidth) * 100),
        h: Math.round((h / cHeight) * 100)
      };

      if (this.selectingTarget === 'rune') {
        this.runeRoi = roiPercent;
      } else if (this.selectingTarget === 'popup') {
        this.popupRoi = roiPercent;
      } else if (this.selectingTarget === 'janus') {
        this.janusRoi = roiPercent;
      }

      // 설정 저장
      const cfg = window.storageManager.loadConfig();
      cfg.runeRoi = this.runeRoi;
      cfg.popupRoi = this.popupRoi;
      cfg.janusRoi = this.janusRoi;
      window.storageManager.saveConfig(cfg);

      window.imageAnalyzer.reset();
    }

    this.selectingTarget = null;
    this.overlayCanvas.style.cursor = 'default';
  }

  drawRoiOverlay() {
    const ctx = this.overlayCtx;
    const cWidth = this.overlayCanvas.width;
    const cHeight = this.overlayCanvas.height;

    ctx.clearRect(0, 0, cWidth, cHeight);

    // 1. 룬 ROI 박스
    if (document.getElementById('toggle-rune-detection')?.checked) {
      const rx = (this.runeRoi.x / 100) * cWidth;
      const ry = (this.runeRoi.y / 100) * cHeight;
      const rw = (this.runeRoi.w / 100) * cWidth;
      const rh = (this.runeRoi.h / 100) * cHeight;

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.fillRect(rx, ry, rw, rh);

      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 12px Pretendard';
      ctx.fillText('룬 감지 영역 (미니맵)', rx + 6, ry + 16);
    }

    // 2. 팝업 ROI 박스
    if (document.getElementById('toggle-popup-detection')?.checked) {
      const px = (this.popupRoi.x / 100) * cWidth;
      const py = (this.popupRoi.y / 100) * cHeight;
      const pw = (this.popupRoi.w / 100) * cWidth;
      const ph = (this.popupRoi.h / 100) * cHeight;

      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px, py, pw, ph);

      ctx.fillStyle = 'rgba(255, 165, 2, 0.15)';
      ctx.fillRect(px, py, pw, ph);

      ctx.fillStyle = '#ffa502';
      ctx.font = 'bold 12px Pretendard';
      ctx.fillText('팝업/거탐 영역', px + 6, py + 16);
    }

    // 3. 솔 야누스 버프 ROI 박스
    if (document.getElementById('toggle-janus-detection')?.checked) {
      const jx = (this.janusRoi.x / 100) * cWidth;
      const jy = (this.janusRoi.y / 100) * cHeight;
      const jw = (this.janusRoi.w / 100) * cWidth;
      const jh = (this.janusRoi.h / 100) * cHeight;

      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(jx, jy, jw, jh);

      ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.fillRect(jx, jy, jw, jh);

      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 12px Pretendard';
      ctx.fillText('야누스 버프 영역', jx + 6, jy + 16);
    }

    // 3. 현재 드래그 중인 임시 박스
    if (this.isDragging) {
      const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
      const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
      const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
      const h = Math.abs(this.dragCurrent.y - this.dragStart.y);

      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(x1, y1, w, h);
    }
  }
}

window.screenCaptureManager = new ScreenCaptureManager();
