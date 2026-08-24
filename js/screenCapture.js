/**
 * ScreenCaptureManager - 룬·거짓말 탐지기 저부하 화면 분석 모듈
 */
class ScreenCaptureManager {
  constructor() {
    this.mediaStream = null;
    this.videoEl = document.getElementById('game-video');
    this.analysisCanvas = document.getElementById('analysis-canvas');
    this.overlayCanvas = document.getElementById('roi-overlay-canvas');
    
    this.analysisCtx = this.analysisCanvas ? this.analysisCanvas.getContext('2d', { willReadFrequently: true }) : null;
    this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;

    // 초경량 마이크로 ROI 캔버스
    this.runeCanvas = document.createElement('canvas');
    this.runeCtx = this.runeCanvas.getContext('2d', { willReadFrequently: true });

    // 🚨 거탐 전체 화면 다운샘플링 캔버스 (240x135 해상도)
    this.popupCanvas = document.createElement('canvas');
    this.popupCanvas.width = 240;
    this.popupCanvas.height = 135;
    this.popupCtx = this.popupCanvas.getContext('2d', { willReadFrequently: true });
    this.popupPreviewCanvas = document.createElement('canvas');
    // 240x135의 60% 크기. 50%에서는 실제 두 자리 숫자와 네 문장이 한두
    // 픽셀로 뭉쳐 사라졌지만, 이 크기에서는 구조를 보존하면서 픽셀 수는 36%다.
    this.popupPreviewCanvas.width = 144;
    this.popupPreviewCanvas.height = 81;
    this.popupPreviewCtx = this.popupPreviewCanvas.getContext('2d', { willReadFrequently: true });

    this.isStreaming = false;
    this.loopIntervalId = null;
    this.analysisTick = 0;
    this.backgroundGuardPeers = null;
    this.backgroundGuardStarting = null;
    // 룬은 150ms마다, 거탐은 300ms마다 검사한다. 버프 분석은 수행하지 않는다.

    // ⚡ 1사분면 무설정 자동 캡처 범위 (% 비율 단위 - 1사분면 최상단 1줄 제외)
    // 실제 1280x720 사냥 화면 기준 미니맵 내부 전체(제목줄 제외).
    this.runeRoi = { x: 0.3, y: 8.3, w: 14.5, h: 13 };
    this.popupRoi = { x: 0, y: 0, w: 100, h: 100 };

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
      this.overlayCanvas.addEventListener('mouseleave', () => this.handleMouseUp());
    }
    window.addEventListener('resize', () => this.resizeCanvas());

