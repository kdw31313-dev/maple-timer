/**
 * AudioNotifier - Web Audio API 및 SpeechSynthesis 기반 사운드/음성/시각 알림 시스템
 */
class AudioNotifier {
  constructor() {
    this.audioCtx = null;
    this.volume = 0.8;
    this.preset = 'chime';
    this.useTTS = true;
    this.useFlash = true;
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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
   * 알림 발생 (사운드 + TTS + 시각 플래시)
   */
  notify(message, customPreset = null) {
    this.initAudioContext();
    const presetToUse = customPreset || this.preset;

    // 1. 사운드 플레이
    this.playSoundPreset(presetToUse);

    // 2. 음성 안내 (TTS)
    if (this.useTTS && message && 'speechSynthesis' in window) {
      setTimeout(() => {
        this.speak(message);
      }, 200);
    }

    // 3. 시각 깜빡임 (Flash)
    if (this.useFlash) {
      this.triggerFlash();
    }
  }

  playSoundPreset(preset) {
    if (!this.audioCtx || this.volume <= 0) return;

    const now = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(this.audioCtx.destination);

    switch (preset) {
      case 'chime':
        // 맑은 차임벨 2음 (E5 -> B5)
        this.playNote(masterGain, 659.25, now, 0.3, 'sine');
        this.playNote(masterGain, 987.77, now + 0.15, 0.4, 'sine');
        break;

      case 'beep':
        // 표준 비프음
        this.playNote(masterGain, 880, now, 0.15, 'square');
        this.playNote(masterGain, 880, now + 0.2, 0.15, 'square');
        break;

      case 'rune':
        // 룬 감지 신비로운 3음 (A4 -> C#5 -> E5)
        this.playNote(masterGain, 440.00, now, 0.25, 'triangle');
        this.playNote(masterGain, 554.37, now + 0.12, 0.25, 'triangle');
        this.playNote(masterGain, 659.25, now + 0.24, 0.4, 'triangle');
        break;

      case 'siren':
        // 경고 사이렌 (고주파 교차)
        for (let i = 0; i < 3; i++) {
          this.playNote(masterGain, 1046.50, now + (i * 0.15), 0.1, 'sawtooth');
          this.playNote(masterGain, 1318.51, now + (i * 0.15) + 0.07, 0.1, 'sawtooth');
        }
        break;
    }
  }

  playNote(destination, freq, startTime, duration, type = 'sine') {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Fade out
    gain.gain.setValueAtTime(1.0, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  speak(text) {
    try {
      window.speechSynthesis.cancel(); // 이전 음성 중단
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.1; // 약간 빠르게
      utterance.volume = this.volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS 재생 예외:', e);
    }
  }

  triggerFlash() {
    const overlay = document.getElementById('flash-overlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    // 애니메이션 후 자동 제거
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 1500);
  }
}

window.audioNotifier = new AudioNotifier();
