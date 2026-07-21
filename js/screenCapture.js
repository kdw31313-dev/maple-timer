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
    // 1) 브라우저 WebRTC 화면 공유 API 지원 여부 체크
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      alert('⚠️ 현재 사용 중인 브라우저/환경에서는 화면 공유(getDisplayMedia) API를 지원하지 않거나 보안 연결(HTTPS)이 아닙니다.\n\n크롬(Chrome), 엣지(Edge), 또는 웨일(Whale) 브라우저 최신 버전으로 접속해 주세요.');
      return false;
    }

    try {
      // 2) 브라우저 화면 공유 요청 (동기 트리거)
      const capturePromise = navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window'
        },
        audio: false
      }).catch(err => {
        // 호환성 에러 발생 시 비디오 옵션 없이 재시도
        console.warn('displaySurface 옵션 거부됨, 기본 옵션 재시도:', err);
        return navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
      });

      this.mediaStream = await capturePromise;

      if (!this.mediaStream) {
        return false;
      }

      this.videoEl.srcObject = this.mediaStream;
      this.isStreaming = true;

      // 스트림 종결 감지 (사용자가 공유 중지 누름)
      const videoTrack = this.mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopCapture();
        };
      }

      await this.videoEl.play();
      
      const placeholder = document.getElementById('screen-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
      if (this.videoEl) this.videoEl.classList.remove('hidden');
      if (this.analysisCanvas) this.analysisCanvas.classList.remove('hidden');

      this.updateStatusBadge(true);
      this.resizeCanvas();
      this.startLoop();

      return true;
    } catch (err) {
      console.error('화면 공유 실패/취소 상세 원인:', err);

      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        // 사용자가 취소 버튼을 누르거나 권한을 거부함
        console.log('사용자가 화면 공유 선택을 취소했거나 권한을 거부함');
      } else {
        alert(`⚠️ 화면 공유 팝업 실패 원인: [${err.name || '오류'}]\n${err.message || ''}\n\n은행/게임 보안 프로그램(nProtect, AhnLab Safe Transaction 등)이 화면 캡처를 차단하고 있거나, 크롬 확장 프로그램과의 충돌일 수 있습니다.`);
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
      text.textContent = isConnected ? '게임 화면 연결됨 (감지 중)' : '연결 안 됨';
    }
    if (startBtn) startBtn.classList.toggle('hidden', isConnected);
    if (stopBtn) stopBtn.classList.toggle('hidden', !isConnected);
  }

  setSelectingTarget(target) {
    this.selectingTarget = target;
    const overlay = this.overlayCanvas;
    if (overlay) {
      overlay.style.cursor = target ? 'crosshair' : 'default';
    }
  }

  handleMouseDown(e) {
    if (!this.selectingTarget || !this.isStreaming) return;
    const rect = this.overlayCanvas.getBoundingClientRect();
    this.isDragging = true;
    this.dragStart = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
    this.dragCurrent = { ...this.dragStart };
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.selectingTarget) return;
    const rect = this.overlayCanvas.getBoundingClientRect();
    this.dragCurrent = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    };
    this.drawOverlay();
  }

  handleMouseUp() {
    if (!this.isDragging || !this.selectingTarget) return;
    this.isDragging = false;

    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
    const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
    const h = Math.abs(this.dragCurrent.y - this.dragStart.y);

    if (w > 0.02 && h > 0.02) {
      const roiObj = {
        x: Math.round(x1 * 100),
        y: Math.round(y1 * 100),
        w: Math.round(w * 100),
        h: Math.round(h * 100)
      };

      if (this.selectingTarget === 'rune') {
        this.runeRoi = roiObj;
      } else if (this.selectingTarget === 'popup') {
        this.popupRoi = roiObj;
      } else if (this.selectingTarget === 'janus') {
        this.janusRoi = roiObj;
      }
    }

    this.selectingTarget = null;
    this.overlayCanvas.style.cursor = 'default';
    this.drawOverlay();
  }

  resizeCanvas() {
    if (!this.videoEl || !this.analysisCanvas || !this.overlayCanvas) return;
    const width = this.videoEl.videoWidth || 1280;
    const height = this.videoEl.videoHeight || 720;

    this.analysisCanvas.width = width;
    this.analysisCanvas.height = height;

    const rect = this.videoEl.getBoundingClientRect();
    this.overlayCanvas.width = rect.width;
    this.overlayCanvas.height = rect.height;

    this.drawOverlay();
  }

  drawOverlay() {
    if (!this.overlayCtx) return;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    this.overlayCtx.clearRect(0, 0, w, h);

    if (!this.isStreaming) return;

    // 1) 룬 영역 (분홍색 라인)
    this.drawRoiBox(this.runeRoi, 'rgba(255, 0, 128, 0.8)', '📍 미니맵 (룬/거탐)');
    // 2) 버프 영역 (보라색 라인)
    this.drawRoiBox(this.janusRoi, 'rgba(155, 89, 182, 0.8)', '⚡ 버프 영역 (야누스/경쿠)');

    // 드래그 중인 영역 그리드
    if (this.isDragging) {
      const x = Math.min(this.dragStart.x, this.dragCurrent.x) * w;
      const y = Math.min(this.dragStart.y, this.dragCurrent.y) * h;
      const rw = Math.abs(this.dragCurrent.x - this.dragStart.x) * w;
      const rh = Math.abs(this.dragCurrent.y - this.dragStart.y) * h;

      this.overlayCtx.strokeStyle = '#00f2fe';
      this.overlayCtx.lineWidth = 2;
      this.overlayCtx.setLineDash([4, 4]);
      this.overlayCtx.strokeRect(x, y, rw, rh);
      this.overlayCtx.setLineDash([]);
    }
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
    const loop = () => {
      if (!this.isStreaming) return;

      if (this.videoEl.readyState === this.videoEl.HAVE_ENOUGH_DATA) {
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

        // 이미지 감지 엔진 호출
        if (window.imageAnalyzer) {
          window.imageAnalyzer.analyzeFrame(imageData, {
            runeRoi: this.runeRoi,
            popupRoi: this.popupRoi,
            janusRoi: this.janusRoi
          });
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }
}

window.screenCaptureManager = new ScreenCaptureManager();
