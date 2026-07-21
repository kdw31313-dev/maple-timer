/**
 * AudioNotifier - 크롬 백그라운드 탭 사운드 & TTS 음성 강력 보장 모듈
 */
class AudioNotifier {
  constructor() {
    this.audioCtx = null;
    this.volume = 1.0; // 기본 100% 볼륨
    this.preset = 'chime';
    this.useTTS = false; // 🔇 TTS 음성 읽기는 기본 비활성화 (기능은 유지)
    this.useFlash = true;

    // 🔊 항목별 사용자 지정 효과음 프리셋 매핑
    this.customSounds = {
      rune: 'rune',     // 📍 미니맵 룬
      popup: 'siren',   // 🚨 거짓말 탐지기
      janus: 'beep',    // ⚡ 솔 야누스
      exp: 'chime'      // 🍁 30분 사냥 도핑
    };
  }

  setCustomSound(category, presetName) {
    if (this.customSounds[category] !== undefined && presetName) {
      this.customSounds[category] = presetName;
    }
  }

  getCustomSound(category) {
    return this.customSounds[category] || 'chime';
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(e => console.log('AudioContext resume:', e));
    }
  }

  setVolume(percent) {
    this.volume = Math.max(0, Math.min(1, percent / 100));
  }

  setPreset(presetName) {
    this.preset = presetName;
  }

  setTTS(enabled) {
    this.useTTS = enabled;
  }

  setFlash(enabled) {
    this.useFlash = enabled;
  }

  /**
   * 🚨 백그라운드 탭에서도 100% 울리는 사운드 & 음성 통지
   */
  notify(message, category = 'chime') {
    this.initAudioContext();
    // category가 customSounds 키에 해당하는 경우 사용자 지정 음원 사용
    const presetToUse = this.customSounds[category] || category || this.preset;

    // 1. Web Audio API 사운드 (크롬 백그라운드 탭에서도 100% 차단 없이 플레이!)
    this.playSoundPreset(presetToUse);

    // 룬 또는 거탐 비상 알림일 경우 사운드 2차 연타 출력 (백그라운드 사운드 강조)
    if (category === 'rune' || category === 'popup' || presetToUse === 'siren' || presetToUse === 'rune') {
      setTimeout(() => {
        this.playSoundPreset(presetToUse);
      }, 400);
    }

    // 2. 음성 안내 (TTS - 크롬 백그라운드 큐 지연 해제 cancel 처리)
    if (this.useTTS && message && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // 백그라운드 큐 멈춤 해제
        setTimeout(() => {
          this.speak(message);
        }, 100);
      } catch (e) {
        console.warn('SpeechSynthesis error:', e);
      }
    }

    // 3. 시각 깜빡임 (Flash)
    if (this.useFlash) {
      this.triggerFlash();
    }
  }

  playSoundPreset(preset) {
    this.initAudioContext();
    if (!this.audioCtx || this.volume <= 0) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(this.audioCtx.destination);

    switch (preset) {
      case 'chime':
        this.playNote(masterGain, 659.25, now, 0.3, 'sine');
        this.playNote(masterGain, 987.77, now + 0.15, 0.4, 'sine');
        break;

      case 'beep':
        this.playNote(masterGain, 880, now, 0.15, 'square');
        this.playNote(masterGain, 880, now + 0.2, 0.15, 'square');
        break;

      case 'rune':
        // 룬 감지 신비로운 3음 2연타 (A4 -> C#5 -> E5 -> A5)
        this.playNote(masterGain, 440.00, now, 0.2, 'triangle');
        this.playNote(masterGain, 554.37, now + 0.1, 0.2, 'triangle');
        this.playNote(masterGain, 659.25, now + 0.2, 0.3, 'triangle');
        this.playNote(masterGain, 880.00, now + 0.3, 0.4, 'triangle');
        break;

      case 'siren':
        for (let i = 0; i < 4; i++) {
          this.playNote(masterGain, 1046.50, now + (i * 0.12), 0.1, 'sawtooth');
          this.playNote(masterGain, 1318.51, now + (i * 0.12) + 0.06, 0.1, 'sawtooth');
        }
        break;

      case 'bell':
        // 🔔 딩-동 듀얼 벨 (C5 -> G5)
        this.playNote(masterGain, 523.25, now, 0.35, 'sine');
        this.playNote(masterGain, 783.99, now + 0.18, 0.45, 'sine');
        break;

      case 'harp':
        // 🎶 하프 아르페지오 (C5 -> E5 -> G5 -> C6)
        this.playNote(masterGain, 523.25, now, 0.15, 'triangle');
        this.playNote(masterGain, 659.25, now + 0.08, 0.15, 'triangle');
        this.playNote(masterGain, 783.99, now + 0.16, 0.15, 'triangle');
        this.playNote(masterGain, 1046.50, now + 0.24, 0.35, 'triangle');
        break;
    }
  }

  playNote(masterGain, freq, startTime, duration, type = 'sine') {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0.01, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.9, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      console.warn('playNote error:', e);
    }
  }

  speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.05;
      utterance.volume = this.volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('speak error:', e);
    }
  }

  triggerFlash() {
    const overlay = document.getElementById('flash-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
    }, 1200);
  }
}

window.audioNotifier = new AudioNotifier();
