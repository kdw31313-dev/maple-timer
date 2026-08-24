#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const 프로젝트폴더 = path.resolve(__dirname, '..');
const 새캔버스 = () => ({
  width: 0,
  height: 0,
  style: {},
  getContext() {
    return {
      clearRect() {},
      drawImage() {},
      fillRect() {},
      fillText() {},
      getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
      measureText() { return { width: 10 }; },
      setLineDash() {},
      strokeRect() {}
    };
  },
  addEventListener() {},
  getBoundingClientRect() { return { width: 1600, height: 900 }; }
});

global.window = global;
global.addEventListener = () => {};
global.document = {
  getElementById(id) {
    if (id === 'game-video') {
      return { videoWidth: 1600, videoHeight: 900, getBoundingClientRect() { return { width: 1600, height: 900 }; } };
    }
    if (id === 'analysis-canvas' || id === 'roi-overlay-canvas') return 새캔버스();
    return null;
  },
  createElement(tag) { return tag === 'canvas' ? 새캔버스() : {}; }
};

class 가짜채널 {
  constructor(label) {
    this.label = label;
    this.readyState = 'open';
    this.closed = false;
  }
  close() {
    this.closed = true;
    this.readyState = 'closed';
  }
}

class 가짜연결 {
  static 목록 = [];
  static 송신채널 = null;

  constructor(config) {
    this.config = config;
    this.closed = false;
    가짜연결.목록.push(this);
  }
  createDataChannel(label) {
    가짜연결.송신채널 = new 가짜채널(label);
    return 가짜연결.송신채널;
  }
  async createOffer() { return { type: 'offer', sdp: 'local' }; }
  async createAnswer() { return { type: 'answer', sdp: 'local' }; }
  async setLocalDescription() {}
  async setRemoteDescription(description) {
    if (description.type === 'answer') {
      const receiver = 가짜연결.목록[1];
      receiver.ondatachannel?.({ channel: new 가짜채널('maple-background-guard') });
    }
  }
  async addIceCandidate() {}
  close() { this.closed = true; }
}

global.RTCPeerConnection = 가짜연결;
require(path.join(프로젝트폴더, 'js', 'screenCapture.js'));

(async () => {
  const 관리자 = global.screenCaptureManager;
  관리자.isStreaming = true;
  assert.equal(await 관리자.startBackgroundTimerGuard(), true, '백그라운드 감시 연결이 열리지 않았습니다.');
  assert.equal(가짜연결.목록.length, 2, '로컬 송수신 연결 두 개가 생성되지 않았습니다.');
  assert.deepEqual(가짜연결.목록[0].config, { iceServers: [] }, '외부 서버 없는 로컬 연결이 아닙니다.');
  assert.equal(관리자.backgroundGuardPeers.sendChannel.label, 'maple-background-guard');

  const 열린연결 = 관리자.backgroundGuardPeers;
  관리자.stopBackgroundTimerGuard();
  assert.equal(관리자.backgroundGuardPeers, null, '감시 종료 후 연결 참조가 남아 있습니다.');
  assert.equal(열린연결.sendChannel.closed, true, '송신 채널이 닫히지 않았습니다.');
  assert.equal(열린연결.receiveChannel.closed, true, '수신 채널이 닫히지 않았습니다.');
  assert.equal(열린연결.sender.closed, true, '송신 연결이 닫히지 않았습니다.');
  assert.equal(열린연결.receiver.closed, true, '수신 연결이 닫히지 않았습니다.');

  console.log('✅ 백그라운드 감시 회귀 통과: 로컬 실시간 채널 생성·정리 확인');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
