import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperienceTracker,AlertGate} from '../js/monitors/state.js';
test('unreadable experience and capture gaps cannot trigger a stalled alert',()=>{const t=new ExperienceTracker();const r={recognizedText:'123 [1.23%]',confidence:.9};assert.equal(t.observe(r,1000,3).stalled,false);assert.equal(t.observe(r,4000,3).stalled,true);assert.equal(t.observe(null,5000,3).stalled,false);assert.equal(t.observe(r,6000,3).stalled,false);assert.equal(t.observe(r,20000,3).stalled,false);});
test('experience changes restart the stall window',()=>{const t=new ExperienceTracker();t.observe({recognizedText:'1',confidence:.9},1000,3);assert.equal(t.observe({recognizedText:'2',confidence:.9},4000,3).stalled,false);assert.equal(t.observe({recognizedText:'2',confidence:.9},7000,3).stalled,true);});
test('parallel rune signals deduplicate until cleared; repeat interval is respected',()=>{const g=new AlertGate();assert.equal(g.accept('rune',true,1000),true);assert.equal(g.accept('rune',true,1100),false);assert.equal(g.accept('rune',true,4000,3),true);g.accept('rune',false,4100);assert.equal(g.accept('rune',true,4200),true);});
