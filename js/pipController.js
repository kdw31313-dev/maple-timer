/**
 * PipController - Picture-in-Picture 플로팅 사냥 오버레이 관리자
 */
class PipController {
  constructor() {
    this.pipWindow = null;
    this.pipCanvas = document.createElement('canvas');
    this.pipCanvas.width = 360;
    this.pipCanvas.height = 200;
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
          height: 220
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
          .timer-box {
            background: rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 8px 12px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .timer-label { font-size: 11px; color: #a4b0be; font-weight: bold; }
          .timer-value { font-size: 24px; font-weight: 900; font-family: monospace; color: #00f2fe; }
          .janus-val { color: #e056fd; }
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
          <div class="timer-box">
            <div class="timer-label">🧪 경험치 쿠폰</div>
            <div class="timer-value" id="pip-exp-clock">30:00</div>
          </div>
          <div class="timer-box">
            <div class="timer-label">🌌 솔 야누스 (80s)</div>
            <div class="timer-value janus-val" id="pip-janus-clock">01:20</div>
          </div>
          <div class="timer-box" style="padding:6px 10px;">
            <div class="timer-label">💰 재획비: <span id="pip-wealth-clock" style="color:#f6d365;">02:00:00</span> | 📢 MVP: <span id="pip-mvp-clock" style="color:#00f2fe;">30:00</span></div>
          </div>
          <div style="display:flex; justify-between; gap:6px;">
            <span class="alert-pill" id="pip-rune-pill">룬: 대기</span>
            <span class="alert-pill" id="pip-popup-pill">팝업: 대기</span>
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
      
      const expClock = document.getElementById('exp-timer-clock')?.textContent;
      const janusClock = document.getElementById('janus-timer-clock')?.textContent;
      const wealthClock = document.getElementById('doping-wealth-clock')?.textContent;
      const mvpClock = document.getElementById('doping-mvp-clock')?.textContent;
      const runeText = document.getElementById('rune-status-pill')?.textContent;
      const popupText = document.getElementById('popup-status-pill')?.textContent;

      const pipExp = this.pipWindow.document.getElementById('pip-exp-clock');
      const pipJanus = this.pipWindow.document.getElementById('pip-janus-clock');
      const pipWealth = this.pipWindow.document.getElementById('pip-wealth-clock');
      const pipMvp = this.pipWindow.document.getElementById('pip-mvp-clock');
      const pipRune = this.pipWindow.document.getElementById('pip-rune-pill');
      const pipPopup = this.pipWindow.document.getElementById('pip-popup-pill');

      if (pipExp && expClock) pipExp.textContent = expClock;
      if (pipJanus && janusClock) pipJanus.textContent = janusClock;
      if (pipWealth && wealthClock) pipWealth.textContent = wealthClock;
      if (pipMvp && mvpClock) pipMvp.textContent = mvpClock;
      
      if (pipRune && runeText) {
        pipRune.textContent = `룬: ${runeText}`;
        pipRune.className = runeText.includes('감지') ? 'alert-pill warn' : 'alert-pill';
      }
      if (pipPopup && popupText) {
        pipPopup.textContent = `팝업: ${popupText}`;
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

      const expClock = document.getElementById('exp-timer-clock')?.textContent || '30:00';
      const janusClock = document.getElementById('janus-timer-clock')?.textContent || '01:20';

      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#a4b0be';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('경험치 쿠폰', 16, 30);

      ctx.fillStyle = '#00f2fe';
      ctx.font = 'bold 36px monospace';
      ctx.fillText(expClock, 16, 70);

      ctx.fillStyle = '#a4b0be';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('솔 야누스', 16, 110);

      ctx.fillStyle = '#e056fd';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(janusClock, 16, 150);
    }, 200);
  }
}

window.pipController = new PipController();
