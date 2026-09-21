const KEY_ACTIONS = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
  KeyJ: 'attack', ShiftLeft: 'dash', ShiftRight: 'dash', KeyK: 'dash',
  KeyQ: 'cast', KeyE: 'enchant', KeyF: 'interact',
};

const EDGE_ACTIONS = ['jump', 'attack', 'enhancedAttack', 'dash', 'cast', 'enchant', 'interact'];
const TOUCH_ACTIONS = new Set(['left', 'right', ...EDGE_ACTIONS]);

function isInteractive(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.isContentEditable || target.closest(
    'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
  ));
}

function isTextInput(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.isContentEditable || target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
  ));
}

function keyCode(event) {
  if (event.code) return event.code;
  const key = event.key || '';
  if (key === ' ' || key === 'Spacebar') return 'Space';
  if (key === 'Shift') return 'ShiftLeft';
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[1-5]$/.test(key)) return `Digit${key}`;
  return key;
}

/** Keyboard and optional [data-input] touch controls. sample() consumes actions once. */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.onPause = null;
    this.onHelp = null;
    this.onBlur = null;
    this.keys = new Set();
    this.pointers = new Map();
    this.mouseHeld = new Set();
    this.edges = new Set();
    this.selection = null;
    this.cycle = 0;
    this.aim = null;
    this.isPlaying = () => true;
    this.listeners = [];
    this.destroyed = false;
    this.document = canvas?.ownerDocument || globalThis.document;
    this.window = this.document?.defaultView || globalThis.window;

    const listen = (target, type, callback, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, callback, options);
      this.listeners.push(() => target.removeEventListener(type, callback, options));
    };

    listen(this.window, 'keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const code = keyCode(event);
      const action = KEY_ACTIONS[code];
      const digit = /^(?:Digit|Numpad)([1-5])$/.exec(code);
      const pause = code === 'Escape' || code === 'KeyP';
      const help = code === 'KeyH';
      if (!action && !digit && !pause && !help) return;
      // Leave native dialog dismissal and all text editing to the browser.
      if (this.document?.querySelector?.('dialog[open]')) return;
      const blocksShortcut = pause ? isTextInput : isInteractive;
      if (blocksShortcut(event.target) || blocksShortcut(this.document?.activeElement)) return;
      event.preventDefault();
      if (event.repeat || this.keys.has(code)) return;
      this.keys.add(code);
      if (pause || help) {
        this.edges.clear();
        this.selection = null;
        const callback = pause ? this.onPause : this.onHelp;
        if (typeof callback === 'function') callback();
      } else if (digit) {
        this.selection = Number(digit[1]) - 1;
        this.cycle = 0;
      } else if (action !== 'left' && action !== 'right') {
        this.edges.add(action);
      }
    });

    // Releases must still be observed if focus or modifier keys changed mid-press.
    listen(this.window, 'keyup', (event) => this.keys.delete(keyCode(event)));
    listen(this.window, 'blur', () => this.handleBlur());
    listen(this.document, 'visibilitychange', () => {
      if (this.document.hidden) this.handleBlur();
    });
    listen(this.document, 'focusin', (event) => {
      if (isInteractive(event.target)) this.clear();
    });

    const releasePointer = (event) => {
      this.pointers.delete(event.pointerId);
      if (event.type === 'pointercancel' || event.button === undefined) this.mouseHeld.clear();
      else this.mouseHeld.delete(event.button);
    };
    listen(this.window, 'pointerup', releasePointer);
    listen(this.window, 'pointercancel', releasePointer);

    const canUseMouse = () => this.isPlaying() && !this.document?.querySelector?.('dialog[open]');
    const aimAt = event => {
      const rect = this.canvas.getBoundingClientRect?.();
      if (!rect?.width || !rect?.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      this.aim = { x: (event.clientX - rect.left) * this.canvas.width / rect.width, y: (event.clientY - rect.top) * this.canvas.height / rect.height };
    };
    listen(canvas, 'pointermove', event => { if (event.pointerType !== 'touch' && canUseMouse()) aimAt(event); });
    listen(canvas, 'pointerleave', () => { this.aim = null; this.mouseHeld.clear(); });
    listen(canvas, 'pointerdown', event => {
      if (!canUseMouse() || ![0, 2].includes(event.button)) return;
      event.preventDefault();
      canvas.focus?.({ preventScroll: true });
      aimAt(event);
      this.edges.add(event.button === 2 ? 'enhancedAttack' : 'attack');
      if (event.pointerType !== 'touch') this.mouseHeld.add(event.button);
    }, { passive: false });
    listen(canvas, 'contextmenu', event => { if (canUseMouse()) event.preventDefault(); });
    listen(canvas, 'wheel', event => {
      if (!canUseMouse() || event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      // One wheel event is one detent; never mistake delta pixels for slot count.
      this.cycle += Math.sign(event.deltaY);
      aimAt(event);
      canvas.focus?.({ preventScroll: true });
    }, { passive: false });

    for (const button of this.document?.querySelectorAll('[data-input]') || []) {
      const action = button.dataset.input;
      if (!TOUCH_ACTIONS.has(action)) continue;
      listen(button, 'pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        this.pointers.set(event.pointerId, action);
        if (action !== 'left' && action !== 'right') this.edges.add(action);
        try { button.setPointerCapture?.(event.pointerId); } catch { /* Pointer already released. */ }
        // Keep keyboard play available after touching an on-screen button.
        this.canvas?.focus?.({ preventScroll: true });
      }, { passive: false });
      listen(button, 'pointerup', releasePointer);
      listen(button, 'pointercancel', releasePointer);
      listen(button, 'lostpointercapture', releasePointer);
      listen(button, 'contextmenu', (event) => event.preventDefault());
    }
  }

  handleBlur() {
    this.clear();
    if (typeof this.onBlur === 'function') this.onBlur();
  }

  sample() {
    const held = new Set(this.pointers.values());
    for (const code of this.keys) held.add(KEY_ACTIONS[code]);
    const value = { left: held.has('left'), right: held.has('right') };
    for (const action of EDGE_ACTIONS) value[action] = this.edges.has(action);
    if (this.mouseHeld.has(0)) value.attack = true;
    if (this.mouseHeld.has(2)) value.enhancedAttack = true;
    value.select = this.selection;
    value.cycle = this.cycle;
    value.aim = this.aim ? { ...this.aim } : null;
    this.edges.clear();
    this.selection = null;
    this.cycle = 0;
    return value;
  }

  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.mouseHeld.clear();
    this.edges.clear();
    this.selection = null;
    this.cycle = 0;
    this.aim = null;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clear();
    for (const remove of this.listeners) remove();
    this.listeners = [];
    this.onPause = this.onHelp = this.onBlur = null;
  }
}