    this.initModalEvents();
  }

  handleMouseDown(e) {
    if (!this.isStreaming || !this.overlayCanvas) return;
    const rect = this.overlayCanvas.getBoundingClientRect();
    this.isDragging = true;
    this.dragStart = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
    this.dragCurrent = { ...this.dragStart };
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.overlayCanvas) return;
    const rect = this.overlayCanvas.getBoundingClientRect();
    this.dragCurrent = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    };
    this.drawOverlayWithDrag();
  }

  handleMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
    const w = Math.abs(this.dragCurrent.x - this.dragStart.x);
    const h = Math.abs(this.dragCurrent.y - this.dragStart.y);

    if (w > 0.01 && h > 0.01) {
      this.runeRoi = {
        x: Math.round(x1 * 100 * 10) / 10,
        y: Math.round(y1 * 100 * 10) / 10,
        w: Math.round(w * 100 * 10) / 10,
        h: Math.round(h * 100 * 10) / 10
      };
    }
    this.drawOverlay();
    if (window.saveCurrentConfig) window.saveCurrentConfig();
  }

  drawOverlayWithDrag() {
    this.drawOverlay();
    if (!this.isDragging || !this.overlayCtx) return;

    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x) * w;
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y) * h;
    const mw = Math.abs(this.dragCurrent.x - this.dragStart.x) * w;
    const mh = Math.abs(this.dragCurrent.y - this.dragStart.y) * h;

    this.overlayCtx.strokeStyle = '#f39c12';
    this.overlayCtx.lineWidth = 3;
    this.overlayCtx.setLineDash([4, 2]);
    this.overlayCtx.strokeRect(x1, y1, mw, mh);
    this.overlayCtx.setLineDash([]);

    this.overlayCtx.fillStyle = 'rgba(243, 156, 18, 0.2)';
    this.overlayCtx.fillRect(x1, y1, mw, mh);
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

    if (targetType !== 'rune') return;
    this.modalTarget = targetType;
    this.modalTempRoi = { ...this.runeRoi };

    const titleEl = document.getElementById('roi-modal-title');
    const subTitleEl = document.getElementById('roi-modal-subtitle');

    if (titleEl) titleEl.textContent = '📍 미니맵 영역 지정 (200% 정밀 확대)';
    if (subTitleEl) subTitleEl.textContent = '미니맵의 내부 지도 영역만 마우스 드래그로 직사각형으로 지정하세요.';

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
    const label = this.modalTarget === 'rune' ? '📍 미니맵 지도 선택 영역' : '⚡ 1사분면 버프 선택 영역';

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

    if (this.modalTarget === 'rune') this.runeRoi = { ...this.modalTempRoi };

    this.drawOverlay();
    this.closeRoiModal();
    if (window.saveCurrentConfig) window.saveCurrentConfig();
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
      this.startBackgroundTimerGuard();
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
    this.stopBackgroundTimerGuard();
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

  /**
   * Chrome은 소리·WebRTC가 없는 탭이 5분 넘게 뒤로 가면 setInterval을
   * 최악의 경우 1분마다만 확인한다. 거탐 안내창은 약 15초만 보이므로 그
   * 공백에 통째로 빠질 수 있다. 외부 서버나 영상 재인코딩 없이 로컬 데이터
   * 채널 하나만 열어 두면 백그라운드 타이머가 최소 1초 단위로 계속 깨어난다.
   */
  startBackgroundTimerGuard() {
    if (this.backgroundGuardPeers) return Promise.resolve(true);
    if (this.backgroundGuardStarting) return this.backgroundGuardStarting;
    if (typeof window.RTCPeerConnection !== 'function') return Promise.resolve(false);

    this.backgroundGuardStarting = (async () => {
      let sender = null;
      let receiver = null;
      let sendChannel = null;
      let receiveChannel = null;

      try {
        sender = new window.RTCPeerConnection({ iceServers: [] });
        receiver = new window.RTCPeerConnection({ iceServers: [] });
        sender.onicecandidate = (event) => {
          if (event.candidate) receiver.addIceCandidate(event.candidate).catch(() => {});
        };
        receiver.onicecandidate = (event) => {
          if (event.candidate) sender.addIceCandidate(event.candidate).catch(() => {});
        };

        const receiveReady = new Promise((resolve) => {
          receiver.ondatachannel = (event) => {
            receiveChannel = event.channel;
            resolve();
          };
        });
        sendChannel = sender.createDataChannel('maple-background-guard');

        const offer = await sender.createOffer();
        await sender.setLocalDescription(offer);
        await receiver.setRemoteDescription(offer);
        const answer = await receiver.createAnswer();
        await receiver.setLocalDescription(answer);
        await sender.setRemoteDescription(answer);
        await receiveReady;

        if (!this.isStreaming) {
          sendChannel.close();
          receiveChannel?.close();
          sender.close();
          receiver.close();
          return false;
        }

        this.backgroundGuardPeers = { sender, receiver, sendChannel, receiveChannel };
        return true;
      } catch (error) {
        console.warn('[백그라운드 감시] 실시간 연결 보강 실패', error);
        sendChannel?.close();
        receiveChannel?.close();
        sender?.close();
        receiver?.close();
        return false;
      } finally {
        this.backgroundGuardStarting = null;
      }
    })();

    return this.backgroundGuardStarting;
  }

  stopBackgroundTimerGuard() {
    const peers = this.backgroundGuardPeers;
    this.backgroundGuardPeers = null;
    if (!peers) return;
    peers.sendChannel?.close();
    peers.receiveChannel?.close();
    peers.sender?.close();
    peers.receiver?.close();
  }

  /**
   * 150ms 중간 틱은 절반 크기 화면에서 네 거탐 패널 템플릿과 떠다니는
   * 발동 안내 후보를 확인한다.
   * 순수 후보 탐색이라 운영 상태와 알림을 건드리지 않으며, 후보일 때만 원래
   * 240x135 색·구조·시간 정밀 판정을 당긴다.
   */
  hasPopupFastTemplateSignal(imageData) {
    if (!imageData?.data?.length || !window.imageAnalyzer?.findPopupTemplateMatch) return false;
    const raw = window.imageAnalyzer.findPopupTemplateMatch(imageData);
    if (raw?.found) return true;
    const floating = window.imageAnalyzer.findFloatingActivationFastEvidence?.(imageData);
    return Boolean(floating?.found);
  }

  updateStatusBadge(isConnected) {
    const badge = document.getElementById('stream-status-badge');
    const text = document.getElementById('stream-status-text');
    const startBtn = document.getElementById('btn-start-share');
    const stopBtn = document.getElementById('btn-stop-share');

    const runePill = document.getElementById('rune-status-pill');
    const popupPill = document.getElementById('popup-status-pill');

    if (badge) {
      badge.className = isConnected ? 'status-badge live' : 'status-badge disconnected';
    }
    if (text) {
      text.textContent = isConnected ? '🪶 룬·거탐 저부하 감지 중' : '연결 안 됨';
    }

    if (isConnected) {
      if (runePill && !window.imageAnalyzer?.runeState.isDetected) {
        runePill.textContent = '🟢 미니맵 스캔 중 (인식되지 않음)';
        runePill.className = 'status-pill active';
      }
      if (popupPill && !window.imageAnalyzer?.popupState.isDetected) {
        popupPill.textContent = '🟢 거탐 감시 중 (7개 유형 정밀 인식)';
        popupPill.className = 'status-pill active';
      }
    } else {
      if (runePill) { runePill.textContent = '⚪ 대기 중 (연결 안 됨)'; runePill.className = 'status-pill'; }
      if (popupPill) { popupPill.textContent = '⚪ 대기 중 (연결 안 됨)'; popupPill.className = 'status-pill'; }
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

    this.drawRoiBox(this.runeRoi, 'rgba(255, 0, 128, 0.9)', '📍 미니맵 (룬)');
  }

  drawRoiBox(roi, color, label, fillColor = null) {
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    const rx = (roi.x / 100) * w;
    const ry = (roi.y / 100) * h;
    const rw = (roi.w / 100) * w;
    const rh = (roi.h / 100) * h;

    if (fillColor) {
      this.overlayCtx.fillStyle = fillColor;
      this.overlayCtx.fillRect(rx, ry, rw, rh);
    }

    this.overlayCtx.strokeStyle = color;
    this.overlayCtx.lineWidth = 2.5;
    this.overlayCtx.setLineDash([6, 3]);
    this.overlayCtx.strokeRect(rx, ry, rw, rh);
    this.overlayCtx.setLineDash([]);

    // 배경 라벨 뱃지
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.font = 'bold 12px sans-serif';
    const textWidth = this.overlayCtx.measureText(label).width;
    
    const labelY = ry > 22 ? ry - 22 : ry + 2;
    this.overlayCtx.fillRect(rx, labelY, textWidth + 12, 20);

    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.fillText(label, rx + 6, labelY + 14);
  }

  captureAlertScreenshot(category = 'chime', message = '') {
    if (!this.isStreaming || !this.videoEl || this.videoEl.readyState < 2) {
      return Promise.resolve(null);
    }

    const sourceWidth = this.videoEl.videoWidth || 1280;
    const sourceHeight = this.videoEl.videoHeight || 720;
    const scale = Math.min(1, 1600 / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(this.videoEl, 0, 0, width, height);

    const categoryInfo = {
      rune: { label: '룬 탐지 영역', color: '#ff2b86', roi: this.runeRoi },
      popup: { label: '거짓말 탐지기 전체 화면 분석', color: '#ff3b30', roi: this.popupRoi }
    };
    const info = categoryInfo[category];

    if (info?.roi && category !== 'popup') {
      const x = (info.roi.x / 100) * width;
      const y = (info.roi.y / 100) * height;
      const w = (info.roi.w / 100) * width;
      const h = (info.roi.h / 100) * height;
      ctx.save();
      ctx.strokeStyle = info.color;
      ctx.lineWidth = Math.max(4, width / 320);
      ctx.setLineDash([14, 8]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.font = `bold ${Math.max(18, Math.round(width / 55))}px sans-serif`;
      const labelWidth = ctx.measureText(info.label).width;
      const labelHeight = Math.max(30, Math.round(width / 30));
      const spaceBelow = height - (y + h);
      const labelY = spaceBelow >= labelHeight + 4
        ? y + h + 4
        : Math.max(0, y - labelHeight - 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(x, labelY, labelWidth + 20, labelHeight);
      ctx.fillStyle = info.color;
      ctx.fillText(info.label, x + 10, labelY + Math.round(labelHeight * 0.72));
      ctx.restore();

      if (category === 'rune') {
        const candidates = window.imageAnalyzer?.runeState?.lastCandidates || [];
        const sourceRoiWidth = Math.max(1, this.runeCanvas.width);
        const sourceRoiHeight = Math.max(1, this.runeCanvas.height);
        ctx.save();
        ctx.strokeStyle = '#fff200';
        ctx.lineWidth = Math.max(3, width / 450);
        for (const candidate of candidates) {
          const padding = Math.max(3, width / 500);
          const candidateX = x + (candidate.x / sourceRoiWidth) * w;
          const candidateY = y + (candidate.y / sourceRoiHeight) * h;
          const candidateWidth = (candidate.width / sourceRoiWidth) * w;
          const candidateHeight = (candidate.height / sourceRoiHeight) * h;
          ctx.strokeRect(
            candidateX - padding,
            candidateY - padding,
            candidateWidth + padding * 2,
            candidateHeight + padding * 2
          );
        }
        ctx.restore();
      }

    }

    if (category === 'popup') {
      const match = window.imageAnalyzer?.popupState?.lastMatch;
      const structure = match?.structure;
      const sourceWidth = Math.max(1, this.popupCanvas.width);
      const sourceHeight = Math.max(1, this.popupCanvas.height);
      ctx.save();
      ctx.strokeStyle = '#ff3b30';
      ctx.fillStyle = '#ff3b30';
      ctx.lineWidth = Math.max(4, width / 360);
      ctx.font = `bold ${Math.max(15, Math.round(width / 70))}px sans-serif`;

      let labelX = 12;
      let labelY = Math.max(28, Math.round(width / 45));
      let label = match?.detectedType || '거짓말 탐지기 판정 위치';
      if (match?.structuralEvidence === 'circular-click-game'
          && Number.isFinite(structure?.centerX)
          && Number.isFinite(structure?.centerY)
          && Number.isFinite(structure?.radius)) {
        const centerX = (structure.centerX / sourceWidth) * width;
        const centerY = (structure.centerY / sourceHeight) * height;
        const radiusX = (structure.radius / sourceWidth) * width;
        const radiusY = (structure.radius / sourceHeight) * height;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        labelX = Math.max(8, centerX - radiusX);
        labelY = Math.max(24, centerY - radiusY - 8);
        label = `원형 후보 · 반지름편차 ${(structure.edgeRadiusDeviation || 0).toFixed(2)} · 방향일치 ${Math.round((structure.polarityConsistency || 0) * 100)}%`;
      } else if (match?.evidenceBox
          && Number.isFinite(match.evidenceBox.x)
          && Number.isFinite(match.evidenceBox.y)) {
        const boxX = (match.evidenceBox.x / sourceWidth) * width;
        const boxY = (match.evidenceBox.y / sourceHeight) * height;
        const boxWidth = (match.evidenceBox.width / sourceWidth) * width;
        const boxHeight = (match.evidenceBox.height / sourceHeight) * height;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        labelX = Math.max(8, boxX);
        labelY = Math.max(24, boxY - 8);
        if (match.structuralEvidence === 'click-instruction-panel') {
          label = `클릭 후보 · 노랑 ${structure?.totalYellow || 0}`
            + ` · 배경연속 ${Math.round((structure?.tintRatio || 0) * 100)}%`
            + ` · 가로획 ${Math.round((structure?.horizontalYellowRatio || 0) * 100)}%`;
        }
      }

      const labelWidth = ctx.measureText(label).width;
      const labelHeight = Math.max(26, Math.round(width / 48));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.86)';
      ctx.fillRect(labelX, labelY - labelHeight, labelWidth + 16, labelHeight);
      ctx.fillStyle = '#ff3b30';
      ctx.fillText(label, labelX + 8, labelY - Math.round(labelHeight * 0.25));
      ctx.restore();
    }

    const capturedAt = new Date().toLocaleString('ko-KR', { hour12: false });
    const footerHeight = Math.max(50, Math.round(width / 22));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, height - footerHeight, width, footerHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(16, Math.round(width / 62))}px sans-serif`;
    ctx.fillText(`${capturedAt} · ${message}`.slice(0, 100), 14, height - Math.round(footerHeight * 0.35));

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    });
  }

  startLoop() {
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
    }

    this.loopIntervalId = setInterval(() => {
      if (!this.isStreaming || !this.videoEl) return;
      // 게임·Chrome 부하로 버퍼가 잠깐 줄어도 현재 프레임(HAVE_CURRENT_DATA)은
      // 이미 Canvas에 그릴 수 있다. HAVE_ENOUGH_DATA(4)만 허용하면 readyState가
      // 2~3인 동안 룬·거탐 검사를 통째로 건너뛰므로, 표시 가능한 프레임부터 분석한다.
      if (this.videoEl.readyState >= this.videoEl.HAVE_CURRENT_DATA) {
        const vWidth = this.videoEl.videoWidth || 1280;
        const vHeight = this.videoEl.videoHeight || 720;

        if (window.imageAnalyzer) {
          const safelyAnalyze = (label, analyze) => {
            try {
              analyze();
            } catch (error) {
              console.error(`[${label}] 프레임 분석 실패`, error);
            }
          };

          const runeEnabled = document.getElementById('toggle-rune-detection')?.checked;
          const popupEnabled = document.getElementById('toggle-popup-detection')?.checked;

          // 룬 마이크로 ROI는 기존과 같은 150ms 주기를 유지한다.
          if (runeEnabled) {
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
            safelyAnalyze('룬', () => window.imageAnalyzer.processRuneFrame(runeImageData, null));
          }

          this.analysisTick = (this.analysisTick + 1) % 2;
          // 보이는 탭에서는 기존 300ms 저부하 주기를 유지한다. Chrome이 뒤에 있는
          // 탭의 타이머를 1초 단위로 모을 때는 매번 거탐을 검사해, 추가 2배 지연을
          // 만들지 않는다. 백그라운드에서도 전체 화면은 초당 1장뿐이라 부담이 작다.
          const popupTickDue = document.hidden || this.analysisTick === 1;
          if (popupEnabled) {
            const popupHeight = 135;
            const popupWidth = Math.max(
              180,
              Math.min(360, Math.round((vWidth / Math.max(1, vHeight)) * popupHeight))
            );
            let shouldAnalyzePopup = popupTickDue;
            if (!popupTickDue) {
              this.popupPreviewCtx.drawImage(
                this.videoEl, 0, 0, vWidth, vHeight, 0, 0,
                this.popupPreviewCanvas.width, this.popupPreviewCanvas.height
              );
              const preview = this.popupPreviewCtx.getImageData(
                0, 0, this.popupPreviewCanvas.width, this.popupPreviewCanvas.height
              );
              shouldAnalyzePopup = this.hasPopupFastTemplateSignal(preview);
            }
            if (shouldAnalyzePopup) {
              if (this.popupCanvas.width !== popupWidth || this.popupCanvas.height !== popupHeight) {
                this.popupCanvas.width = popupWidth;
                this.popupCanvas.height = popupHeight;
              }
              this.popupCtx.drawImage(
                this.videoEl, 0, 0, vWidth, vHeight, 0, 0, popupWidth, popupHeight
              );
              const popupImageData = this.popupCtx.getImageData(0, 0, popupWidth, popupHeight);
              safelyAnalyze('거짓말 탐지기', () => (
                window.imageAnalyzer.processPopupStructureFrame(popupImageData)
              ));
            }
          }
        }
      }
    }, 150);
  }
}

window.screenCaptureManager = new ScreenCaptureManager();
