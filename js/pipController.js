/**
 * PipController - Picture-in-Picture 룬·거탐 상태 오버레이 관리자
 */
class PipController {
  constructor() {
    this.pipWindow = null;
    this.pipCanvas = document.createElement('canvas');
    this.pipCanvas.width = 360;
    this.pipCanvas.height = 120;
    this.pipCtx = this.pipCanvas.getContext('2d');

    this.pipVideo = document.createElement('video');
    this.pipVideo.autoplay = true;
    this.pipVideo.muted = true;

    this.isPipActive = false;
    this.renderInterval = null;
  }

  async togglePip() {
    if (this.isPipActive) {
      this.closePip();
    } else {
      await this.openPip();
    }
  }

  async openPip() {
    try {
      // 1. Document Picture-in-Picture API 지원 여부 확인 (Chrome 111+)
      if ('documentPictureInPicture' in window) {
        this.pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 130
        });

        // 스타일 복사
        const style = document.createElement('style');
        style.textContent = `
          body {
            background: #0a0d14;
            color: #f1f2f6;
            font-family: system-ui, sans-serif;
            margin: 0;
            padding: 12px;
            box-sizing: border-box;
          }
          .pip-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .status-box {
            background: rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 8px 12px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .status-title { font-size: 12px; color: #a4b0be; font-weight: bold; }
          .alert-pill {
            display: inline-block;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 12px;
            background: #2ed573;
            color: #000;
            margin-top: 4px;
          }
          .alert-pill.warn {
            background: #ff4757;
            color: #fff;
            animation: blink 0.6s infinite alternate;
          }
          @keyframes blink { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        `;
        this.pipWindow.document.head.appendChild(style);

        const container = document.createElement('div');
        container.className = 'pip-container';
        container.innerHTML = `
          <div class="status-box">
            <div class="status-title">🪶 룬·거탐 저부하 집중 감지</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:6px;">
            <span class="alert-pill" id="pip-rune-pill">룬: 대기</span>
            <span class="alert-pill" id="pip-popup-pill">거탐: 대기</span>
          </div>
        `;
        this.pipWindow.document.body.appendChild(container);

        this.pipWindow.addEventListener('pagehide', () => {
          this.isPipActive = false;
        });

        this.isPipActive = true;
        this.startUpdateLoop();
        return;
      }

      // 2. Fallback: Canvas Video Stream PiP
      const stream = this.pipCanvas.captureStream(15);
      this.pipVideo.srcObject = stream;
      await this.pipVideo.play();
      await this.pipVideo.requestPictureInPicture();

      this.pipVideo.addEventListener('leavepictureinpicture', () => {
        this.isPipActive = false;
        if (this.renderInterval) clearInterval(this.renderInterval);
      });

      this.isPipActive = true;
      this.startCanvasRenderLoop();
    } catch (e) {
      console.error('PiP 실행 실패:', e);
      alert('PiP 브라우저 기능을 사용할 수 없거나 거부되었습니다.');
    }
  }

  closePip() {
    if (this.pipWindow) {
      this.pipWindow.close();
      this.pipWindow = null;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
    this.isPipActive = false;
    if (this.renderInterval) clearInterval(this.renderInterval);
  }

  startUpdateLoop() {
    const update = () => {
      if (!this.isPipActive || !this.pipWindow) return;
      
      const runeText = document.getElementById('rune-status-pill')?.textContent;
      const popupText = document.getElementById('popup-status-pill')?.textContent;

      const pipRune = this.pipWindow.document.getElementById('pip-rune-pill');
      const pipPopup = this.pipWindow.document.getElementById('pip-popup-pill');

      if (pipRune && runeText) {
        pipRune.textContent = `룬: ${runeText}`;
        pipRune.className = runeText.includes('감지') ? 'alert-pill warn' : 'alert-pill';
      }
      if (pipPopup && popupText) {
        pipPopup.textContent = `거탐: ${popupText}`;
        pipPopup.className = popupText.includes('감지') ? 'alert-pill warn' : 'alert-pill';
      }

      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  startCanvasRenderLoop() {
    this.renderInterval = setInterval(() => {
      if (!this.isPipActive) return;

      const ctx = this.pipCtx;
      const w = this.pipCanvas.width;
      const h = this.pipCanvas.height;

      const runeText = document.getElementById('rune-status-pill')?.textContent || '대기';
      const popupText = document.getElementById('popup-status-pill')?.textContent || '대기';

      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#a4b0be';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('🪶 룬·거탐 저부하 집중 감지', 16, 28);

      ctx.fillStyle = runeText.includes('감지') ? '#ff4757' : '#2ed573';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`룬: ${runeText}`, 16, 64);

      ctx.fillStyle = popupText.includes('감지') ? '#ff4757' : '#2ed573';
      ctx.fillText(`거탐: ${popupText}`, 16, 94);
    }, 200);
  }
}

window.pipController = new PipController();
