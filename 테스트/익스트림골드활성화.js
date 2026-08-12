#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

class 메모리저장소 {
  constructor() {
    this.값 = new Map();
  }

  getItem(키) {
    return this.값.has(키) ? this.값.get(키) : null;
  }

  setItem(키, 값) {
    this.값.set(키, String(값));
  }

  removeItem(키) {
    this.값.delete(키);
  }

  clear() {
    this.값.clear();
  }
}

global.window = global;
global.localStorage = new 메모리저장소();
require(path.resolve(__dirname, '..', 'js', 'storage.js'));

const 저장소 = window.storageManager;

// 과거 배포가 저장한 꺼짐 값은 활성화 배포를 처음 열 때 한 번만 켠다.
localStorage.setItem(저장소.STORAGE_KEY, JSON.stringify({ expAutoDetectionEnabled: false }));
const 이전완료 = 저장소.loadConfig();
assert.equal(이전완료.expAutoDetectionEnabled, true);
assert.equal(localStorage.getItem(저장소.EXP_ALERT_ACTIVATION_KEY), 'enabled');
assert.equal(JSON.parse(localStorage.getItem(저장소.STORAGE_KEY)).expAutoDetectionEnabled, true);

// 첫 활성화 이후 사용자가 직접 끈 선택은 다시 강제로 켜지지 않는다.
저장소.saveConfig({ ...이전완료, expAutoDetectionEnabled: false });
const 사용자선택 = 저장소.loadConfig();
assert.equal(사용자선택.expAutoDetectionEnabled, false);

// 신규 설치는 별도 설정 없이 바로 켜진다.
localStorage.clear();
const 신규설치 = 저장소.loadConfig();
assert.equal(신규설치.expAutoDetectionEnabled, true);

console.log('익스트림 골드 활성화 이전 3/3 통과');
