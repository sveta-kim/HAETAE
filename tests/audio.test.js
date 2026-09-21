import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';

function setAudioSupport(t, AudioContextClass) {
  for (const [name, value] of [['AudioContext', AudioContextClass], ['webkitAudioContext', undefined]]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
}

function audioFixture(t, { resumeFails = false } = {}) {
  const contexts = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    cancelScheduledValues() {},
    setTargetAtTime(value) { this.value = value; },
  });
  const node = () => ({
    gain: parameter(), frequency: parameter(), Q: parameter(),
    started: 0, stopped: 0, disconnected: 0,
    connect(next) { return next; },
    disconnect() { this.disconnected += 1; },
    start() { this.started += 1; },
    stop() { this.stopped += 1; },
  });
  class MockAudioContext {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 1000;
      this.destination = node(); this.nodes = []; this.resumes = 0; this.closes = 0;
      contexts.push(this);
    }
    createNode() { const value = node(); this.nodes.push(value); return value; }
    createGain() { return this.createNode(); }
    createOscillator() { return this.createNode(); }
    createBufferSource() { return this.createNode(); }
    createBiquadFilter() { return this.createNode(); }
    createBuffer(channels, count, sampleRate) {
      const data = new Float32Array(count);
      return { numberOfChannels: channels, sampleRate, length: count, getChannelData: () => data };
    }
    async resume() {
      this.resumes += 1;
      if (resumeFails) throw new Error('Audio device unavailable');
      this.state = 'running';
    }
    async close() { this.closes += 1; this.state = 'closed'; }
  }
  setAudioSupport(t, MockAudioContext);
  const audio = new AudioEngine();
  t.after(() => audio.destroy());
  return { audio, contexts };
}

test('audio remains inert until a gesture explicitly unlocks it', async t => {
  const { audio, contexts } = audioFixture(t);
  assert.equal(contexts.length, 0);
  assert.equal(audio.play('attack'), false);
  audio.setEnabled(false);
  assert.equal(contexts.length, 0);
  assert.equal(await audio.unlock(), true);
  assert.equal(contexts.length, 1);
  assert.equal(audio.master.gain.value, 0);
  assert.equal(audio.play('attack'), false);
});

test('unlock resumes audio and starts one rain/drone bed without duplicating it', async t => {
  const { audio, contexts } = audioFixture(t);
  assert.equal(await audio.unlock(), true);
  const ambient = [...audio.ambient];
  assert.equal(ambient.length, 7);
  assert.equal(audio.noiseBuffer.length, contexts[0].sampleRate * 2);
  assert.equal(audio.noiseBuffer.numberOfChannels, 1);
  assert.equal(await audio.unlock(), true);
  assert.deepEqual(audio.ambient, ambient);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumes, 1);
});

test('all gameplay effects and aliases create finite voices', async t => {
  const { audio } = audioFixture(t);
  await audio.unlock();
  for (const name of ['attack', 'jump', 'dash', 'cast', 'hit', 'kill', 'boss', 'memory', 'checkpoint', 'ending', 'player-hit', 'boss_phase', 'double jump', 'enchant']) {
    for (const voice of [...audio.voices]) voice.onended();
    assert.equal(audio.play(name), true, name);
    assert.ok(audio.voices.size > 0, name);
    assert.ok([...audio.voices].every(voice => voice.started === 1 && voice.stopped === 1), name);
  }
  assert.equal(audio.play('unknown'), false);
  assert.equal(audio.play(null), false);
});

test('mute smoothly lowers the master output and suppresses new effects', async t => {
  const { audio } = audioFixture(t);
  await audio.unlock();
  audio.setEnabled(false);
  assert.equal(audio.master.gain.value, 0);
  assert.equal(audio.play('attack'), false);
  audio.setEnabled(true);
  assert.equal(audio.master.gain.value, 0.32);
  assert.equal(audio.play('attack'), true);
});

test('finished effects release graph nodes and dense battles have bounded voices', async t => {
  const { audio } = audioFixture(t);
  await audio.unlock();
  audio.play('jump');
  const voice = [...audio.voices][0];
  voice.onended();
  assert.equal(audio.voices.size, 0);
  assert.equal(voice.disconnected, 1);
  for (let count = 0; count < 50; count += 1) audio.play('ending');
  assert.ok(audio.voices.size <= 33);
  assert.equal(audio.play('attack'), false);
});

test('missing audio support never blocks gameplay', async t => {
  setAudioSupport(t, undefined);
  const unsupported = new AudioEngine();
  assert.equal(await unsupported.unlock(), false);
  assert.equal(unsupported.play('attack'), false);
  unsupported.destroy();
});

test('device resume failures never block gameplay', async t => {
  const { audio } = audioFixture(t, { resumeFails: true });
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.play('attack'), false);
  assert.equal(audio.ambient.length, 0);
});

test('destroy stops ambient and effects, closes once, and cannot unlock again', async t => {
  const { audio, contexts } = audioFixture(t);
  await audio.unlock();
  audio.play('cast');
  const nodes = [...audio.ambient, ...audio.voices];
  audio.destroy();
  audio.destroy();
  assert.equal(contexts[0].closes, 1);
  assert.equal(audio.ambient.length, 0);
  assert.equal(audio.voices.size, 0);
  assert.ok(nodes.every(value => value.disconnected > 0));
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.play('attack'), false);
});
