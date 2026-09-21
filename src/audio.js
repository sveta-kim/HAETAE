const ALIASES = {
  slash: 'attack', sword: 'attack', melee: 'attack', combo: 'attack',
  doublejump: 'jump', evade: 'dash', dodge: 'dash',
  spell: 'cast', talisman: 'cast', enchant: 'cast', scan: 'cast',
  hurt: 'hit', damage: 'hit', playerhit: 'hit',
  death: 'kill', defeat: 'kill', enemykill: 'kill',
  bossstart: 'boss', bossphase: 'boss', bossdefeat: 'boss',
  collect: 'memory', pickup: 'memory', fragment: 'memory',
  save: 'checkpoint', heal: 'checkpoint', unlock: 'checkpoint',
  end: 'ending', win: 'ending', victory: 'ending',
};

/** Quiet procedural sound, created only after unlock() from a user gesture. */
export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.ambient = [];
    this.voices = new Set();
    this.destroyed = false;
  }

  async unlock() {
    if (this.destroyed) return false;
    try {
      if (!this.context) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.32 : 0;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.destroyed || this.context.state !== 'running') return false;
      if (!this.ambient.length) this.startAmbient();
      return true;
    } catch {
      // Audio support and device availability must never prevent play.
      return false;
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.context || !this.master || this.destroyed) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled ? 0.32 : 0, now, 0.035);
  }

  getNoiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(this.context.sampleRate * 2);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    // Smoothed noise avoids a sharp white-noise hiss in the rain layer.
    let previous = 0;
    for (let i = 0; i < length; i += 1) {
      previous = (previous + (Math.random() * 2 - 1) * 0.13) / 1.13;
      data[i] = previous * 2.4;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  startAmbient() {
    const context = this.context;
    const rain = context.createBufferSource();
    rain.buffer = this.getNoiseBuffer();
    rain.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1700;
    const rainGain = context.createGain();
    rainGain.gain.value = 0.037;
    rain.connect(filter).connect(rainGain).connect(this.master);
    rain.start();
    this.ambient.push(rain, filter, rainGain);

    for (const [frequency, volume] of [[55, 0.021], [82.41, 0.012]]) {
      const drone = context.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = volume;
      drone.connect(gain).connect(this.master);
      drone.start();
      this.ambient.push(drone, gain);
    }
  }

  tone(frequency, endFrequency, duration, volume = 0.12, type = 'sine', delay = 0) {
    const context = this.context;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  noise(duration, frequency, volume = 0.13) {
    const context = this.context;
    const start = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.75;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.025);
  }

  play(name) {
    if (!this.enabled || this.destroyed || this.context?.state !== 'running') return false;
    // Bound the number of overlapping effects during dense battles.
    if (this.voices.size > 28 || typeof name !== 'string') return false;
    const normalized = name.toLowerCase().replace(/[\s_-]/g, '');
    const sound = ALIASES[normalized] || normalized;
    try {
      switch (sound) {
        case 'attack':
          this.noise(0.13, 1700, 0.22);
          this.tone(180, 65, 0.12, 0.09, 'triangle');
          break;
        case 'jump':
          this.tone(185, 380, 0.18, 0.08, 'triangle');
          break;
        case 'dash':
          this.noise(0.2, 2200, 0.18);
          this.tone(330, 100, 0.17, 0.045);
          break;
        case 'cast':
          this.tone(290, 720, 0.3, 0.07);
          this.tone(435, 1080, 0.26, 0.04, 'sine', 0.035);
          break;
        case 'hit':
          this.noise(0.18, 420, 0.25);
          this.tone(135, 42, 0.22, 0.14, 'triangle');
          break;
        case 'kill':
          this.tone(250, 62, 0.28, 0.095, 'triangle');
          this.noise(0.23, 760, 0.13);
          break;
        case 'boss':
          this.tone(82, 41, 0.85, 0.12, 'triangle');
          this.tone(123, 61.5, 0.9, 0.065);
          this.noise(0.7, 260, 0.2);
          break;
        case 'memory':
          [440, 554.37, 659.25].forEach((note, index) =>
            this.tone(note, note, 0.46, 0.07, 'sine', index * 0.085));
          break;
        case 'checkpoint':
          [261.63, 392, 523.25].forEach((note, index) =>
            this.tone(note, note, 0.6, 0.07, 'sine', index * 0.13));
          break;
        case 'ending':
          [220, 329.63, 440, 493.88, 659.25].forEach((note, index) =>
            this.tone(note, note, 1.35, 0.055, 'sine', index * 0.24));
          break;
        default:
          return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const node of [...this.voices, ...this.ambient]) {
      try { node.stop?.(); } catch { /* Already stopped. */ }
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    }
    this.voices.clear();
    this.ambient = [];
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') {
      try { this.context.close()?.catch(() => {}); } catch { /* Device already closed. */ }
    }
    this.noiseBuffer = null;
  }
}
