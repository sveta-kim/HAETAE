import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/input.js';

class Surface {
  constructor() { this.handlers = new Map(); }
  addEventListener(type, callback) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.handlers.get(type)?.delete(callback); }
  fire(type, values = {}) {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, ...values };
    for (const callback of this.handlers.get(type) || []) callback(event);
    return event;
  }
}

function fixture() {
  const window = new Surface();
  const document = new Surface();
  document.defaultView = window;
  document.hidden = false;
  document.openDialog = false;
  document.querySelector = () => document.openDialog ? {} : null;
  const element = (tag = 'canvas', attributes = {}) => {
    const node = Object.assign(new Surface(), {
      ownerDocument: document,
      dataset: {},
      isContentEditable: false,
      closest(selector) {
        const names = selector.split(',').map(value => value.trim());
        return names.includes(tag) || (this.isContentEditable && selector.includes('[contenteditable]')) ? this : null;
      },
      focus() {
        document.activeElement = this;
        document.fire('focusin', { target: this });
      },
      setPointerCapture() {},
    }, attributes);
    return node;
  };
  const canvas = element();
  canvas.width = 960; canvas.height = 540;
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 480, height: 270 });
  const left = element('button', { dataset: { input: 'left' } });
  const attack = element('button', { dataset: { input: 'attack' } });
  const ignored = element('button', { dataset: { input: 'select' } });
  document.querySelectorAll = () => [left, attack, ignored];
  document.activeElement = canvas;
  const input = new Input(canvas);
  const key = (type, code, values = {}) => window.fire(type, {
    code, target: document.activeElement, ...values,
  });
  return { window, document, element, canvas, left, attack, ignored, input, key };
}

test('movement remains held across samples and supports multiple keys for one direction', () => {
  const { input, key } = fixture();
  assert.equal(key('keydown', 'KeyA').prevented, true);
  key('keydown', 'ArrowLeft');
  key('keyup', 'KeyA');
  assert.equal(input.sample().left, true);
  assert.equal(input.sample().left, true);
  key('keyup', 'ArrowLeft');
  assert.equal(input.sample().left, false);
  key('keydown', 'KeyD');
  assert.equal(input.sample().right, true);
  input.destroy();
});

test('action edges fire once per press and never on keyboard repeat', () => {
  const { input, key } = fixture();
  for (const [code, action] of Object.entries({ Space: 'jump', KeyJ: 'attack', ShiftLeft: 'dash', KeyQ: 'cast', KeyE: 'enchant', KeyF: 'interact' })) {
    key('keydown', code);
    assert.equal(input.sample()[action], true, action);
    assert.equal(input.sample()[action], false, action);
    key('keydown', code, { repeat: true });
    assert.equal(input.sample()[action], false, action);
    key('keydown', code);
    assert.equal(input.sample()[action], false, action);
    key('keyup', code);
    key('keydown', code);
    assert.equal(input.sample()[action], true, action);
    key('keyup', code);
  }
  input.destroy();
});

test('selection maps keyboard and numpad 1–5 to zero-based slots and is consumed once', () => {
  const { input, key } = fixture();
  for (let digit = 1; digit <= 5; digit += 1) {
    key('keydown', `Digit${digit}`);
    assert.equal(input.sample().select, digit - 1);
    assert.equal(input.sample().select, null);
    key('keyup', `Digit${digit}`);
  }
  key('keydown', 'Numpad4');
  assert.equal(input.sample().select, 3);
  input.destroy();
});

test('browser shortcuts, composing text and button Space/arrows keep native behavior', () => {
  const { input, key, element } = fixture();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
    assert.equal(key('keydown', 'KeyJ', { [modifier]: true }).prevented, false);
    assert.equal(input.sample().attack, false);
  }
  element('button').focus();
  for (const code of ['Space', 'ArrowLeft', 'ArrowUp', 'KeyJ']) {
    assert.equal(key('keydown', code).prevented, false);
  }
  assert.equal(input.sample().jump, false);
  assert.equal(input.sample().left, false);
  input.destroy();
});

test('Escape and P resume after pause UI focuses a button, matching main.js', () => {
  const { input, key, element, canvas } = fixture();
  const pauseButton = element('button');
  let paused = false;
  let toggles = 0;
  input.onPause = () => {
    paused = !paused;
    toggles += 1;
    input.clear();
    (paused ? pauseButton : canvas).focus();
  };
  for (const code of ['Escape', 'KeyP']) {
    assert.equal(key('keydown', code).prevented, true);
    assert.equal(paused, true);
    key('keydown', code, { repeat: true });
    assert.equal(paused, true);
    key('keyup', code);
    assert.equal(key('keydown', code).prevented, true);
    assert.equal(paused, false);
    key('keyup', code);
  }
  assert.equal(toggles, 4);
  input.destroy();
});

