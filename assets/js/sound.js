// ==========================================
// WARM AUDIO SYNTHESIZER (Web Audio API)
// Soft attack/decay envelopes avoid the clicks you get from starting a tone at full volume,
// and everything runs through one master bus (low-pass + compressor) so overlapping
// sounds stay gentle instead of clipping.
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bus = null;
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem('sunbeam_sound_enabled') !== 'false';
    } catch (e) {}

    // Browsers only allow audio after a user gesture; unlock on the first one
    // so the very first chime plays on time instead of late or not at all.
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const master = this.ctx.createGain();
      master.gain.value = 0.55;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 5200;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;

      lowpass.connect(master);
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.bus = lowpass;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem('sunbeam_sound_enabled', on ? 'true' : 'false');
    } catch (e) {}
    if (on) this.init();
  }

  // One note made of several partials (harmonics) with a soft envelope.
  note(freq, { start = 0, dur = 0.5, gain = 0.18, type = 'sine', attack = 0.008, partials = [[1, 1]] } = {}) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const t0 = this.ctx.currentTime + 0.01 + start;
    partials.forEach(([mult, amp]) => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * mult, t0);
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(gain * amp, t0 + attack);
      // Higher partials fade faster, which is what makes it sound like a bell instead of a beep
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / Math.max(1, mult * 0.6));
      osc.connect(env);
      env.connect(this.bus);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }

  marimba(freq, start = 0, gain = 0.2) {
    this.note(freq, { start, dur: 0.45, gain, partials: [[1, 1], [4, 0.12], [10, 0.03]] });
  }

  bell(freq, start = 0, gain = 0.16, dur = 1.4) {
    this.note(freq, { start, dur, gain, attack: 0.004, partials: [[1, 1], [2, 0.4], [3, 0.18], [4.2, 0.08]] });
  }

  playAdd() {
    this.init();
    this.marimba(659.25, 0, 0.16);   // E5
    this.marimba(987.77, 0.07, 0.14); // B5
  }

  playComplete() {
    this.init();
    [523.25, 659.25, 783.99].forEach((f, i) => this.marimba(f, i * 0.07, 0.17)); // C E G
    this.bell(1046.5, 0.21, 0.12, 1.1);                                          // C6
  }

  playDelete() {
    this.init();
    this.note(392.0, { dur: 0.22, gain: 0.12, type: 'triangle' });
    this.note(293.66, { start: 0.08, dur: 0.3, gain: 0.1, type: 'triangle' });
  }

  playFanfare() {
    this.init();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.marimba(f, i * 0.09, 0.18));
    // Warm closing chord
    [523.25, 659.25, 783.99].forEach(f => this.bell(f, 0.4, 0.08, 1.8));
    this.bell(1318.5, 0.42, 0.07, 1.6);
  }

  playReminder() {
    this.init();
    // Two gentle "ding-dong" pairs
    this.bell(880.0, 0, 0.16, 1.2);
    this.bell(659.25, 0.32, 0.15, 1.4);
    this.bell(880.0, 1.1, 0.12, 1.0);
    this.bell(659.25, 1.42, 0.11, 1.4);
  }

  playTick() {
    this.init();
    this.note(1567.98, { dur: 0.06, gain: 0.05 });
  }
}

const sounds = new SoundEngine();