test('pause shortcuts never capture text fields or an open dialog', () => {
  const { input, key, element, document, canvas } = fixture();
  let pauses = 0;
  input.onPause = () => { pauses += 1; };
  for (const node of [element('input'), element('textarea'), element('select'), element('div', { isContentEditable: true })]) {
    node.focus();
    for (const code of ['Escape', 'KeyP']) assert.equal(key('keydown', code).prevented, false);
  }
  canvas.focus();
  document.openDialog = true;
  for (const code of ['Escape', 'KeyP', 'Space', 'KeyJ']) assert.equal(key('keydown', code).prevented, false);
  assert.equal(pauses, 0);
  assert.equal(input.sample().attack, false);
  input.destroy();
});

test('focus, key release, window blur and hidden tabs cannot leave controls stuck', () => {
  const { input, key, element, canvas, window, document } = fixture();
  key('keydown', 'KeyD');
  element('input').focus();
  assert.equal(input.sample().right, false);
  key('keyup', 'KeyD', { ctrlKey: true });
  canvas.focus();
  let blurs = 0;
  input.onBlur = () => { blurs += 1; };
  key('keydown', 'KeyD');
  key('keydown', 'KeyJ');
  window.fire('blur');
  assert.equal(input.sample().right, false);
  assert.equal(input.sample().attack, false);
  key('keydown', 'KeyA');
  document.hidden = true;
  document.fire('visibilitychange');
  assert.equal(input.sample().left, false);
  assert.equal(blurs, 2);
  input.destroy();
});

test('touch supports simultaneous hold/action and release/cancellation', () => {
  const { input, left, attack, ignored, window, document, canvas } = fixture();
  assert.equal(left.fire('pointerdown', { pointerId: 1, button: 0 }).prevented, true);
  attack.fire('pointerdown', { pointerId: 2, button: 0 });
  assert.equal(document.activeElement, canvas);
  const state = input.sample();
  assert.equal(state.left, true);
  assert.equal(state.attack, true);
  assert.equal(input.sample().attack, false);
  window.fire('pointerup', { pointerId: 1 });
  assert.equal(input.sample().left, false);
  left.fire('pointerdown', { pointerId: 3, button: 0 });
  left.fire('lostpointercapture', { pointerId: 3 });
  assert.equal(input.sample().left, false);
  assert.equal(ignored.fire('pointerdown', { pointerId: 4, button: 0 }).prevented, false);
  input.destroy();
});

test('destroy removes all handlers, is repeatable and clears pending state', () => {
  const { input, key, left } = fixture();
  let pauses = 0;
  input.onPause = () => { pauses += 1; };
  key('keydown', 'KeyD');
  input.destroy();
  input.destroy();
  key('keydown', 'Escape');
  key('keydown', 'KeyJ');
  left.fire('pointerdown', { pointerId: 1, button: 0 });
  assert.deepEqual(input.sample(), {
    left: false, right: false, jump: false, attack: false, dash: false,
    cast: false, enchant: false, interact: false, select: null, enhancedAttack: false, cycle: 0, aim: null,
  });
  assert.equal(pauses, 0);
});

test('scaled canvas mouse aim, left/right hold, release and leaving the canvas are safe', () => {
  const { input, canvas, window } = fixture();
  canvas.fire('pointerdown', { button: 0, pointerType: 'mouse', clientX: 340, clientY: 185 });
  assert.deepEqual(input.sample().aim, { x: 480, y: 270 });
  assert.equal(input.sample().attack, true);
  window.fire('pointerup', { button: 0 });
  assert.equal(input.sample().attack, false);
  canvas.fire('pointerdown', { button: 2, pointerType: 'mouse', clientX: 580, clientY: 320 });
  const right = input.sample();
  assert.equal(right.enhancedAttack, true);
  assert.equal(right.attack, false);
  assert.deepEqual(right.aim, { x: 960, y: 540 });
  assert.equal(canvas.fire('contextmenu').prevented, true);
  canvas.fire('pointerleave');
  assert.equal(input.sample().enhancedAttack, false);
  assert.equal(input.sample().aim, null);
  input.destroy();
});

test('wheel emits ordered directions, consumes once, and does not capture pause/dialog/zoom', () => {
  const { input, canvas, document } = fixture();
  assert.equal(canvas.fire('wheel', { deltaY: -120 }).prevented, true);
  assert.equal(input.sample().cycle, -1);
  canvas.fire('wheel', { deltaY: 100 }); canvas.fire('wheel', { deltaY: 3 });
  assert.equal(input.sample().cycle, 2);
  assert.equal(input.sample().cycle, 0);
  assert.equal(canvas.fire('wheel', { deltaY: 1, ctrlKey: true }).prevented, false);
  document.openDialog = true;
  assert.equal(canvas.fire('wheel', { deltaY: 1 }).prevented, false);
  assert.equal(canvas.fire('pointerdown', { button: 2 }).prevented, false);
  document.openDialog = false;
  input.isPlaying = () => false;
  assert.equal(canvas.fire('wheel', { deltaY: 1 }).prevented, false);
  assert.equal(canvas.fire('contextmenu').prevented, false);
  assert.equal(input.sample().cycle, 0);
  input.destroy();
});
