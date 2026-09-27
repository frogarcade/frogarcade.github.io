// ============================================================
// WRESTLING LEGENDS — main.js
// Game flow, combat resolution, input, camera, HUD, audio.
// ============================================================

/* global THREE, RING, ARENA, buildWorld, Boxer, BOXER_DEFS, AIController, groundYAt */

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// Renderer / scene
// ------------------------------------------------------------
const container = $('game-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 120);
const world = buildWorld(scene);

const vignette = document.createElement('div');
vignette.id = 'hit-vignette';
document.body.appendChild(vignette);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------
// Audio (procedural WebAudio)
// ------------------------------------------------------------
const AudioFX = {
  ac: null, crowdGain: null,
  init() {
    if (this.ac) return;
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      // master bus so the settings screen can ride the whole sfx mix
      this.sfxBus = this.ac.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.ac.destination);
      // crowd ambience: smooth brown-noise rumble with a slow murmur swell
      // (white noise reads as static — integrate it and low-pass it hard)
      const len = this.ac.sampleRate * 4;
      const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last += (Math.random() * 2 - 1) * 0.02;
        last *= 0.998;
        d[i] = last;
      }
      // normalize
      let peak = 0;
      for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = 0; i < len; i++) d[i] /= peak || 1;
      const src = this.ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.3;
      this.crowdGain = this.ac.createGain(); this.crowdGain.gain.value = 0.0;
      // slow swell so it breathes like a crowd instead of hissing
      const lfo = this.ac.createOscillator(); lfo.frequency.value = 0.13;
      const lfoAmt = this.ac.createGain(); lfoAmt.gain.value = 0.3;
      const swell = this.ac.createGain(); swell.gain.value = 1;
      lfo.connect(lfoAmt).connect(swell.gain);
      src.connect(lp).connect(swell).connect(this.crowdGain).connect(this.sfxBus);
      src.start(); lfo.start();
      applyAudioSettings();
    } catch (e) { /* audio unavailable */ }
  },
  setCrowd(level) {
    if (!this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(level, this.ac.currentTime, 0.4);
  },
  blip(fn) { if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); fn(this.ac); } },
  whoosh() {
    this.blip(ac => {
      const n = ac.createBufferSource();
      const len = ac.sampleRate * 0.15;
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = b;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, ac.currentTime);
      f.frequency.exponentialRampToValueAtTime(1800, ac.currentTime + 0.12);
      const g = ac.createGain(); g.gain.value = 0.16;
      n.connect(f).connect(g).connect(AudioFX.sfxBus);
      n.start();
    });
  },
  hit(power = 1) {
    this.blip(ac => {
      const t = ac.currentTime;
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(160 + power * 30, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.14);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.5 * Math.min(1.4, power), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(AudioFX.sfxBus);
      o.start(t); o.stop(t + 0.2);
      const n = ac.createBufferSource();
      const len = ac.sampleRate * 0.08;
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = b;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g2 = ac.createGain(); g2.gain.value = 0.35 * power;
      n.connect(f).connect(g2).connect(AudioFX.sfxBus);
      n.start(t);
    });
  },
  slam() { this.hit(2.2); this.whoosh(); },

  // the VS splash: a rising hiss, a huge metallic impact, then two brass stabs
  versus() {
    this.blip(ac => {
      const bus = this.sfxBus;
      const t0 = ac.currentTime + 0.02;
      const hit = t0 + 0.52;

      // riser into the hit
      const rl = Math.ceil(ac.sampleRate * 0.6);
      const rb = ac.createBuffer(1, rl, ac.sampleRate);
      const rd = rb.getChannelData(0);
      for (let i = 0; i < rl; i++) rd[i] = Math.random() * 2 - 1;
      const rs = ac.createBufferSource(); rs.buffer = rb;
      const rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.Q.value = 2.4;
      rf.frequency.setValueAtTime(240, t0);
      rf.frequency.exponentialRampToValueAtTime(3600, hit);
      const rg = ac.createGain();
      rg.gain.setValueAtTime(0.0001, t0);
      rg.gain.exponentialRampToValueAtTime(0.42, hit);
      rg.gain.exponentialRampToValueAtTime(0.0008, hit + 0.12);
      rs.connect(rf).connect(rg).connect(bus);
      rs.start(t0); rs.stop(hit + 0.14);

      // sub-bass impact
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(125, hit);
      o.frequency.exponentialRampToValueAtTime(34, hit + 0.55);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.85, hit);
      og.gain.exponentialRampToValueAtTime(0.001, hit + 0.72);
      o.connect(og).connect(bus); o.start(hit); o.stop(hit + 0.75);

      // metallic clang
      [523.25, 659.25, 784, 1046.5].forEach((f, i) => {
        const mo = ac.createOscillator();
        mo.type = i % 2 ? 'triangle' : 'square';
        mo.frequency.value = f * (1 + (Math.random() - 0.5) * 0.012);
        const mf = ac.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 3200;
        const mg = ac.createGain();
        mg.gain.setValueAtTime(0.15 / (i + 1), hit);
        mg.gain.exponentialRampToValueAtTime(0.001, hit + 0.9);
        mo.connect(mf).connect(mg).connect(bus);
        mo.start(hit); mo.stop(hit + 0.95);
      });

      // cymbal-ish crash on the impact
      const cl = Math.ceil(ac.sampleRate * 0.85);
      const cb = ac.createBuffer(1, cl, ac.sampleRate);
      const cd = cb.getChannelData(0);
      for (let i = 0; i < cl; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cl, 2.2);
      const cs = ac.createBufferSource(); cs.buffer = cb;
      const cf = ac.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 2400;
      const cg = ac.createGain(); cg.gain.value = 0.28;
      cs.connect(cf).connect(cg).connect(bus); cs.start(hit);

      // two brass stabs — the "VER-SUS"
      const stab = (when, freqs, vol) => {
        for (const f of freqs) {
          const s = ac.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f;
          const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1700;
          const sg = ac.createGain();
          sg.gain.setValueAtTime(0.0001, when);
          sg.gain.linearRampToValueAtTime(vol, when + 0.025);
          sg.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
          s.connect(sf).connect(sg).connect(bus);
          s.start(when); s.stop(when + 0.48);
        }
      };
      stab(hit + 0.5, [110, 164.81, 220], 0.11);
      stab(hit + 0.92, [146.83, 220, 293.66], 0.13);
    });
  },
  // ---- primitives the cues below are built from ----
  _tone(ac, t, freq, dur, opts = {}) {
    const { type = 'sine', vol = 0.2, glideTo = null } = opts;
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(ac, t, dur, opts = {}) {
    const { from = 600, to = 600, q = 1.2, vol = 0.1, type = 'bandpass' } = opts;
    const len = Math.max(1, Math.ceil(ac.sampleRate * dur));
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ac.createBufferSource(); n.buffer = b;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    const g = ac.createGain(); g.gain.value = vol;
    n.connect(f).connect(g).connect(this.sfxBus);
    n.start(t);
  },

  // FIGHT START — the arena air horn. The ring bell belongs to the ring-out now.
  horn() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      [138, 174, 208].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.97, t);
        o.frequency.linearRampToValueAtTime(f, t + 0.07);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2300;
        const v = 0.13 / (i * 0.7 + 1);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + 0.05);
        g.gain.setValueAtTime(v, t + 0.46);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.76);
        o.connect(lp).connect(g).connect(this.sfxBus);
        o.start(t); o.stop(t + 0.8);
      });
      this._noise(ac, t, 0.1, { from: 900, to: 300, vol: 0.05 });
    });
  },

  // FIGHTER UNLOCKED / STEROID CLAIMED — short brass fanfare
  fanfare(big = false) {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      const notes = big ? [392, 523, 659, 784] : [392, 523, 659];
      notes.forEach((f, i) => {
        this._tone(ac, t + i * 0.09, f, 0.32, { type: 'triangle', vol: 0.19 });
        this._tone(ac, t + i * 0.09, f * 2, 0.2, { type: 'sine', vol: 0.06 });
      });
      const land = notes[notes.length - 1] * (big ? 1.5 : 1.26);
      this._tone(ac, t + notes.length * 0.09, land, 0.62, { type: 'triangle', vol: 0.17 });
    });
  },

  // STEROID SPENT / SPECIAL CHARGED — an upward surge
  powerUp(bright = false) {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._tone(ac, t, bright ? 430 : 300, 0.22, { type: 'square', vol: 0.15, glideTo: bright ? 1180 : 820 });
      this._tone(ac, t + 0.05, bright ? 645 : 450, 0.26, { type: 'triangle', vol: 0.17, glideTo: bright ? 1580 : 1100 });
      this._noise(ac, t, 0.18, { from: 700, to: 3200, vol: 0.045 });
    });
  },

  // SPECIAL CHARGED — a steel shing, then a confident rising fifth with a tail.
  // (The old power-up blip was too thin to read as "your ultimate is ready".)
  charged() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._noise(ac, t, 0.16, { from: 2400, to: 7000, vol: 0.08, q: 0.9 });
      this._tone(ac, t + 0.02, 523, 0.5, { type: 'triangle', vol: 0.17 });
      this._tone(ac, t + 0.02, 784, 0.5, { type: 'triangle', vol: 0.13 });
      this._tone(ac, t + 0.16, 1046, 0.62, { type: 'triangle', vol: 0.16 });
      this._tone(ac, t + 0.16, 1568, 0.62, { type: 'sine', vol: 0.1 });
      this._tone(ac, t + 0.34, 2093, 0.5, { type: 'sine', vol: 0.07 });
    });
  },

  // STEEL KNUCKLES — a hard metallic clang with a ringing tail
  clang() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._noise(ac, t, 0.09, { from: 5200, to: 1800, vol: 0.14, q: 1.6 });
      [1860, 2790, 4100].forEach((f, i) =>
        this._tone(ac, t, f, 0.42 - i * 0.1, { type: 'square', vol: 0.075 / (i + 1) }));
      this._tone(ac, t, 220, 0.16, { type: 'triangle', vol: 0.12, glideTo: 90 });
    });
  },

  // ROPES — rubbery boing, wound tighter with every rebound
  ropeTwang(n = 0) {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      const base = 128 * Math.pow(1.2, n);
      this._tone(ac, t, base, 0.28, { type: 'triangle', vol: 0.2, glideTo: base * 2.6 });
      this._tone(ac, t, base * 1.5, 0.18, { type: 'sine', vol: 0.09, glideTo: base * 3.4 });
      this._noise(ac, t, 0.07, { from: 900, to: 300, vol: 0.09, q: 2.2 });
    });
  },

  // CRATE RARITY CLIMB — sparkle arpeggio, longer on a double jump
  sparkle(steps = 4) {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      const scale = [784, 988, 1175, 1568, 1976, 2349];
      for (let i = 0; i < Math.min(steps, scale.length); i++) {
        this._tone(ac, t + i * 0.055, scale[i], 0.26, { type: 'sine', vol: 0.14 });
      }
    });
  },

  // GOLD — bright two-tone metallic ping
  coin() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._tone(ac, t, 1318, 0.09, { type: 'square', vol: 0.13 });
      this._tone(ac, t + 0.07, 1976, 0.3, { type: 'square', vol: 0.13 });
    });
  },
  coinScatter(n = 6) {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      for (let i = 0; i < n; i++) {
        this._tone(ac, t + i * 0.045 + Math.random() * 0.03,
          1046 + Math.random() * 900, 0.2, { type: 'square', vol: 0.075 });
      }
      this._noise(ac, t, 0.3, { from: 2600, to: 1200, vol: 0.035, q: 0.8 });
    });
  },

  // THE HOUND COMES OFF THE LEASH — menacing riser
  riser() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.7);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(2600, t + 0.7);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      o.connect(lp).connect(g).connect(this.sfxBus);
      o.start(t); o.stop(t + 0.9);
      this._noise(ac, t, 0.7, { from: 300, to: 4000, vol: 0.055, q: 0.7 });
    });
  },

  // BIG WAVE'S BARRIER — shimmering hum
  shimmer() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      [330, 494, 660, 988].forEach((f, i) =>
        this._tone(ac, t + i * 0.05, f, 0.8 - i * 0.1, { type: 'sine', vol: 0.1 }));
      this._noise(ac, t, 0.6, { from: 2000, to: 5000, vol: 0.03, q: 0.6 });
    });
  },

  // PETER'S BURGER — two wet bites, then the boost swelling up
  chomp() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._noise(ac, t, 0.12, { from: 1400, to: 300, vol: 0.15, q: 0.9, type: 'lowpass' });
      this._noise(ac, t + 0.17, 0.12, { from: 1200, to: 260, vol: 0.13, q: 0.9, type: 'lowpass' });
      this._tone(ac, t + 0.3, 220, 0.5, { type: 'triangle', vol: 0.13, glideTo: 560 });
    });
  },

  // NEXT OPPONENT — low ominous stinger
  omen() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._tone(ac, t, 110, 0.9, { type: 'sawtooth', vol: 0.09, glideTo: 82 });
      this._tone(ac, t, 55, 1.1, { type: 'sine', vol: 0.15 });
      this._noise(ac, t, 0.5, { from: 1800, to: 200, vol: 0.045 });
    });
  },

  // PROGRESS WIPED — everything drains away
  wipe() {
    this.blip(ac => {
      const t = ac.currentTime + 0.01;
      this._tone(ac, t, 660, 0.5, { type: 'sawtooth', vol: 0.14, glideTo: 90 });
      this._noise(ac, t, 0.45, { from: 3000, to: 200, vol: 0.055 });
    });
  },

  bell(times = 1) {
    this.blip(ac => {
      for (let k = 0; k < times; k++) {
        const t = ac.currentTime + k * 0.45;
        [1046, 1568, 2093].forEach((fr, i) => {
          const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.01);
          const g = ac.createGain();
          g.gain.setValueAtTime(0.22 / (i + 1), t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
          o.connect(g).connect(AudioFX.sfxBus);
          o.start(t); o.stop(t + 1.2);
        });
      }
    });
  },
  // a low, ugly grumble — the crowd is not on your side
  boo() {
    this.blip(ac => {
      if (!this.crowdGain) return;
      const t = ac.currentTime;
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setTargetAtTime(0.3, t, 0.12);
      this.crowdGain.gain.setTargetAtTime(0.12, t + 1.8, 1.2);
      // dissonant descending grumble over the crowd noise
      [124, 131, 98].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t + i * 0.05);
        o.frequency.linearRampToValueAtTime(f * 0.72, t + 1.5);
        const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 480;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.1, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
        o.connect(fl).connect(g).connect(this.sfxBus);
        o.start(t); o.stop(t + 1.75);
      });
    });
  },
  roar() {
    this.blip(ac => {
      if (!this.crowdGain) return;
      const t = ac.currentTime;
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setTargetAtTime(0.34, t, 0.08);
      this.crowdGain.gain.setTargetAtTime(0.12, t + 1.6, 1.2);
    });
  }
};

// ------------------------------------------------------------
// Music (procedural step-sequencer)
// ------------------------------------------------------------
const Music = {
  bus: null, filter: null, current: null, timer: null, step: 0, nextT: 0,
  ensure() {
    AudioFX.init();
    const ac = AudioFX.ac;
    if (!ac || this.bus) return;
    this.filter = ac.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 16000;
    this.bus = ac.createGain(); this.bus.gain.value = 0.14 * settingsValue('music');
    this.bus.connect(this.filter).connect(AudioFX.sfxBus);
    this.timer = setInterval(() => this.tick(), 80);
  },
  // real recorded tracks for some modes; the rest stay procedural
  TRACKS: { menu: 'menu.mp3',              // "Steel Grit" (sports rock) by alexgrohl, via Pixabay
            fight: 'fight.mp3',             // "Wrestling" by muzaproduction, via Pixabay
            final: 'final.mp3' },           // "Epic Sport Rock Trailer" by bfcmusic: the title fight, every round
  muffled: false,
  el: null, elMode: null, elFailed: {},
  trackVol() { return Math.max(0, Math.min(1, 0.5 * settingsValue('music') * (this.muffled ? 0.35 : 1))); },
  playTrack(mode) {
    const src = this.TRACKS[mode];
    if (!src || this.elFailed[mode]) return false;
    if (!this.el || this.elMode !== mode) {
      if (this.el) this.el.pause();
      this.el = new Audio(src); this.el.loop = true; this.el.preload = 'auto'; this.elMode = mode;
      this.el.addEventListener('error', () => { this.elFailed[mode] = true; });
    }
    this.el.volume = this.trackVol();
    const p = this.el.play();                  // may be refused until the first click; play() is retried on the next call
    if (p && p.catch) p.catch(() => {});
    return true;
  },
  stopTrack() { if (this.el) { this.el.pause(); this.el.currentTime = 0; } },
  play(mode) {
    try { this.ensure(); } catch (e) {}
    const ac = AudioFX.ac;                        // a recorded track doesn't need the synth to be up
    if (ac && ac.state === 'suspended') ac.resume();
    if (this.current === mode) { if (this.TRACKS[mode]) this.playTrack(mode); return; }
    this.current = mode; this.step = 0;
    if (ac) this.nextT = ac.currentTime + 0.08;
    if (!this.playTrack(mode)) this.stopTrack();
  },
  stop() { this.current = null; this.stopTrack(); },
  muffle(on) {
    this.muffled = !!on; if (this.el) this.el.volume = this.trackVol();   // knocked out: the song sinks away too
    if (!this.filter) return;
    this.filter.frequency.setTargetAtTime(on ? 420 : 16000, AudioFX.ac.currentTime, 0.15);
  },
  tick() {
    const ac = AudioFX.ac;
    if (!ac || !this.current || ac.state !== 'running') return;
    if (this.TRACKS[this.current] && !this.elFailed[this.current]) return;   // a real song has this one
    const bpm = (this.current === 'fight' || this.current === 'final') ? 138 : 92;
    const spb = 60 / bpm / 4; // 16th note
    while (this.nextT < ac.currentTime + 0.22) {
      this.schedule(this.step, this.nextT);
      this.step = (this.step + 1) % 32;
      this.nextT += spb;
    }
  },
  // --- tiny instruments ---
  kick(t) {
    const ac = AudioFX.ac, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.15);
  },
  noiseHit(t, freq, dur, vol, type = 'bandpass') {
    const ac = AudioFX.ac, len = Math.ceil(ac.sampleRate * dur);
    const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ac.createBufferSource(); n.buffer = b;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = vol;
    n.connect(f).connect(g).connect(this.bus); n.start(t);
  },
  bass(t, freq, dur) {
    const ac = AudioFX.ac, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 3;
    g.gain.setValueAtTime(0.34, t); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.03);
    o.connect(f).connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.1);
  },
  stab(t, freqs, dur, vol = 0.09, type = 'square') {
    const ac = AudioFX.ac;
    for (const fr of freqs) {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = type; o.frequency.value = fr;
      f.type = 'lowpass'; f.frequency.value = 2400;
      g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, 0.05);
      o.connect(f).connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.15);
    }
  },
  schedule(s, t) {
    const A1 = 55, C2 = 65.41, D2 = 73.42, E2 = 82.41, G1 = 49, F1 = 43.65;
    if (this.current === 'fight' || this.current === 'final') {
      if (s % 8 === 0 || s === 14 || s === 30) this.kick(t);
      if (s % 8 === 4) this.noiseHit(t, 1400, 0.08, 0.3);         // snare
      if (s % 4 === 2) this.noiseHit(t, 7000, 0.02, 0.05, 'highpass'); // hats
      const riff = { 0: A1, 3: A1, 6: C2, 8: A1, 11: G1, 14: A1, 16: A1, 19: A1, 22: D2, 24: C2, 27: G1, 30: E2 };
      if (riff[s]) this.bass(t, riff[s], 0.16);
      if (s === 8) this.stab(t, [220, 261.63, 329.63], 0.22);
      if (s === 24) this.stab(t, [196, 246.94, 293.66], 0.22);
    } else { // menu groove
      if (s % 16 === 0 || s % 16 === 10) this.kick(t);
      if (s % 16 === 8) this.noiseHit(t, 1300, 0.09, 0.2);
      if (s % 8 === 4) this.noiseHit(t, 7500, 0.02, 0.04, 'highpass');
      const walk = { 0: A1, 4: C2, 8: D2, 12: E2, 16: A1, 20: C2, 24: G1, 28: E2 };
      if (walk[s]) this.bass(t, walk[s], 0.28);
      if (s === 0) this.stab(t, [220, 277.18, 329.63, 415.3], 1.4, 0.045, 'triangle');
      if (s === 16) this.stab(t, [174.61, 220, 261.63, 349.23], 1.4, 0.045, 'triangle');
    }
  },
  sting(win) {
    this.ensure();
    if (!AudioFX.ac) return;
    this.stop();
    const t0 = AudioFX.ac.currentTime + 0.1;
    if (win) {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) =>
        this.stab(t0 + i * 0.12, [f, f * 2], 0.5, 0.12, 'triangle'));
      this.stab(t0 + 0.8, [523.25, 659.25, 783.99, 1046.5], 1.6, 0.1, 'triangle');
    } else {
      [392, 369.99, 349.23, 311.13].forEach((f, i) =>
        this.stab(t0 + i * 0.3, [f, f / 2], 0.5, 0.12, 'sawtooth'));
    }
  }
};

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------
const game = {
  state: 'menu',       // menu | select | cutscene | versus | fight | end
  tournament: 'bronze',
  round: 1, roundP: 0, roundE: 0, roundsToWin: 1, isTitleFight: false,
  coins: [], cracks: [], piledrivers: [], ringWarp: 0,
  ladder: [], fightIndex: 0, wonLast: false, cutModel: null, cutT: 0,
  player: null,
  enemy: null,
  ai: null,
  suplexes: [],
  matchOver: false,
  timeScale: 1,
  slowmoTimer: 0,
  shake: 0,
  camYaw: 0, camPitch: -0.12,
  kickP: 0, kickY: 0,
  locked: false,
  fightIntro: 0,
  endTimer: -1,
  playerWon: false,
  selectedId: null
};
window.game = game;

const keys = {};
const TMP = { v: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3() };

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function announce(text, color) {
  const el = $('announce');
  el.textContent = text;
  el.style.color = color || '';
  el.classList.remove('show');
  void el.offsetWidth; // restart animation
  el.classList.add('show');
}

function subhint(text) {
  const el = $('subhint');
  if (!text) { el.classList.remove('show'); return; }
  el.textContent = text;
  el.classList.add('show');
}

function flashVignette() {
  vignette.style.transition = 'none';
  vignette.style.opacity = '1';
  setTimeout(() => {
    vignette.style.transition = 'opacity 0.5s';
    vignette.style.opacity = '0';
  }, 30);
}

// ------------------------------------------------------------
// Select-screen display models (spinning turntable boxers)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Roster, saves and unlocks
// ------------------------------------------------------------
// Wrestlers you can PLAY. Challenge bosses are deliberately absent — they
// exist in BOXER_DEFS as opponents only, and beating one never unlocks them.
const ROSTER = ['joe', 'bean', 'blaze', 'honk', 'vicious',
                'joeabove', 'brick', 'mitchell', 'bull', 'bigwave',
                'presto', 'peter', 'jimmy', 'gustavo', 'hound'];
// CHALLENGES: one wrestler, one opponent, no team to hide behind. Beat one for
// the first time and you bank the steroids. Add more entries to add more.
const CHALLENGES = [
  { id: 'slumber', reward: 3 }
];
const CHALLENGE_IDS = CHALLENGES.map(c => c.id);
function challengeFor(id) { return CHALLENGES.find(c => c.id === id) || null; }
// every tournament runs the same gauntlet, minus whoever you picked
// Win a cup and the wrestler you did it with keeps the medal — it hangs on
// them on the select screen from then on. Only the best one shows.
const MEDALS = {
  bronze: { tier: 1, name: 'BRONZE', icon: '🥉', metal: 0xc87a35, ribbon: 0x7a3b1c, ui: '#e2954f' },
  silver: { tier: 2, name: 'SILVER', icon: '🥈', metal: 0xc9cdd6, ribbon: 0x3d4657, ui: '#d8dde6' },
  gold:   { tier: 3, name: 'GOLD',   icon: '🥇', metal: 0xffd94d, ribbon: 0x6b4a12, ui: '#ffd94d' }
};
const MEDAL_BY_TIER = { 1: 'bronze', 2: 'silver', 3: 'gold' };
function medalOf(id) {
  const t = (save.medals && save.medals[id]) | 0;
  return t ? MEDALS[MEDAL_BY_TIER[t]] : null;
}

const TOURNAMENTS = {
  bronze: { name: 'BRONZE', medal: '🥉', champion: 'vicious',
            order: ['bean', 'joe', 'blaze', 'honk', 'vicious'] },
  silver: { name: 'SILVER', medal: '🥈', champion: 'bigwave',
            order: ['joeabove', 'brick', 'mitchell', 'bull', 'bigwave'] },
  gold: { name: 'GOLD', medal: '🥇', champion: 'hound',
          order: ['presto', 'peter', 'jimmy', 'gustavo', 'hound'] },
  challenge: { name: 'CHALLENGE', medal: '⚔️', champion: null,
               order: CHALLENGE_IDS, challenge: true }
};
function isChallenge() { return game.tournament === 'challenge'; }
const CHIP_FACE = { joe: '🥊', bean: '👑', blaze: '🔥', honk: '🤡', vicious: '💀',
                    joeabove: '🕶️', brick: '🧱', bull: '🐂', bigwave: '🌊',
                    presto: '⚡', peter: '🍔', jimmy: '🪙', gustavo: '🪓', hound: '🐺',
                    mitchell: '🚓', slumber: '🪓' };
const SAVE_KEY = 'lob_save_v1';

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Array.isArray(s.unlocked) && s.unlocked.length) {
      return { unlocked: s.unlocked.filter(id => ROSTER.includes(id)),
               settings: s.settings, bronzeWon: !!s.bronzeWon, silverWon: !!s.silverWon,
               steroids: s.steroids | 0, stacks: s.stacks || {}, medals: s.medals || {},
               team: Array.isArray(s.team) ? s.team.filter(id => ROSTER.includes(id)).slice(0, 3) : [],
               challengesWon: s.challengesWon || {} };
    }
  } catch (e) { /* storage unavailable */ }
  return { unlocked: ['joe'], bronzeWon: false, silverWon: false, steroids: 0,
           stacks: {}, medals: {}, team: ['joe'], challengesWon: {} };
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
const save = loadSave();
const isUnlocked = (id) => save.unlocked.indexOf(id) >= 0;

// ---- STEROIDS ----------------------------------------------------------
// A shared pool of steroids you spend on whichever fighter you like: up to 5
// health stacks (+20% each) and 5 damage stacks (+15% each) per fighter.
const STEROID_MAX = 5;
save.steroids = save.steroids | 0;
save.stacks = save.stacks || {};
function getSteroids(id) {
  const s = save.stacks[id];
  return { hp: s ? (s.hp | 0) : 0, dmg: s ? (s.dmg | 0) : 0 };
}
function spendSteroid(id, kind) {
  if (save.steroids <= 0) return false;
  const s = save.stacks[id] || (save.stacks[id] = { hp: 0, dmg: 0 });
  if ((s[kind] | 0) >= STEROID_MAX) return false;
  s[kind] = (s[kind] | 0) + 1;
  save.steroids--;
  persist();
  return true;
}
// ---- RAGE --------------------------------------------------------------
// Take a hit with steroids in you and you might black out: the wrestler keeps
// swinging for a few seconds WITHOUT you. You watch from inside your own head.
const RAGE_CHANCE_PER_STEROID = 0.015;   // 1.5% a hit per steroid -> 15% maxed
const RAGE_HP_GATE = 0.40;               // ...and only once you're in trouble
const RAGE_MIN = 3, RAGE_MAX = 10;       // seconds
const RAGE_CAP = 10;                     // an extension never pushes past this
function rageChanceFor(b) {
  if (!b || !b.isPlayer || !b.cfg) return 0;
  if (b.hp > b.maxHp * RAGE_HP_GATE) return 0;   // you snap when you're cornered
  const s = getSteroids(b.cfg.id);
  return ((s.hp | 0) + (s.dmg | 0)) * RAGE_CHANCE_PER_STEROID;
}

// scale a fixed special-move number by the attacker's damage stacks
function sp(attacker, base) {
  return Math.round(base * ((attacker && attacker.dmgScale) || 1));
}

const DEFAULT_SETTINGS = { music: 1, sfx: 1, invertY: false, invertX: false, difficulty: 'normal' };

// The AI `heat` dial alone bottoms out around 0.35 — below that the enemy
// stops getting any easier — so Easy also takes a bite out of enemy damage.
const DIFFICULTY = {
  easy:   { label: 'EASY',   note: 'Enemies hit softer and think slower', heat: 0.45, enemyDmg: 0.75 },
  normal: { label: 'NORMAL', note: 'The fight as it was tuned',            heat: 1,    enemyDmg: 1 },
  hard:   { label: 'HARD',   note: 'Enemies hit harder and press you',     heat: 1.25, enemyDmg: 1.2 }
};
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];
function difficulty() { return DIFFICULTY[settingsValue('difficulty')] || DIFFICULTY.normal; }
// ai.js reads this when it builds a controller
window.difficultyHeat = () => difficulty().heat;
save.settings = Object.assign({}, DEFAULT_SETTINGS, save.settings || {});
function settingsValue(k) { return save.settings ? save.settings[k] : DEFAULT_SETTINGS[k]; }

function applyAudioSettings() {
  if (AudioFX.sfxBus) AudioFX.sfxBus.gain.value = settingsValue('sfx');
  if (Music.bus) Music.bus.gain.value = 0.14 * settingsValue('music');
  if (Music.el) Music.el.volume = Music.trackVol();
}
// the menu song starts on the very first click or key (browsers keep a page silent until then)
function kickMenuMusic() {
  if (game.state === 'menu' || game.state === 'select') Music.play('menu');
  document.removeEventListener('pointerdown', kickMenuMusic); document.removeEventListener('keydown', kickMenuMusic);
}
document.addEventListener('pointerdown', kickMenuMusic); document.addEventListener('keydown', kickMenuMusic);

let settingsReturn = null;
function syncSettingsUI() {
  const s = save.settings;
  const music = $('set-music'), sfx = $('set-sfx');
  music.value = Math.round(s.music * 100);
  sfx.value = Math.round(s.sfx * 100);
  music.style.setProperty('--fill', music.value + '%');
  sfx.style.setProperty('--fill', sfx.value + '%');
  $('set-music-val').textContent = music.value + '%';
  $('set-sfx-val').textContent = sfx.value + '%';
  for (const [key, id] of [['invertY', 'set-invert-y'], ['invertX', 'set-invert-x']]) {
    const btn = $(id);
    btn.textContent = s[key] ? 'ON' : 'OFF';
    btn.classList.toggle('on', !!s[key]);
  }
  const diff = difficulty();
  $('set-difficulty').textContent = diff.label;
  $('set-difficulty').classList.toggle('on', settingsValue('difficulty') !== 'normal');
  $('set-difficulty-note').textContent = diff.note;
  $('set-progress-count').textContent = save.unlocked.length + ' of ' + ROSTER.length + ' wrestlers unlocked';
  const reset = $('btn-reset');
  reset.textContent = 'RESET PROGRESS';
  reset.classList.remove('confirm');
  reset.disabled = false;
}

function openSettings(from) {
  settingsReturn = from;
  syncSettingsUI();
  hide('pause-overlay');
  show('settings');
}
function closeSettings() {
  hide('settings');
  if (settingsReturn === 'pause') updatePauseOverlay();
  settingsReturn = null;
}

$('set-music').addEventListener('input', (e) => {
  save.settings.music = e.target.value / 100;
  e.target.style.setProperty('--fill', e.target.value + '%');
  $('set-music-val').textContent = e.target.value + '%';
  applyAudioSettings();
  persist();
});
$('set-sfx').addEventListener('input', (e) => {
  save.settings.sfx = e.target.value / 100;
  e.target.style.setProperty('--fill', e.target.value + '%');
  $('set-sfx-val').textContent = e.target.value + '%';
  applyAudioSettings();
  persist();
});
$('set-sfx').addEventListener('change', () => { AudioFX.hit(0.8); }); // preview the level
for (const [key, id] of [['invertY', 'set-invert-y'], ['invertX', 'set-invert-x']]) {
  $(id).addEventListener('click', () => {
    save.settings[key] = !save.settings[key];
    persist();
    syncSettingsUI();
  });
}

let resetArmed = false;
$('btn-reset').addEventListener('click', () => {
  const btn = $('btn-reset');
  if (!resetArmed) {
    resetArmed = true;
    btn.textContent = 'TAP AGAIN TO WIPE';
    btn.classList.add('confirm');
    setTimeout(() => {
      if (!resetArmed) return;
      resetArmed = false;
      btn.textContent = 'RESET PROGRESS';
      btn.classList.remove('confirm');
    }, 3500);
    return;
  }
  resetArmed = false;
  save.unlocked.length = 0;
  save.unlocked.push('joe');
  persist();
  save.bronzeWon = false;
  save.silverWon = false;
  save.steroids = 0;
  save.stacks = {};
  save.medals = {};
  save.team = ['joe'];
  persist();
  game.selectedId = 'joe';
  setTournament('bronze');
  renderRoster();
  syncSettingsUI();
  btn.textContent = 'PROGRESS RESET';
  btn.disabled = true;
  AudioFX.wipe();
});

// ---- CHEAT CODE --------------------------------------------------------
// Types the magic words, gets the whole locker room and every cup.
const CHEAT_CODE = 'caseoh';
let cheatFlash = 0;
function tryCheat() {
  const input = $('set-cheat'), btn = $('btn-cheat');
  const typed = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
  clearTimeout(cheatFlash);
  btn.classList.remove('ok', 'bad');
  if (typed !== CHEAT_CODE) {
    btn.classList.add('bad');
    btn.textContent = 'NOPE';
    AudioFX.init(); AudioFX.boo();
    cheatFlash = setTimeout(() => { btn.classList.remove('bad'); btn.textContent = 'GO'; }, 1800);
    return;
  }
  for (const id of ROSTER) if (!isUnlocked(id)) save.unlocked.push(id);
  save.bronzeWon = true;
  save.silverWon = true;
  persist();
  input.value = '';
  renderRoster();
  syncSettingsUI();
  btn.classList.add('ok');
  btn.textContent = 'ALL IN';
  AudioFX.init(); AudioFX.fanfare(true);
  cheatFlash = setTimeout(() => { btn.classList.remove('ok'); btn.textContent = 'GO'; }, 2600);
}
$('set-difficulty').addEventListener('click', () => {
  const i = DIFFICULTY_ORDER.indexOf(settingsValue('difficulty'));
  save.settings.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
  persist();
  syncSettingsUI();
  AudioFX.init(); AudioFX.clang();
});

$('btn-cheat').addEventListener('click', tryCheat);
$('set-cheat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tryCheat(); } });

$('btn-settings').addEventListener('click', () => { AudioFX.init(); Music.play('menu'); openSettings('menu'); });
$('btn-settings-close').addEventListener('click', closeSettings);
$('cup-bronze').addEventListener('click', () => setTournament('bronze'));
$('cup-silver').addEventListener('click', () => setTournament('silver'));
$('cup-gold').addEventListener('click', () => setTournament('gold'));

$('juice-hp').addEventListener('click', () => { if (spendSteroid(game.selectedId, 'hp')) { AudioFX.powerUp(); selectBoxer(game.selectedId); } });
$('juice-dmg').addEventListener('click', () => { if (spendSteroid(game.selectedId, 'dmg')) { AudioFX.powerUp(); selectBoxer(game.selectedId); } });

// one spinning display model per boxer, built on demand
const selectModels = {};
function showSelectModel(id) {
  for (const k in selectModels) selectModels[k].root.visible = false;
  if (!id) return;
  if (!selectModels[id]) {
    const mdl = new Boxer(id, scene, false);
    mdl.resetFor(new THREE.Vector3(0, RING.top, 0.4), 0);
    mdl.displayPose = true;
    selectModels[id] = mdl;
  }
  selectModels[id].wearMedal(medalOf(id));   // champions keep the hardware on
  selectModels[id].root.visible = true;
}
function hideSelectModels() { for (const k in selectModels) selectModels[k].root.visible = false; }

// {d:60} -> 60 scaled by your damage stacks, {h:150} -> by your health stacks.
// Same rounding the combat code uses, so the card never lies about the numbers.
function scaleDesc(text, st) {
  if (!text) return '';
  const dmgScale = 1 + 0.15 * (st ? st.dmg : 0);
  // {h:n} stays flat — health steroids raise your pool, never your healing
  return text.replace(/\{([dh]):(\d+)\}/g, (_, kind, n) => {
    const scaled = kind === 'd' ? Math.round(Number(n) * dmgScale) : Number(n);
    const boost = scaled !== Number(n);
    return boost ? '<b class="juiced">' + scaled + '</b>' : String(scaled);
  });
}

function statRow(label, val, max, cls) {
  return '<div class="stat"><span>' + label + '</span><div class="bar"><div class="fill ' + cls +
    '" style="--w:' + Math.round(val / max * 100) + '%"></div></div><b>' + val + '</b></div>';
}
function tierClass(v, hi, mid) { return v >= hi ? 'f-high' : v >= mid ? 'f-avg' : 'f-low'; }

function selectBoxer(id) {
  game.selectedId = id;
  const c = BOXER_DEFS[id];
  $('sel-name').textContent = c.name;
  $('sel-name').style.color = c.uiColor;
  $('sel-tag').textContent = '"' + c.tag + '"';
  const won = medalOf(id);
  $('sel-medal').innerHTML = won
    ? '<span class="sel-medal-icon">' + won.icon + '</span>' + won.name + ' CHAMPION'
    : '';
  $('sel-medal').style.color = won ? won.ui : '';
  // the card shows YOUR numbers: player-side base plus steroid stacks
  const st = getSteroids(id);
  const shownHp = Math.round((c.playerHp != null ? c.playerHp : c.maxHp) * (1 + 0.20 * st.hp));
  const shownDmg = Math.round((c.playerDmg != null ? c.playerDmg : c.dmg) * (1 + 0.15 * st.dmg));
  $('sel-stats').innerHTML =
    statRow('HEALTH', shownHp, 750, tierClass(shownHp, 420, 250)) +
    (sp => statRow('SPEED', sp, 200, tierClass(sp, 125, 100)))(
      c.playerSpeed != null ? c.playerSpeed : c.speed) +
    statRow('POWER', shownDmg, 50, tierClass(shownDmg, 40, 25));
  // your card quotes YOUR numbers — and the special's numbers move with your
  // steroid stacks, so {d:n} scales by damage and {h:n} by health
  $('sel-special').innerHTML = '<b>SPECIAL — ' + c.specialName + ':</b> ' +
    scaleDesc(c.playerSpecialDesc || c.specialDesc, st);
  showSelectModel(id);
  renderJuice();
  syncRosterActive();
  renderTeam();
}

function setTournament(t) {
  if (t === 'silver' && !save.bronzeWon) return;
  if (t === 'gold' && !save.silverWon) return;
  game.tournament = t;
  for (const key of ['bronze', 'silver', 'gold']) {
    $('cup-' + key).classList.toggle('active', key === t);
  }
  // the cup row is for tournaments; a challenge is entered from the main menu
  $('cups-row').classList.toggle('hidden', t === 'challenge');
  $('btn-start').textContent = t === 'challenge'
    ? '⚔️ TAKE THE CHALLENGE'
    : 'ENTER ' + TOURNAMENTS[t].name + ' TOURNAMENT';
  $('sel-title').textContent = t === 'challenge' ? 'CHOOSE YOUR CHALLENGER' : 'CHOOSE YOUR WRESTLER';
  renderTeam();          // the slot count changes between 3 and 1
  renderRoster();
}

function renderJuice() {
  const id = game.selectedId;
  const st = getSteroids(id);
  $('juice-count').textContent = save.steroids;
  const pips = (n) => '●'.repeat(n) + '○'.repeat(STEROID_MAX - n);
  $('juice-hp-pips').textContent = pips(st.hp);
  $('juice-dmg-pips').textContent = pips(st.dmg);
  $('juice-hp').disabled = save.steroids <= 0 || st.hp >= STEROID_MAX;
  $('juice-dmg').disabled = save.steroids <= 0 || st.dmg >= STEROID_MAX;
}

// ------------------------------------------------------------
// Roster portraits — each chip shows a render of that fighter's actual
// head, framed three-quarter, instead of a stock emoji.
// ------------------------------------------------------------
const chipArt = {};
let portraitRig = null;
function portraitRigInit() {
  if (portraitRig !== null) return portraitRig;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(2);
    r.setSize(72, 72, false);
    const sc = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xfff2e0, 1.25); key.position.set(-1.5, 2.4, 3.4);
    const rim = new THREE.DirectionalLight(0x9fc0ff, 0.55); rim.position.set(2.6, 1.0, -1.8);
    sc.add(key, rim, new THREE.AmbientLight(0xffffff, 0.42));
    portraitRig = { r, sc, cam: new THREE.PerspectiveCamera(30, 1, 0.05, 60) };
  } catch (e) {
    portraitRig = false;   // no second GL context available — emoji it is
  }
  return portraitRig;
}
// What counts as "the head" varies by build: most fighters keep their face in
// the neck group, but King Bean's dome, eyes, brows and mouth hang off the torso
// (they're flagged headPart at build time) — framing on the neck alone gave him a
// portrait of his crown and nothing else.
function headBox(mdl) {
  const box = new THREE.Box3().setFromObject(mdl.parts.neck);
  for (const child of mdl.parts.torso.children) {
    if (!child.userData || !child.userData.headPart) continue;
    box.union(new THREE.Box3().setFromObject(child));
  }
  return box;
}

function portraitFor(id) {
  if (chipArt[id]) return chipArt[id];
  const rig = portraitRigInit();
  if (!rig) return null;
  const { r, sc, cam } = rig;
  const mdl = new Boxer(id, sc, false);
  mdl.resetFor(new THREE.Vector3(0, 0, 0), 0);
  mdl.displayPose = true;
  mdl.yaw = 0.28;                     // three-quarter turn has more character than face-on
  mdl.update(0.0001, 0, null);
  mdl.root.rotation.y = mdl.yaw;
  mdl.root.quaternion.setFromEuler(mdl.root.rotation);
  mdl.root.updateWorldMatrix(true, true);
  // frame on the head group so crowns, mohawks and topknots all fit
  const box = headBox(mdl);
  const mid = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // tight on the head: enough headroom for crowns and topknots, and aimed a
  // touch high so the chest stays out of frame instead of blobbing the bottom
  const extent = Math.max(size.x, size.y, size.z, 0.3);
  const d = (extent / 0.70) * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5));
  cam.position.set(mid.x + d * 0.33, mid.y + d * 0.13, mid.z + d * 0.93);
  cam.lookAt(mid.x, mid.y + extent * 0.10, mid.z);
  r.render(sc, cam);
  const url = r.domElement.toDataURL('image/png');
  sc.remove(mdl.root);
  mdl.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(x => x.dispose());
  });
  chipArt[id] = url;
  return url;
}
// built one at a time so opening the select screen never hitches. Driven by
// timers rather than animation frames: a backgrounded tab stops servicing rAF
// and the strip would sit there half-empty.
function drainPortraits() {
  if (!$('roster').querySelector('[data-art]')) return;
  setTimeout(() => {
    const pending = $('roster').querySelector('[data-art]');
    if (!pending) return;
    const id = pending.dataset.art;
    const url = portraitFor(id);
    pending.outerHTML = url
      ? '<img class="chip-art" src="' + url + '" alt="">'
      : CHIP_FACE[id];
    drainPortraits();
  }, 0);
}

const TEAM_MAX = 3;
// A challenge is a solo test — you bring exactly one wrestler.
function teamMax() { return isChallenge() ? 1 : TEAM_MAX; }
function teamList() {
  // only wrestlers you actually own, capped, order preserved
  save.team = (save.team || []).filter(id => isUnlocked(id)).slice(0, TEAM_MAX);
  if (!save.team.length) save.team = [save.unlocked[0] || 'joe'];
  return save.team.slice(0, teamMax());
}
function toggleTeam(id) {
  const max = teamMax();
  if (max === 1) { save.team = [id]; persist(); return; }   // solo: just swap
  const t = save.team;
  const at = t.indexOf(id);
  if (at >= 0) {
    if (t.length > 1) t.splice(at, 1);      // never leave yourself with nobody
  } else if (t.length < max) {
    t.push(id);
  } else {
    t[max - 1] = id;                        // full: swap out the last slot
  }
  persist();
}
function renderTeam() {
  const t = teamList();
  const el = $('team-slots');
  el.innerHTML = '';
  const max = teamMax();
  for (let i = 0; i < max; i++) {
    const id = t[i];
    const slot = document.createElement('div');
    slot.className = 'team-slot' + (id ? ' filled' : '');
    slot.innerHTML = id
      ? '<span class="slot-order">' + (i + 1) + '</span>' +
        (chipArt[id] ? '<img src="' + chipArt[id] + '" alt="">' : '<span class="slot-num">' + CHIP_FACE[id] + '</span>')
      : '<span class="slot-num">' + (i + 1) + '</span>';
    if (id) slot.title = BOXER_DEFS[id].name + ' — click to drop';
    if (id) slot.addEventListener('click', () => { toggleTeam(id); refreshTeamUI(); });
    el.appendChild(slot);
  }
  $('team-hint').textContent = max === 1
    ? 'CHALLENGE — one wrestler only. No tag-ins, no second chances.'
    : (t.length < max
        ? 'Pick up to 3 — they tag in when one gets thrown out'
        : 'They tag in when one gets thrown out. Lose all 3 and the run is over.');
}
function refreshTeamUI() {
  renderTeam();
  syncRosterActive();
  setTournament(game.tournament || 'bronze');
}

function renderRoster() {
  const el = $('roster');
  el.innerHTML = '';
  for (const id of ROSTER) {
    const c = BOXER_DEFS[id];
    const open = isUnlocked(id);
    const chip = document.createElement('div');
    chip.className = 'chip' + (open ? '' : ' locked') + (id === game.selectedId ? ' active' : '');
    chip.dataset.id = id;
    // no HP here: the chip can't know whose numbers to quote (yours differ
    // from the enemy build), so the real stats live on the card instead.
    const face = open
      ? (chipArt[id] ? '<img class="chip-art" src="' + chipArt[id] + '" alt="">'
                     : '<span data-art="' + id + '"></span>')
      : '🔒';
    const won = open ? medalOf(id) : null;
    const slot = teamList().indexOf(id);
    if (slot >= 0) chip.classList.add('on-team');
    chip.innerHTML =
      (slot >= 0 ? '<div class="chip-team-num">' + (slot + 1) + '</div>' : '') +
      (won ? '<div class="chip-medal ' + won.name.toLowerCase() + '" title="' + won.name +
             ' champion">' + won.icon + '</div>' : '') +
      '<div class="chip-face">' + face + '</div>' +
      '<div class="chip-name">' + (open ? c.name.split(' ')[0] : '???') + '</div>' +
      (open ? '' : '<div class="chip-hp">BEAT THEM</div>');
    if (open) chip.addEventListener('click', () => { toggleTeam(id); selectBoxer(id); renderTeam(); });
    el.appendChild(chip);
  }
  drainPortraits();
  syncCupLocks();
}

function syncCupLocks() {
  const done = save.challengesWon && CHALLENGE_IDS.every(id => save.challengesWon[id]);
  $('btn-challenges').classList.toggle('cleared', !!done);
  $('cup-silver').classList.toggle('locked', !save.bronzeWon);
  $('cup-silver').title = save.bronzeWon ? '' : 'Win the Bronze Tournament first';
  $('cup-gold').classList.toggle('locked', !save.silverWon);
  $('cup-gold').title = save.silverWon ? '' : 'Win the Silver Tournament first';
}

// Move the highlight without rebuilding the strip. Re-rendering it on every
// pick reset the scroll and yanked the chip you clicked into the middle.
function syncRosterActive() {
  const t = teamList();
  for (const chip of $('roster').children) {
    const id = chip.dataset.id;
    chip.classList.toggle('active', id === game.selectedId);
    const slot = t.indexOf(id);
    chip.classList.toggle('on-team', slot >= 0);
    let badge = chip.querySelector('.chip-team-num');
    if (slot >= 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'chip-team-num';
        chip.insertBefore(badge, chip.firstChild);
      }
      badge.textContent = slot + 1;
    } else if (badge) badge.remove();
  }
  syncCupLocks();
}

// only on opening the screen, and only if your pick is off in the unscrolled part
function revealActiveChip() {
  const el = $('roster');
  const active = el.querySelector('.chip.active');
  if (!active) return;
  if (!el.clientWidth) return;
  const left = active.offsetLeft, right = left + active.offsetWidth;
  if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
    el.scrollLeft = left - (el.clientWidth - active.offsetWidth) / 2;
  }
}

let unlockNext = null;
function showUnlock(id, next) {
  const c = BOXER_DEFS[id];
  $('roll-label').style.display = 'none';   // the name says it — no banner over it
  const nameEl = $('roll-name');
  nameEl.textContent = c.name;
  nameEl.style.color = c.uiColor;
  nameEl.classList.remove('settled');
  void nameEl.offsetWidth;
  nameEl.classList.add('settled');
  $('roll-sub').textContent = c.specialName + ' — "' + c.tag + '"';
  show('roll-overlay');
  AudioFX.fanfare(true);
  world.crowd.excitement = 1;
  unlockNext = () => {
    clearTimeout(game.unlockTimer);
    unlockNext = null;
    hide('roll-overlay');
    next();
  };
  game.unlockTimer = setTimeout(() => { if (unlockNext) unlockNext(); }, 2600);
}
$('roll-overlay').addEventListener('click', () => { if (unlockNext) unlockNext(); });

// ============ CHALLENGES SCREEN ============
// Challenges get their own screen: pick the boss, read their card, then pick
// the single wrestler you're sending in alone.
let chBossId = null;
function openChallenges() {
  AudioFX.init(); AudioFX.setCrowd(0.08); Music.play('menu');
  hide('menu'); hide('end-screen'); hide('cutscene'); hide('select');
  show('challenge-select');
  game.state = 'select';
  game.tournament = 'challenge';
  if (!chBossId || !challengeFor(chBossId)) chBossId = CHALLENGE_IDS[0];
  if (!isUnlocked(game.selectedId)) game.selectedId = save.unlocked[0] || 'joe';
  renderChallengeBosses();
  renderChallengeRoster();
  pickChallengeBoss(chBossId);
  pickChallenger(teamList()[0] || game.selectedId);
}
function renderChallengeBosses() {
  const el = $('ch-bosses');
  el.innerHTML = '';
  for (const ch of CHALLENGES) {
    const c = BOXER_DEFS[ch.id];
    const done = !!(save.challengesWon || {})[ch.id];
    const row = document.createElement('div');
    row.className = 'ch-boss' + (ch.id === chBossId ? ' active' : '') + (done ? ' cleared' : '');
    const art = portraitFor(ch.id);
    row.innerHTML =
      (art ? '<img src="' + art + '" alt="">' : '<span style="font-size:26px">' + (CHIP_FACE[ch.id] || '⚔️') + '</span>') +
      '<span class="ch-boss-label">' + c.name + '</span>' +
      '<span class="ch-boss-tick">' + (done ? '✔' : '—') + '</span>';
    row.addEventListener('click', () => pickChallengeBoss(ch.id));
    el.appendChild(row);
  }
  drainPortraits();
}
function pickChallengeBoss(id) {
  chBossId = id;
  const c = BOXER_DEFS[id], ch = challengeFor(id);
  const done = !!(save.challengesWon || {})[id];
  [...$('ch-bosses').children].forEach((row, i) =>
    row.classList.toggle('active', CHALLENGES[i].id === id));
  const art = portraitFor(id);
  $('ch-boss-face').innerHTML = art ? '<img src="' + art + '" alt="">' : (CHIP_FACE[id] || '⚔️');
  $('ch-boss-name').textContent = c.name;
  $('ch-boss-name').style.color = c.uiColor;
  $('ch-boss-tag').textContent = '"' + c.tag + '"';
  // a boss card quotes the ENEMY numbers — that's what you're walking into
  $('ch-boss-stats').innerHTML =
    statRow('HEALTH', c.maxHp, 750, tierClass(c.maxHp, 420, 250)) +
    statRow('SPEED', c.speed, 200, tierClass(c.speed, 125, 100)) +
    statRow('POWER', c.dmg, 50, tierClass(c.dmg, 40, 25));
  $('ch-boss-special').innerHTML = '<b>SPECIAL — ' + c.specialName + ':</b> ' + c.specialDesc;
  $('ch-reward').textContent = done
    ? '✔ CLEARED — first-clear reward already banked'
    : '💉 FIRST CLEAR REWARD: +' + (ch ? ch.reward : 0) + ' STEROIDS';
  $('ch-reward').classList.toggle('claimed', done);
  drainPortraits();
}
function renderChallengeRoster() {
  const el = $('ch-roster');
  el.innerHTML = '';
  for (const id of ROSTER) {
    const c = BOXER_DEFS[id];
    const open = isUnlocked(id);
    const chip = document.createElement('div');
    chip.className = 'chip' + (open ? '' : ' locked') + (id === game.selectedId ? ' active' : '');
    chip.dataset.id = id;
    const art = open ? portraitFor(id) : null;
    const face = open
      ? (art ? '<img class="chip-art" src="' + art + '" alt="">' : '<span data-art="' + id + '"></span>')
      : '🔒';
    chip.innerHTML = '<div class="chip-face">' + face + '</div>' +
      '<div class="chip-name">' + (open ? c.name.split(' ')[0] : '???') + '</div>';
    if (open) chip.addEventListener('click', () => pickChallenger(id));
    el.appendChild(chip);
  }
  drainPortraits();
}
function pickChallenger(id) {
  if (!isUnlocked(id)) return;
  game.selectedId = id;
  save.team = [id];               // a challenge team is exactly one wrestler
  persist();
  const c = BOXER_DEFS[id];
  const st = getSteroids(id);
  const hp = Math.round((c.playerHp != null ? c.playerHp : c.maxHp) * (1 + 0.20 * st.hp));
  const dmg = Math.round((c.playerDmg != null ? c.playerDmg : c.dmg) * (1 + 0.15 * st.dmg));
  const spd = c.playerSpeed != null ? c.playerSpeed : c.speed;
  $('ch-you-pick').textContent = c.name;
  $('ch-you-pick').style.color = c.uiColor;
  $('ch-you-stats').textContent = hp + ' HP · ' + spd + ' SPEED · ' + dmg + ' POWER';
  [...$('ch-roster').children].forEach(chip =>
    chip.classList.toggle('active', chip.dataset.id === id));
}

function openSelect() {
  if (isChallenge()) { openChallenges(); return; }   // challenges have their own
  AudioFX.init(); AudioFX.setCrowd(0.08); Music.play('menu');
  hide('menu'); hide('end-screen'); hide('cutscene');
  show('select');
  game.state = 'select';
  if (!isUnlocked(game.selectedId)) game.selectedId = 'joe';
  if (game.tournament === 'silver' && !save.bronzeWon) game.tournament = 'bronze';
  if (game.tournament === 'gold' && !save.silverWon) game.tournament = save.bronzeWon ? 'silver' : 'bronze';
  setTournament(game.tournament || 'bronze');
  renderRoster();
  renderTeam();
  selectBoxer(teamList()[0] || 'joe');
  // after layout, or the strip's width reads as zero and the maths lands wrong
  setTimeout(revealActiveChip, 0);
}

// ------------------------------------------------------------
// Screen flow
// ------------------------------------------------------------
$('btn-fight').addEventListener('click', () => {
  if (isChallenge()) setTournament('bronze');   // FIGHT always means a tournament
  openSelect();
});
$('btn-challenges').addEventListener('click', openChallenges);
$('ch-back').addEventListener('click', () => {
  hide('challenge-select'); show('menu'); game.state = 'menu';
  setTournament('bronze');
});
$('ch-start').addEventListener('click', () => {
  hide('challenge-select');
  game.tournament = 'challenge';
  // the ladder is the ONE boss you chose, not the whole challenge list
  startTournament(game.selectedId);
});
$('btn-controls').addEventListener('click', () => { Music.play('menu'); $('controls-panel').classList.toggle('hidden'); });
$('btn-back').addEventListener('click', () => { hide('select'); hideSelectModels(); show('menu'); game.state = 'menu'; });
$('btn-start').addEventListener('click', () => startTournament(game.selectedId));

$('btn-rematch').addEventListener('click', () => { hide('end-screen'); startTournament(game.selectedId); });
$('btn-reselect').addEventListener('click', () => { cleanupMatch(); openSelect(); });
$('btn-menu').addEventListener('click', () => {
  hide('end-screen'); cleanupMatch(); hideSelectModels();
  Music.play('menu'); show('menu'); game.state = 'menu';
});

$('cutscene').addEventListener('click', () => { if (game.state === 'cutscene') startFight(); });

function cleanupMatch() {
  if (game.player) game.player.rage = null;
  $('hud').classList.remove('raging');
  // The charge you built is yours for the whole run — it follows you into the
  // next fight, and onto the next wrestler if this one goes over the ropes.
  // Banked as a FRACTION because wrestlers need different punch counts.
  if (game.player) game.carryMeter = game.player.meter;
  if (game.player) { scene.remove(game.player.root); game.player = null; }
  if (game.enemy) { scene.remove(game.enemy.root); game.enemy = null; }
  game.ai = null;
  game.suplexes = [];
  game.piledrivers = [];
  game.ringWarp = 0;
  clearCoins();
  clearCracks();
  container.classList.remove('ko-grey');
  hide('hud'); hide('ko-overlay'); hide('pause-overlay');
}
function clearCutModel() {
  if (game.cutModel) { scene.remove(game.cutModel.root); game.cutModel = null; }
}

// ------------------------------------------------------------
// Supply crates — the reward for winning a fight
// ------------------------------------------------------------
// Every opponent you throw out is a 20% roll for a supply crate, in every
// tournament, up to three per run. Earned rather than issued.
const SWAT_PUSH = 7.5, SWAT_LIFT = 3.75;   // 2.5x the old 3/1.5 shove
const KO_MAX = 8;                     // ...and can't be pinned down forever
const CRATE_CHANCE = 0.20;
const CRATES_MAX_PER_RUN = 3;
const CRATE_CONSOLATION = 0.25;   // threw nobody out all run? one last roll
const UPGRADE_CHANCES = 4;          // clicks you get to gamble the rarity up
// Each chance: 15% climbs one tier, 10% climbs two, the rest is a dud.
const UPGRADE_ONE = 0.10;
const UPGRADE_TWO = 0.05;

// Each rarity's loot table, as cumulative thresholds on one roll.
// [nothing, one, two, three]
const RARITY = [
  { name: 'COMMON',   cls: 'common',   odds: [0.50, 0.50, 0.00, 0.00] },
  { name: 'RARE',     cls: 'rare',     odds: [0.40, 0.30, 0.20, 0.10] },
  { name: 'EPIC',     cls: 'epic',     odds: [0.20, 0.40, 0.25, 0.15] },
  { name: 'MYTHICAL', cls: 'mythical', odds: [0.00, 0.20, 0.40, 0.40] }
];

function rollLoot(tier) {
  const odds = RARITY[tier].odds;
  let r = Math.random(), acc = 0;
  for (let i = 0; i < odds.length; i++) {
    acc += odds[i];
    if (r < acc) return i;          // 0 = nothing, else that many steroids
  }
  return 0;
}

let crateQueue = 0, crateNext = null, crateState = 'upgrade';
let cratePending = 0, crateTier = 0, crateChances = UPGRADE_CHANCES;

function paintCrate() {
  const tier = RARITY[crateTier];
  const box = $('crate-box');
  box.className = 'crate-box ' + tier.cls + (box.classList.contains('open') ? ' open' : '');
  $('crate-rarity').textContent = tier.name;
  $('crate-rarity').className = 'crate-rarity ' + tier.cls;
  $('crate-sub').textContent = crateQueue + (crateQueue === 1 ? ' crate left · ' : ' crates left · ') +
    (crateTier >= RARITY.length - 1
      ? 'maxed out!'
      : crateChances + (crateChances === 1 ? ' upgrade chance' : ' upgrade chances'));
}

function beginCrate() {
  crateState = 'upgrade';
  cratePending = 0;
  crateTier = 0;
  crateChances = UPGRADE_CHANCES;
  $('crate-box').className = 'crate-box';
  $('crate-result').textContent = '';
  $('crate-result').className = 'crate-result';
  $('btn-crate').textContent = 'TRY UPGRADE';
  paintCrate();
}

function openCrates(count, next) {
  // an unlucky run earns nothing — don't show an empty crate screen
  if (count <= 0) { next(); return; }
  crateQueue = count;
  crateNext = next;
  $('crate-title').textContent = 'SUPPLY ' + (count === 1 ? 'CRATE' : 'CRATES');
  beginCrate();
  show('crate-screen');
  game.state = 'crates';
}

$('btn-crate').addEventListener('click', () => {
  const box = $('crate-box'), res = $('crate-result'), btn = $('btn-crate');

  // ---- phase 1: gamble the rarity upward ----
  if (crateState === 'upgrade') {
    crateChances--;
    const roll = Math.random();
    const gain = roll < UPGRADE_ONE ? 1 : (roll < UPGRADE_ONE + UPGRADE_TWO ? 2 : 0);
    const before = crateTier;
    if (gain > 0 && crateTier < RARITY.length - 1) {
      crateTier = Math.min(RARITY.length - 1, crateTier + gain);
      const jumped = crateTier - before;
      // No shouty line — the rarity label above the box already changes name
      // and colour, and the shake plus the sparkle sell the jump.
      res.className = 'crate-result upgraded' + (jumped > 1 ? ' double' : '');
      res.textContent = '';
      AudioFX.sparkle(jumped > 1 ? 6 : 4);
      box.classList.add('shaking');
      setTimeout(() => box.classList.remove('shaking'), 450);
    } else {
      res.className = 'crate-result nothing';
      res.textContent = 'NO LUCK';
      AudioFX.hit(0.35);
    }
    if (crateChances <= 0 || crateTier >= RARITY.length - 1) {
      crateState = 'ready';
      btn.textContent = 'OPEN CRATE';
    }
    paintCrate();
    return;
  }

  // ---- phase 2: open it ----
  if (crateState === 'ready') {
    crateQueue--;
    cratePending = rollLoot(crateTier);
    crateState = 'revealed';
    box.classList.add('shaking');
    setTimeout(() => { box.classList.remove('shaking'); box.classList.add('open'); }, 420);
    setTimeout(() => {
      const shown = cratePending > 0 ? cratePending : 1;   // always teases at least one
      res.className = 'crate-result';
      res.textContent = '+' + shown + ' STEROID' + (shown > 1 ? 'S' : '') + '!';
      AudioFX.sparkle(3);
      btn.textContent = 'CLAIM';
    }, 620);
    btn.textContent = '...';
    return;
  }

  // ---- phase 3: claim (or get robbed) ----
  if (crateState === 'revealed') {
    if (cratePending > 0) {
      save.steroids += cratePending;
      persist();
      res.className = 'crate-result';
      res.textContent = 'CLAIMED +' + cratePending;
      AudioFX.fanfare();
    } else {
      res.className = 'crate-result toolate';
      res.textContent = 'TOO LATE!';
      AudioFX.hit(0.6);
    }
    crateState = 'claimed';
    $('crate-sub').textContent = crateQueue + (crateQueue === 1 ? ' crate left' : ' crates left');
    btn.textContent = crateQueue > 0 ? 'NEXT CRATE' : 'CONTINUE';
    return;
  }

  // ---- phase 4: next crate or leave ----
  if (crateQueue > 0) { beginCrate(); return; }
  hide('crate-screen');
  const go = crateNext;
  crateNext = null;
  if (go) go();
});

// ------------------------------------------------------------
// Bronze tournament ladder
// ------------------------------------------------------------
function startTournament(playerId) {   // eslint-disable-line no-param-reassign
  AudioFX.init();
  game.selectedId = playerId;
  const cup = TOURNAMENTS[game.tournament] || TOURNAMENTS.bronze;
  // the full field, yourself included — picking the champion used to delete him
  // from the ladder (and with him the title fight); now you meet your doppel
  // DUELS: you bring your whole team. A wrestler thrown out is gone for the
  // rest of the run — the next one tags in and carries on.
  game.team = teamList().slice(0, teamMax());
  game.teamDown = [];
  game.cratesWon = 0;
  game.selectedId = game.team[0];
  playerId = game.team[0];
  game.ladder = cup.order.slice();
  // A challenge is one wrestler against the ONE boss you picked.
  if (isChallenge()) game.ladder = [chBossId || CHALLENGE_IDS[0]];
  // Bronze eases you in: if your pick leads the field, swap them with the next
  // one so you never open your very first tournament against yourself. Silver
  // and gold have no such manners — walk in and the mirror is waiting.
  if (game.tournament === 'bronze' && game.ladder[0] === playerId && game.ladder.length > 1) {
    game.ladder[0] = game.ladder[1];
    game.ladder[1] = playerId;
  }
  game.fightIndex = 0;
  game.wonLast = false;
  cleanupMatch();
  game.carryMeter = null;   // a fresh run starts with an empty meter
  hideSelectModels();
  hide('select'); hide('menu'); hide('end-screen');
  beginCutscene();
}
// kept so a single fight can still be launched directly
function startMatch(playerId) { startTournament(playerId); }

let ceremonyNext = null;
function showCeremony(id, cupKey, next) {
  cleanupMatch();
  clearCutModel();
  const c = BOXER_DEFS[id];
  const won = MEDALS[cupKey] || MEDALS.bronze;
  const mdl = new Boxer(id, scene, false);
  mdl.resetFor(new THREE.Vector3(0, RING.top, 0.4), 0);
  mdl.displayPose = false;
  mdl.victoryT = 1;              // arms up, the pose he earned
  mdl.wearMedal(won);
  game.cutModel = mdl;
  game.cerT = 0;

  $('cer-cup').textContent = won.name + ' CHAMPION';
  $('cer-cup').style.color = won.ui;
  $('cer-name').textContent = c.name;
  $('cer-sub').textContent = 'The ' + won.name.charAt(0) + won.name.slice(1).toLowerCase() +
    ' medal is theirs for good — they\u2019ll wear it into every fight from here.';
  show('ceremony');
  game.state = 'ceremony';
  AudioFX.setCrowd(0.3);
  AudioFX.fanfare(true);
  AudioFX.roar();
  world.crowd.excitement = 1;
  Music.play('menu');

  ceremonyNext = () => {
    ceremonyNext = null;
    hide('ceremony');
    clearCutModel();
    AudioFX.setCrowd(0.12);
    next();
  };
}
$('ceremony').addEventListener('click', () => { if (ceremonyNext) ceremonyNext(); });

function beginCutscene() {
  cleanupMatch();
  clearCutModel();
  const oppId = game.ladder[game.fightIndex];
  const c = BOXER_DEFS[oppId];
  const mdl = new Boxer(oppId, scene, false);
  mdl.resetFor(new THREE.Vector3(0, RING.top, 0.4), 0);
  mdl.displayPose = true;
  game.cutModel = mdl;
  game.cutT = 0;
  game.cutPunchT = 0.9;

  const last = game.fightIndex === game.ladder.length - 1;
  const mirror = oppId === game.selectedId;
  $('cut-eyebrow').textContent = mirror
    ? 'MIRROR MATCH · YOUR OWN DOPPEL'
    : (game.wonLast ? 'OPPONENT DOWN · NEXT UP'
                    : (last ? 'FINAL BOSS' : 'FIRST OPPONENT'));
  $('cut-eyebrow').style.color = last ? '#ffd94d' : '';
  $('cut-name').textContent = c.name;
  $('cut-name').style.color = c.uiColor;
  $('cut-tag').textContent = '"' + c.tag + '"';
  $('cut-stats').innerHTML =
    '<span>' + c.maxHp + ' HP</span><span>' + c.speed + ' SPD</span><span>' + c.dmg + ' PWR</span>';
  $('cut-special').innerHTML = '<b>' + c.specialName + '</b> — ' + scaleDesc(c.specialDesc, null);

  show('cutscene');
  game.state = 'cutscene';
  AudioFX.setCrowd(0.16);
  AudioFX.omen();
  Music.play('menu');
  world.crowd.excitement = 0.8;
}

function startFight() {
  // one round per fight — except the title fight, which is a best of three
  hide('cutscene');
  clearCutModel();
  cleanupMatch();
  game.roundP = 0;
  game.roundE = 0;
  game.round = 1;
  const cup = TOURNAMENTS[game.tournament] || TOURNAMENTS.bronze;
  // the best-of-3 always belongs to the cup's champion — including when the
  // champion you have to beat is your own double
  game.isTitleFight = game.ladder[game.fightIndex] === cup.champion;
  game.roundsToWin = game.isTitleFight ? 2 : 1;
  // Everyone defends alone, champion included. The title is best-of-3 in the
  // plain sense: throw him out twice. Each round he comes back at full health,
  // your fallen wrestlers do not.
  game.enemyTeam = [game.ladder[game.fightIndex]];
  game.enemyDown = [];
  game.ringOutCam = null;
  paintVersusNames();
  const foeNow = BOXER_DEFS[game.ladder[game.fightIndex]];
  $('tourney-label').textContent = isChallenge()
    ? '⚔️ CHALLENGE · ' + (foeNow ? foeNow.name : '')
    : cup.medal + ' ' + cup.name + ' · FIGHT ' + (game.fightIndex + 1) + ' OF ' +
      game.ladder.length + (game.isTitleFight ? ' · TITLE FIGHT · BEST OF 3' : '');
  $('ladder').classList.toggle('hidden', isChallenge());
  $('ladder').innerHTML = game.ladder.map((_, i) =>
    '<div class="rung ' + (i < game.fightIndex ? 'done' : i === game.fightIndex ? 'now' : '') + '"></div>'
  ).join('');

  show('versus');
  game.state = 'versus';
  AudioFX.setCrowd(0.14);
  AudioFX.versus();
  // The splash IS the click that grabs the mouse — pointer lock needs a user
  // gesture, and this way you never see a separate READY? prompt.
  armVersusStart();
}

// The versus splash waits for your click, then locks the mouse and rings the
// opening horn in one gesture.
function armVersusStart() {
  $('vs-go').textContent = 'CLICK TO START';
  $('versus').classList.add('waiting');
}
$('versus').addEventListener('click', () => {
  if (game.state !== 'versus') return;
  $('versus').classList.remove('waiting');
  requestLock();
  startRound();
});

function renderRoundHud() {
  // the score strip only means anything in the best-of-three title fight
  $('round-hud').style.display = game.roundsToWin > 1 ? '' : 'none';
  if (game.roundsToWin <= 1) return;
  const pips = (n, cls) => {
    let out = '';
    for (let i = 0; i < 2; i++) out += '<div class="pip' + (i < n ? ' won' : '') + '"></div>';
    return out;
  };
  $('pips-p').className = 'pips mine';
  $('pips-e').className = 'pips theirs';
  $('pips-p').innerHTML = pips(game.roundP);
  $('pips-e').innerHTML = pips(game.roundE);
  $('round-label').textContent = 'ROUND ' + game.round;
}

// one round of the current match — fresh bodies, fresh health, same opponent
// Whoever is standing for the other side right now — the ladder opponent, or
// the next name on the champion's team once you've put one out.
// The splash names whoever is walking out RIGHT NOW. doTagIn used to change
// who was fighting without repainting these, so after a tag the screen still
// announced the wrestler who had just been thrown out.
function paintVersusNames() {
  $('vs-left').textContent = BOXER_DEFS[game.selectedId].name;
  $('vs-right').textContent = BOXER_DEFS[currentEnemyId()].name;
}

function currentEnemyId() {
  if (game.enemyTeam && game.enemyTeam.length) {
    return game.enemyTeam[Math.min(game.enemyDown ? game.enemyDown.length : 0, game.enemyTeam.length - 1)];
  }
  return game.ladder[game.fightIndex];
}

function startRound() {
  cleanupMatch();
  const playerId = game.selectedId;
  const enemyId = currentEnemyId();
  game.player = new Boxer(playerId, scene, true);
  game.enemy = new Boxer(enemyId, scene, false);
  game.player.resetFor(new THREE.Vector3(0, RING.top, 1.9), Math.PI);
  game.enemy.resetFor(new THREE.Vector3(0, RING.top, -1.9), 0);
  for (const b of [game.player, game.enemy]) {
    b.onSlamLand = (self) => combatAPI.slamImpact(self);
    b.onRollHit = (self) => combatAPI.rollImpact(self);
    b.onWallRelease = (self, stored) => combatAPI.wallRelease(self, stored);
    b.onChargeHit = (self) => combatAPI.chargeHit(self);
    b.onChargeMiss = (self) => combatAPI.chargeMiss(self);
    b.onSleepBump = (self) => combatAPI.sleepBump(self);
    b.onRicochetHit = (self) => combatAPI.ricochetHit(self);
    b.onRicochetBounce = (self, n) => combatAPI.ricochetBounce(self, n);
    b.onFeastStart = (self) => combatAPI.feastStart(self);
    b.onQuake = (self) => combatAPI.quakeHit(self);
  }
  game.ai = new AIController(game.enemy, game.player, combatAPI);

  game.matchOver = false;
  game.timeScale = 1;
  game.lastPhp = undefined; game.lastEhp = undefined;
  game.kickP = 0; game.kickY = 0;
  game.camEye = null;
  game.celebT = 0;
  game.endTimer = -1;
  game.camYaw = Math.PI;
  game.camPitch = -0.1;

  $('hp-name-p').textContent = game.player.cfg.name;
  $('hp-name-e').textContent = game.enemy.cfg.name;
  $('special-name').textContent = game.player.cfg.specialName;
  renderRoundHud();

  if (game.carryMeter != null) {
    // carried as a FRACTION, since wrestlers need different punch counts
    const need = game.player.cfg.meterPunches || 5;
    game.player.meterHits = Math.floor(game.carryMeter * need);
    game.player.meter = Math.min(1, game.player.meterHits / need);
    game.carryMeter = null;
  }
  hide('versus');
  show('hud');
  game.state = 'fight';
  game.fightIntro = 1.2;
  AudioFX.bell(3);   // seconds out — the classic three
  AudioFX.horn();
  Music.play(game.isTitleFight ? 'final' : 'fight');   // the champion gets the big song
  announce(game.round === 1 ? 'FIGHT!' : 'ROUND ' + game.round + '!');
  updatePauseOverlay();
}

// One wrestler is out for the run. Bring on the next — both corners come back
// at full health, same as they do between fights.
function doTagIn() {
  const playerFell = game.tagSide === 'player';
  game.tagSide = null;
  if (playerFell) {
    game.selectedId = game.team[game.teamDown.length];
    // (the charge itself is banked by cleanupMatch, same as between fights)
  }
  const left = playerFell
    ? game.team.length - game.teamDown.length
    : game.enemyTeam.length - game.enemyDown.length;
  $('tourney-label').textContent = playerFell
    ? 'TAG IN · ' + left + (left === 1 ? ' WRESTLER LEFT' : ' WRESTLERS LEFT')
    : 'THEY TAG IN · ' + left + ' TO GO';
  paintVersusNames();
  hide('hud');
  show('versus');
  game.state = 'versus';
  AudioFX.versus();
  armVersusStart();
}

// score the round, then either start the next one or settle the match
function finishRound() {
  if (document.pointerLockElement) document.exitPointerLock();
  hide('ko-overlay');
  container.classList.remove('ko-grey');
  Music.muffle(false);

  if (game.tagSide) { doTagIn(); return; }

  // Your whole corner is out — that's the run, regardless of the round score.
  // Without this the title fight scored a round and started the next one with
  // your last wrestler back on his feet.
  if (game.team && game.teamDown && game.teamDown.length >= game.team.length) {
    hide('hud');
    game.playerWon = false;
    finishFight();
    return;
  }

  if (game.playerWon) game.roundP++; else game.roundE++;
  renderRoundHud();
  // a fresh round restocks their corner; your losses are for good
  game.enemyDown = [];

  const need = game.roundsToWin || 1;
  if (game.roundP >= need || game.roundE >= need) {
    hide('hud');
    game.playerWon = game.roundP >= need;   // the MATCH result, not the round
    finishFight();
    return;
  }

  // still alive in this match — next round against the same opponent
  game.round++;
  const cup = TOURNAMENTS[game.tournament] || TOURNAMENTS.bronze;
  $('tourney-label').textContent =
    'ROUND ' + game.round + ' · YOU ' + game.roundP + ' — ' + game.roundE + ' THEM';
  paintVersusNames();
  hide('hud');
  show('versus');
  game.state = 'versus';
  AudioFX.versus();
  armVersusStart();
}

let challengeBonus = 0;
function finishFight() {
  challengeBonus = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  hide('ko-overlay');
  container.classList.remove('ko-grey');
  Music.muffle(false);
  hide('hud');

  if (game.playerWon) {
    // beat a fighter and you can play as them
    const beaten = game.ladder[game.fightIndex];
    let unlocked = null;
    // a challenge boss stays a boss — you beat them, you don't get to be them
    if (ROSTER.includes(beaten) && !isUnlocked(beaten)) {
      save.unlocked.push(beaten); persist(); unlocked = beaten;
    }
    const more = game.fightIndex < game.ladder.length - 1;
    if (more) { game.fightIndex++; game.wonLast = true; }
    else if (isChallenge()) {
      // first clear pays out; after that it's just bragging rights
      const ch = challengeFor(beaten);
      save.challengesWon = save.challengesWon || {};
      if (ch && !save.challengesWon[ch.id]) {
        save.challengesWon[ch.id] = true;
        save.steroids = (save.steroids | 0) + ch.reward;
        challengeBonus = ch.reward;
      }
      persist();
    }
    else if (game.tournament === 'bronze' && !save.bronzeWon) { save.bronzeWon = true; persist(); }
    else if (game.tournament === 'silver' && !save.silverWon) { save.silverWon = true; persist(); }
    const proceed = more ? beginCutscene : showEndScreen;
    // One roll per opponent thrown out — banked now, opened when the run ends.
    rollCrate();
    let next = more ? proceed : () => openCrates(crateTally(), proceed);
    if (!more) {
      // took the cup: if this wrestler has never worn this medal, hold the
      // ceremony before anything else — it's the whole point of the run
      const cupKey = game.tournament || 'bronze';
      const won = isChallenge() ? null : MEDALS[cupKey];
      // the belt belongs to everyone who was in the corner, not just whoever
      // happened to land the last throw
      const squad = (game.team && game.team.length ? game.team : [game.selectedId]);
      const newFor = squad.filter(id => won && won.tier > (save.medals[id] | 0));
      if (newFor.length) {
        for (const id of newFor) {
          save.medals[id] = won.tier;
          if (selectModels[id]) selectModels[id].wearMedal(won);
        }
        persist();
        const afterCrates = next;
        next = () => showCeremony(game.selectedId, cupKey, afterCrates);
      }
    }
    if (unlocked) showUnlock(unlocked, next);
    else next();
    return;
  }
  openCrates(crateTally(), showEndScreen);   // whatever you earned on the way in
}

// A run that never put anyone over the ropes still gets one 25% roll, so you
// never walk away from a bad night completely empty-handed.
function crateTally() {
  if ((game.cratesWon | 0) === 0 && Math.random() < CRATE_CONSOLATION) game.cratesWon = 1;
  return game.cratesWon | 0;
}

// bronze 1, silver 2, gold 3 — the reward for the attempt
// Rolled the moment an opponent goes over the ropes. Returns 1 if this ring-out
// earned a crate, 0 otherwise.
function rollCrate() {
  if ((game.cratesWon | 0) >= CRATES_MAX_PER_RUN) return 0;
  if (Math.random() >= CRATE_CHANCE) return 0;
  game.cratesWon = (game.cratesWon | 0) + 1;
  return 1;
}

// ------------------------------------------------------------
// Pointer lock / input
// ------------------------------------------------------------
function requestLock() { renderer.domElement.requestPointerLock(); }

document.addEventListener('pointerlockchange', () => {
  game.locked = document.pointerLockElement === renderer.domElement;
  updatePauseOverlay();
});

// Evaluated every frame, not just on pointer-lock changes. It used to be called
// from three places only, so an overlay raised during a fight could outlive the
// fight state and sit on top of the versus screen — swallowing clicks while its
// own handler refused to act (state was no longer 'fight'). That deadlocked the
// game with no way out but a refresh.
function updatePauseOverlay() {
  const want = game.state === 'fight' && !game.locked;
  const ready = game.fightIntro > 0;
  if (want !== game._pauseShown || (want && ready !== game._pauseReady)) {
    game._pauseShown = want;
    game._pauseReady = ready;
    if (want) {
      const box = $('pause-overlay');
      box.querySelector('.pause-title').textContent = ready ? 'READY?' : 'PAUSED';
      box.querySelector('.pause-sub').textContent =
        ready ? 'Click to enter the ring' : 'Click to return to the fight';
      show('pause-overlay');
    } else {
      hide('pause-overlay');
    }
  }
}

$('pause-overlay').addEventListener('click', () => {
  if (game.state === 'fight') { requestLock(); return; }
  // shouldn't be reachable, but never leave a click doing nothing
  hide('pause-overlay');
  game._pauseShown = false;
  if (game.state === 'versus') $('versus').click();
});

document.addEventListener('mousemove', (e) => {
  if (!game.locked || game.state !== 'fight') return;
  const invX = settingsValue('invertX') ? -1 : 1;
  const invY = settingsValue('invertY') ? -1 : 1;
  game.camYaw -= e.movementX * 0.0028 * invX;
  game.camPitch = THREE.MathUtils.clamp(game.camPitch - e.movementY * 0.0026 * invY, -0.65, 0.55);
});

document.addEventListener('mousedown', (e) => {
  if (game.state !== 'fight' || !game.locked || e.button !== 0) return;
  playerAction();
});

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && game.state === 'fight' && game.locked) playerGrabThrow();
  if (e.code === 'KeyQ' && game.state === 'fight' && game.locked) playerSpecial();
  if (e.code === 'Space' && game.state === 'fight' && game.locked) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function camForward() {
  return new THREE.Vector3(Math.sin(game.camYaw), 0, Math.cos(game.camYaw));
}

function crosshairGroundPoint() {
  // ray from camera through screen center onto the ring surface plane
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const o = camera.position;
  let t = (RING.top - o.y) / (dir.y || -0.0001);
  if (t < 0 || t > 40) t = 12;
  const p = o.clone().addScaledVector(dir, t);
  p.y = RING.top;
  const r = Math.hypot(p.x, p.z);
  const maxR = RING.apron + 4;
  if (r > maxR) p.multiplyScalar(maxR / r);
  return p;
}

// Q — pick a knocked-out body up, and heave it on the second press.
function playerGrabThrow() {
  const p = game.player, e = game.enemy;
  if (!p || game.matchOver || p.state !== 'fight') return;
  if (p.carrying) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // scaled up with the 30% bigger ring so even the heaviest fighters clear it
    const vel = dir.multiplyScalar(7.6);
    vel.y = Math.max(vel.y, 3.0);
    combatAPI.throwCarried(p, vel);
    return;
  }
  if (e.isKO && e.state === 'ragdoll') {
    const c = e.ragdoll.center();
    if (p.pos.distanceTo(c) < 2.0) { combatAPI.tryGrab(p, e); return; }
    announce('TOO FAR', '#8b96bd');
  }
}

// Left click is ALWAYS a punch now — including into a body on the canvas.
function playerAction() {
  const p = game.player;
  if (!p || game.matchOver || p.state !== 'fight') return;
  if (p.canAct && p.startPunch()) AudioFX.whoosh();
}

function playerSpecial() {
  const p = game.player, e = game.enemy;
  if (!p || game.matchOver || !p.canAct) return;
  if (p.meter < 1) {
    subhint('SPECIAL NOT CHARGED — LAND MORE PUNCHES!');
    setTimeout(() => updateHints(), 900);
    return;
  }
  let fired = true;
  switch (p.cfg.special) {
    case 'barrage':
    case 'ultimate':
      combatAPI.startFlurry(p);
      break;
    case 'slam':
      combatAPI.doSlam(p, e);   // auto-aims at your opponent
      break;
    case 'roll':
      if (downForTheCount(e)) {
        subhint('THEY\u2019RE DOWN — GRAB THEM AND THROW!');
        setTimeout(() => updateHints(), 900);
        fired = false;
      } else {
        combatAPI.doRoll(p, e);
      }
      break;
    case 'wall':
      combatAPI.doWall(p, e);
      break;
    case 'charge':
      combatAPI.doCharge(p, e);
      break;
    case 'shield':
      combatAPI.doShield(p);
      break;
    case 'steel':
      combatAPI.doSteel(p);
      break;
    case 'ricochet':
      combatAPI.doRicochet(p, e);
      break;
    case 'sleep':
      combatAPI.doSleep(p);
      break;
    case 'feast':
      combatAPI.doFeast(p);
      break;
    case 'coins':
      combatAPI.doCoins(p);
      break;
    case 'quake':
      combatAPI.doQuake(p, e);
      break;
    case 'piledriver':
      if (TMP.v.subVectors(e.pos, p.pos).setY(0).length() < 2.6 && e.state === 'fight') {
        combatAPI.doPiledriver(p, e);
      } else {
        subhint('GET CLOSER TO SLAM THEM!');
        setTimeout(() => updateHints(), 900);
        fired = false;
      }
      break;
    default: {
      // Royal Suplex needs the opponent within grabbing distance
      const d = TMP.v.subVectors(e.pos, p.pos).setY(0).length();
      if (e.roll) {
        subhint('THEY\u2019RE UNSTOPPABLE MID-ROLL!');
        setTimeout(() => updateHints(), 900);
        fired = false;
      } else if (e.state === 'fight' && d < 2.5) {
        fired = combatAPI.doSuplex(p, e, crosshairGroundPoint()) !== false;
      } else {
        subhint('GET CLOSER TO SUPLEX!');
        setTimeout(() => updateHints(), 900);
        fired = false;
      }
    }
  }
  if (fired) { p.meter = 0; p.meterHits = 0; }   // spent — go earn it again
}

// ------------------------------------------------------------
// Combat API (shared by player + AI)
// ------------------------------------------------------------
const combatAPI = {
  tryGrab(attacker, victim) {
    if (attacker.carrying || attacker.state !== 'fight') return false;
    if (!victim.isKO || victim.state !== 'ragdoll') return false;
    attacker.carrying = victim;
    victim.carriedBy = attacker;
    victim.state = 'carried';
    AudioFX.whoosh();
    return true;
  },

  throwCarried(carrier, vel) {
    const v = carrier.carrying;
    if (!v) return;
    carrier.carrying = null;
    v.carriedBy = null;
    v.launch(vel.clone(), 0, carrier, true);   // a real heave — this one can leave the ring
    carrier.busy = 0.35;
    AudioFX.whoosh();
    world.crowd.excitement = 1;
    if (carrier.isPlayer) announce('HEAVE!', '#9db8ff');
  },

  startFlurry(b) {
    const ult = b.cfg.special === 'ultimate';
    b.specialCd = b.cfg.specialCooldown;
    b.barrage = {
      left: ult ? 5 : 10, timer: 0.1,
      dmg: sp(b, ult ? 15 : 8), heal: ult ? 20 : 0,   // steroids don't boost the drain
      cadence: ult ? 0.24 : 0.13, speedMul: ult ? 2.4 : 3.1,
      // Joe Above walks his hurricane onto you; Joe Average stands and swings
      stride: b.cfg.id === 'joeabove' ? 0.34 : 0,
      // VICIOUS FIVE climbs: 5/10/15/20/25, and a whiff knocks him back to
      // the bottom rung — cornering him is what makes the big one land
      ladder: ult ? [5, 10, 15, 20, 25] : null, rung: 0
    };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    world.crowd.excitement = Math.max(world.crowd.excitement, 0.8);
  },
  startBarrage(b) { this.startFlurry(b); },

  // BLAZE — leap very high and crash down, auto-aiming at the target
  doSlam(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    b.slam = {
      t: 0, dur: 1.15, height: 5.2,   // shorter hang time, and no longer through the ceiling
      from: b.pos.clone(), to: tgt.pos.clone(),
      trackFn: () => tgt.pos            // homes in until late in the flight
    };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.whoosh();
    world.crowd.excitement = 1;
  },

  slamImpact(b) {
    const other = b === game.player ? game.enemy : game.player;
    AudioFX.slam();
    game.shake = Math.max(game.shake, 0.75);
    spawnSpark(b.pos.clone().add(new THREE.Vector3(0, 0.35, 0)), true);
    world.crowd.excitement = 1;
    if (!other || other.state !== 'fight' || game.matchOver) return;
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    if (d.length() > 2.3) return;                      // missed — they got clear
    const dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
    dealDamage(b, other, sp(b, 60), dir, true);
    if (other.isPlayer) game.kickP += 0.2;
    other.launch(dir.clone().multiplyScalar(5).setY(4.6), 0, b);
    if (other.hp <= 0) knockOutBoxer(other, null);
  },

  // BRICK — plant behind the guard, bank the punishment, hand it back
  doWall(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    b.wall = { time: 5, stored: 0, targetFn: () => tgt.pos };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.hit(0.6);
    world.crowd.excitement = Math.max(world.crowd.excitement, 0.7);
  },

  wallRelease(b, stored) {
    const other = b === game.player ? game.enemy : game.player;
    b.startPunch(1.4);
    AudioFX.slam();
    if (stored <= 0 || !other || other.state !== 'fight' || game.matchOver) return;
    // The wall does not whiff. It used to require you inside 2.6 units, so
    // simply walking away deleted every punch Brick had banked — his ultimate
    // was free to dodge. It now lands at any range, wherever you ran to.
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    let dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
    // It still never whiffs — but YOU choose which way they go, so a well-aimed
    // wall sends them at the ropes instead of just backwards.
    if (b.isPlayer) {
      const aim = camForward(); aim.y = 0;
      if (aim.lengthSq() > 0.0001) dir = aim.normalize();
    }
    announce('COUNTER — ' + Math.round(stored) + '!', b.isPlayer ? '#ffd94d' : '#ff5a4e');
    dealDamage(b, other, stored, dir, true);
    spawnSpark(other.chestWorldPos(TMP.v3), true);
    game.shake = Math.max(game.shake, 0.6);
    world.crowd.pop(other.pos);
    world.crowd.excitement = 1;
    if (other.isPlayer) game.kickP += 0.22;
    if (other.hp <= 0) knockOutBoxer(other, null);
  },

  // BULLY BULL — head down, straight across the ring
  doCharge(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    const aim = new THREE.Vector3().subVectors(tgt.pos, b.pos); aim.y = 0;
    if (aim.lengthSq() > 0.01) aim.normalize(); else aim.set(0, 0, 1);
    b.charge = { phase: 'windup', t: 0, hit: false, dir: aim,
                 speed: 15, windup: 0.40, recoil: 1.1, dmg: 75, targetFn: () => tgt.pos };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.whoosh();
    world.crowd.excitement = 1;
  },

  chargeHit(b) {
    const other = b === game.player ? game.enemy : game.player;
    if (!other || other.state !== 'fight' || game.matchOver) return false;
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    if (d.length() > 1.45) return false;
    const dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
    dealDamage(b, other, sp(b, (b.charge && b.charge.dmg) || 75), dir, true);
    AudioFX.slam();
    spawnSpark(other.chestWorldPos(TMP.v3), true);
    game.shake = Math.max(game.shake, 0.8);
    world.crowd.excitement = 1;
    if (other.isPlayer) game.kickP += 0.25;
    other.launch(dir.clone().multiplyScalar(4.5).setY(2.6), 0, b);
    if (other.hp <= 0) knockOutBoxer(other, null);
    return true;
  },

  chargeMiss(b) {
    AudioFX.slam();
    game.shake = Math.max(game.shake, 0.4);
    announce('MISSED!', '#8b96bd');
  },

  // SLUMBERJACK — down for a nap, healing hard, wide open
  doSleep(b) {
    b.specialCd = b.cfg.specialCooldown;
    b.sleep = { left: 10, healRate: 25, hitCd: 0,
                drift: new THREE.Vector3(), turn: 0,
                shove: new THREE.Vector3(), shoveT: 0,
                freeT: 0, repin: false, targetFn: () => (b === game.player ? game.enemy : game.player).pos };
    announce('SLUMBERJACK IS IN DEEP SLUMBER!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.omen();
    world.crowd.excitement = Math.max(world.crowd.excitement, 0.5);
  },

  // ...and anyone he drifts into while asleep gets flattened by 300lb of nap
  sleepBump(b) {
    const other = b === game.player ? game.enemy : game.player;
    if (!other || other.state !== 'fight' || game.matchOver) return false;
    const d = TMP.v.subVectors(other.pos, b.pos);
    if (d.length() > 1.5) return false;
    d.y = 0;
    // Damage only. A zero direction means takeHit has nothing to push with, so
    // drifting into him chips you without ever shoving you around.
    dealDamage(b, other, sp(b, 30), new THREE.Vector3(0, 0, 0), false);
    AudioFX.hit(1.4);
    spawnSpark(other.chestWorldPos(TMP.v3));
    game.shake = Math.max(game.shake, 0.25);
    if (other.isPlayer) game.kickP += 0.1;
    if (other.hp <= 0) knockOutBoxer(other, null);
    return true;
  },

  // PRESTO — hurls himself at the nearest ropes and pinballs off them five times
  doRicochet(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    const dir = new THREE.Vector3();
    if (RING.half - Math.abs(b.pos.x) <= RING.half - Math.abs(b.pos.z))
      dir.set(Math.sign(b.pos.x) || 1, 0, 0);
    else
      dir.set(0, 0, Math.sign(b.pos.z) || 1);
    b.ricochet = { phase: 'windup', t: 0, bounces: 0, dir, speed: 16.8,
                   hitCd: 0, bounceCd: 0, finish: -1, targetFn: () => tgt.pos };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.whoosh();
    world.crowd.excitement = 1;
  },
  ricochetBounce(b, n) {
    AudioFX.ropeTwang(n - 1);
    game.shake = Math.max(game.shake, 0.3);
    world.crowd.excitement = 1;
  },
  ricochetHit(b) {
    const rc = b.ricochet;
    if (!rc || rc.hitCd > 0) return false;
    const other = b === game.player ? game.enemy : game.player;
    if (!other || other.state !== 'fight' || game.matchOver) return false;
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    if (d.length() > 1.4) return false;
    const dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : rc.dir.clone();
    dealDamage(b, other, sp(b, 15), dir, true);
    AudioFX.hit(1.6);
    spawnSpark(other.chestWorldPos(TMP.v3), true);
    game.shake = Math.max(game.shake, 0.55);
    world.crowd.excitement = 1;
    if (other.isPlayer) game.kickP += 0.18;
    other.launch(dir.clone().multiplyScalar(3.6).setY(1.7), 0, b);
    rc.hitCd = 0.45;
    if (other.hp <= 0) knockOutBoxer(other, null);
    return true;
  },

  // PETER EATER — burger first, carnage after
  doFeast(b) {
    b.specialCd = b.cfg.specialCooldown;
    b.feast = { eating: 0.9, time: 3.9, healed: 0 };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    world.crowd.excitement = 1;
  },
  feastStart(b) {
    AudioFX.chomp();
    announce('BOOSTED!', '#ffa32e');
    world.crowd.excitement = 1;
  },

  // JIMMY GOLD — scatter the winnings
  doCoins(b) {
    b.specialCd = b.cfg.specialCooldown;
    // six on the canvas, never more — a second toss tops up whatever's left
    const room = Math.max(0, 6 - game.coins.length);
    for (let i = 0; i < room; i++) {
      const a = (i / Math.max(1, room)) * Math.PI * 2 + Math.random() * 0.5;
      const r = 1.4 + Math.random() * 2.6;
      spawnCoin(new THREE.Vector3(Math.sin(a) * r, RING.top + 0.06, Math.cos(a) * r));
    }
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.coinScatter(6);
    world.crowd.excitement = 1;
  },

  // GUSTAVO — split the canvas open
  doQuake(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    b.quake = { t: 0, windup: 0.55, fired: false };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    world.crowd.excitement = 1;
  },
  quakeHit(b) {
    const other = b === game.player ? game.enemy : game.player;
    AudioFX.slam();
    game.shake = Math.max(game.shake, 0.9);
    game.ringWarp = 1;
    spawnCracks(b.pos, 4.0);
    world.crowd.excitement = 1;
    if (!other || other.state !== 'fight' || game.matchOver) return;
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    const airborne = other.pos.y > groundYAt(other.pos.x, other.pos.z) + 0.25;
    if (d.length() > 4.0 || airborne) {
      if (airborne) announce('JUMPED IT!', '#7dffa2');
      return;
    }
    const dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
    dealDamage(b, other, sp(b, b.quakeDmg), dir, true);
    other.launch(dir.clone().multiplyScalar(2.2).setY(3.2), 0, b);
    if (other.isPlayer) game.kickP += 0.3;
    if (other.hp <= 0) knockOutBoxer(other, null);
  },

  // PRIME HOUND — hoist, leap, spike
  doPiledriver(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    b.busy = 2.0;
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.whoosh();
    world.crowd.excitement = 1;
    if (tgt.state === 'fight') {
      tgt.state = 'ragdoll';
      tgt.ragdoll.seed(tgt.root, tgt.scale, new THREE.Vector3(0, 2, 0), new THREE.Vector3());
    }
    game.piledrivers.push({ attacker: b, victim: tgt, t: 0 });
  },

  // PRIME HOUND rage — 8 seconds of whirling pursuit
  doHoundSpin(b, tgt, steer = false) {
    b.roll = {
      time: 8, hitCd: 0.6, angle: 0, upright: true, steer,
      dmg: b.isPlayer ? 20 : 35,   // the boss's whirl is the threat, not his HP bar
      spinDir: Math.random() < 0.5 ? -1 : 1, orbitAngle: null,
      phase: 'charge', phaseT: 8, targetFn: () => tgt.pos
    };
    announce('THE HOUND IS LOOSE!', '#ff5a4e');
    AudioFX.riser();
    world.crowd.excitement = 1;
  },

  // MAD COP MITCHELL — plate the gloves, three stunning punches
  doSteel(b) {
    b.specialCd = b.cfg.specialCooldown;
    b.setSteel(3);
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.clang();
    world.crowd.excitement = Math.max(world.crowd.excitement, 0.8);
  },

  // BIG WAVE — five seconds where your punches only feed him
  doShield(b) {
    b.specialCd = b.cfg.specialCooldown;
    b.shield = 5;
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.shimmer();
    world.crowd.excitement = 1;
  },

  // HONK — curl up and barrel back and forth for 10 seconds
  doRoll(b, tgt) {
    b.specialCd = b.cfg.specialCooldown;
    b.roll = {
      time: 10, hitCd: 0.25, angle: 0, steer: b.isPlayer, recoil: 0,
      phase: 'charge', phaseT: 1.35,
      targetFn: () => tgt.pos
    };
    announce(b.cfg.specialName + '!', b.isPlayer ? '#ffd94d' : '#ff8d7e');
    AudioFX.whoosh();
    world.crowd.excitement = 1;
  },

  rollImpact(b) {
    const other = b === game.player ? game.enemy : game.player;
    if (!other || other.state !== 'fight' || game.matchOver) return;
    const d = TMP.v.subVectors(other.pos, b.pos); d.y = 0;
    const dir = d.lengthSq() > 0.0001 ? d.clone().normalize() : new THREE.Vector3(0, 0, 1);
    dealDamage(b, other, sp(b, (b.roll && b.roll.dmg) || 20), dir, true);
    AudioFX.slam();
    spawnSpark(other.chestWorldPos(TMP.v3), true);
    game.shake = Math.max(game.shake, 0.5);
    world.crowd.excitement = 1;
    if (other.isPlayer) game.kickP += 0.16;
    // the Hound's whirl shoves harder than Honk's roll, but still can't eject
    const spinPush = b.roll && b.roll.upright ? 4.2 : 2.6;
    const spinLift = b.roll && b.roll.upright ? 2.1 : 1.5;
    other.launch(dir.clone().multiplyScalar(spinPush).setY(spinLift), 0, b);
    if (other.hp <= 0) knockOutBoxer(other, null);
  },

  doSuplex(attacker, victim, targetPt) {
    if (victim.roll) return false;   // can't get hold of a boxer mid-roll
    // The slam always lands inside the ring. Aiming a suplex out over the ropes
    // used to be an instant first-move win, for either fighter — ring-outs have
    // to be earned with a knockout, a grab and a throw.
    const inner = RING.half - 0.5;
    targetPt = targetPt.clone();
    targetPt.x = THREE.MathUtils.clamp(targetPt.x, -inner, inner);
    targetPt.z = THREE.MathUtils.clamp(targetPt.z, -inner, inner);
    targetPt.y = RING.top;
    attacker.specialCd = attacker.cfg.specialCooldown;
    attacker.busy = 0.8;
    attacker.suplexAnim = 0.8;
    announce(attacker.cfg.specialName + '!', attacker.isPlayer ? '#ffd94d' : '#ff8d7e');
    world.crowd.excitement = 1;
    AudioFX.whoosh();

    if (victim.state === 'fight') {
      victim.state = 'ragdoll';
      victim.ragdoll.seed(victim.root, victim.scale, new THREE.Vector3(0, 2, 0), new THREE.Vector3());
    }
    game.suplexes.push({ attacker, victim, targetPt: targetPt.clone(), t: 0, dur: 0.55 });
    return true;
  }
};

function updateSuplexes(dt) {
  for (let i = game.suplexes.length - 1; i >= 0; i--) {
    const s = game.suplexes[i];
    s.t += dt;
    const hold = s.attacker.headWorldPos().clone();
    hold.y += 0.75;
    hold.addScaledVector(camForwardOf(s.attacker), -0.15);
    const pts = s.victim.ragdoll.pts;
    const pinIdx = [1, 2, 3, 4];
    const offs = [
      new THREE.Vector3(0.22, 0.05, 0.25), new THREE.Vector3(-0.22, 0.05, 0.25),
      new THREE.Vector3(0.12, 0.1, -0.3), new THREE.Vector3(-0.12, 0.1, -0.3)
    ];
    pinIdx.forEach((pi, k) => {
      const pt = pts[pi];
      pt.pin = pt.pin || new THREE.Vector3();
      pt.pin.copy(hold).add(offs[k]);
    });
    if (s.t >= s.dur) {
      for (const pt of pts) pt.pin = null;
      // ballistic arc to the crosshair point
      const c = s.victim.ragdoll.center().clone();
      const delta = new THREE.Vector3().subVectors(s.targetPt, c);
      const flat = Math.hypot(delta.x, delta.z);
      const T = THREE.MathUtils.clamp(flat / 8, 0.55, 1.05);
      const vel = new THREE.Vector3(delta.x / T, (delta.y + 11 * T * T) / T, delta.z / T);
      s.victim.launch(vel, sp(s.attacker, 60), s.attacker);
      AudioFX.whoosh();
      game.suplexes.splice(i, 1);
    }
  }
}

function camForwardOf(b) {
  return new THREE.Vector3(Math.sin(b.root.rotation.y), 0, Math.cos(b.root.rotation.y));
}

// carried boxer: pinned overhead in a press-slam carry
function updateCarry(carrier) {
  const v = carrier.carrying;
  if (!v) return;
  const fw = camForwardOf(carrier);
  const left = new THREE.Vector3(fw.z, 0, -fw.x);
  const hold = carrier.pos.clone();
  hold.y += 2.15 * carrier.scale;
  hold.addScaledVector(fw, 0.38);
  const place = (idx, f, l) => {
    const pt = v.ragdoll.pts[idx];
    pt.pin = pt.pin || new THREE.Vector3();
    pt.pin.copy(hold).addScaledVector(fw, f).addScaledVector(left, l);
  };
  place(1, 0.32, 0.22); place(2, 0.32, -0.22);
  place(3, -0.38, 0.12); place(4, -0.38, -0.12);
}

// ------------------------------------------------------------
// Gold coins, canvas cracks, ring warp, piledriver
// ------------------------------------------------------------
const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.035, 14);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23d, metalness: 0.85, roughness: 0.22 });
function spawnCoin(pos) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.copy(pos);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  scene.add(mesh);
  game.coins.push({ mesh, home: pos.clone(), t: Math.random() * 6 });
}
function clearCoins() {
  for (const c of game.coins) scene.remove(c.mesh);
  game.coins.length = 0;
}
function updateCoins(dt) {
  if (!game.coins.length) return;
  for (let i = game.coins.length - 1; i >= 0; i--) {
    const c = game.coins[i];
    c.t += dt;
    c.mesh.position.y = c.home.y + 0.1 + Math.sin(c.t * 3) * 0.06;
    c.mesh.rotation.z += dt * 3.2;
    for (const b of [game.player, game.enemy]) {
      if (!b || b.state !== 'fight') continue;
      if (b.cfg.special !== 'coins') continue;       // it's Jimmy's gold — nobody else touches it
      if (b.hp >= b.maxHp) continue;                 // any missing health is worth stooping for
      if (b.pos.distanceTo(c.home) > 1.0) continue;
      b.hp = Math.min(b.maxHp, b.hp + (b.coinHeal || 50));   // steroids don't boost the coins
      AudioFX.coin();
      spawnSpark(c.mesh.position.clone(), false);
      if (b.isPlayer) announce('+50', '#ffd94d');
      scene.remove(c.mesh);
      game.coins.splice(i, 1);
      break;
    }
  }
}

const crackTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(10,8,14,0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + Math.random() * 0.4;
    let x = 128, y = 128;
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y);
    let ang = a;
    for (let s = 0; s < 5; s++) {
      ang += (Math.random() - 0.5) * 0.8;
      x += Math.cos(ang) * 22; y += Math.sin(ang) * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return new THREE.CanvasTexture(cv);
})();
function spawnCracks(pos, size) {
  const m2 = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0.9, depthWrite: false }));
  m2.rotation.x = -Math.PI / 2;
  m2.position.set(pos.x, RING.top + 0.012, pos.z);
  scene.add(m2);
  game.cracks.push({ mesh: m2, life: 6 });
}
function updateCracks(dt) {
  for (let i = game.cracks.length - 1; i >= 0; i--) {
    const c = game.cracks[i];
    c.life -= dt;
    c.mesh.material.opacity = Math.max(0, Math.min(0.9, c.life / 2));
    if (c.life <= 0) { scene.remove(c.mesh); game.cracks.splice(i, 1); }
  }
}
function clearCracks() {
  for (const c of game.cracks) scene.remove(c.mesh);
  game.cracks.length = 0;
}

// the whole ring buckles after a big impact
function updateRingWarp(dt) {
  if (!world.ringGroup) return;
  if (game.ringWarp > 0.001) {
    game.ringWarp *= Math.exp(-3.5 * dt);
    const t = performance.now() / 1000;
    world.ringGroup.position.y = Math.sin(t * 26) * game.ringWarp * 0.22;
    world.ringGroup.scale.set(1 + game.ringWarp * 0.02, 1 - game.ringWarp * 0.05, 1 + game.ringWarp * 0.02);
  } else if (world.ringGroup.position.y !== 0) {
    world.ringGroup.position.y = 0;
    world.ringGroup.scale.set(1, 1, 1);
  }
}

// hoist overhead → leap → spike them into the canvas
function updatePiledrivers(dt) {
  for (let i = game.piledrivers.length - 1; i >= 0; i--) {
    const s = game.piledrivers[i];
    const a = s.attacker, v = s.victim;
    s.t += dt;
    const LIFT = 0.55, FLIGHT = 0.85, DUR = LIFT + FLIGHT;
    const fw = camForwardOf(a);

    if (s.t < DUR) {
      // attacker leaps; victim is pinned above his head the whole way
      const k = s.t < LIFT ? 0 : (s.t - LIFT) / FLIGHT;
      a.pos.y = groundYAt(a.pos.x, a.pos.z) + Math.sin(k * Math.PI) * 5.2;
      a.root.position.copy(a.pos);
      const hold = a.pos.clone();
      hold.y += 2.5 * a.scale;
      hold.addScaledVector(fw, 0.1);
      const pts = v.ragdoll.pts;
      // head-down: shoulders below the hips so he lands face first
      const offs = [
        [0, 0.22, 0.3], [1, 0.22, 0.3], [2, -0.22, 0.3], [3, 0.12, -0.34], [4, -0.12, -0.34]
      ];
      for (const [idx, sx, fz] of offs) {
        const pt = pts[idx];
        pt.pin = pt.pin || new THREE.Vector3();
        pt.pin.copy(hold)
          .addScaledVector(fw, fz)
          .add(new THREE.Vector3(sx, idx === 0 ? -0.55 : (idx < 3 ? -0.35 : 0.15), 0));
      }
      continue;
    }

    // impact
    for (const pt of v.ragdoll.pts) pt.pin = null;
    a.pos.y = groundYAt(a.pos.x, a.pos.z);
    v.launch(new THREE.Vector3((Math.random() - 0.5) * 1.2, -9, (Math.random() - 0.5) * 1.2), 0, a);
    dealDamage(a, v, sp(a, 150), fw.clone(), true, true);
    AudioFX.slam(); AudioFX.hit(2.4);
    game.shake = Math.max(game.shake, 1.4);
    game.ringWarp = 1.4;
    spawnCracks(v.ragdoll.center(), 5.5);
    spawnSpark(v.ragdoll.center().clone(), true);
    world.crowd.excitement = 1;
    if (v.isPlayer) { flashVignette(); game.kickP += 0.4; }
    if (v.hp <= 0) knockOutBoxer(v, null);
    game.piledrivers.splice(i, 1);
  }
}

// ------------------------------------------------------------
// Impact sparks
// ------------------------------------------------------------
const sparkTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.translate(48, 48);
  g.fillStyle = '#fff2a8';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 14 : 44;
    const a = (i / 16) * Math.PI * 2;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
})();
const sparkPool = [];
for (let i = 0; i < 8; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false }));
  sp.visible = false;
  scene.add(sp);
  sparkPool.push({ sp, t: 2, big: false });
}
function spawnSpark(pos, big = false) {
  const s = sparkPool.find(s => s.t >= 1) || sparkPool[0];
  s.t = 0; s.big = big;
  s.sp.position.copy(pos);
  s.sp.material.rotation = Math.random() * Math.PI;
  s.sp.visible = true;
}
function updateSparks(dt) {
  for (const s of sparkPool) {
    if (s.t >= 1) { s.sp.visible = false; continue; }
    s.t += dt * 4.5;
    const k = Math.min(1, s.t);
    s.sp.scale.setScalar((0.35 + k * 0.75) * (s.big ? 2.1 : 1));
    s.sp.material.opacity = 1 - k;
  }
}

// ------------------------------------------------------------
// Damage — every source routes through here so Big Wave's shield and
// Brick's guard apply no matter what hit them
// ------------------------------------------------------------
// allowDown: for moves that damage a body already in a ragdoll (the Hound's slam)
function dealDamage(attacker, defender, dmg, dir, big, allowDown) {
  if (!defender || game.matchOver) return 0;
  if (!allowDown && defender.state !== 'fight') return 0;
  // difficulty only ever touches what the ENEMY hits you for
  if (attacker && !attacker.isPlayer) dmg *= difficulty().enemyDmg;
  if (attacker && attacker.rage) dmg *= 1.5;   // a raging wrestler hits harder

  // RISING TIDE: the hit heals him and hurls the attacker away
  if (defender.shield > 0) {
    defender.hp = Math.min(defender.maxHp, defender.hp + dmg);
    spawnSpark(defender.chestWorldPos(TMP.v3), true);
    AudioFX.hit(0.4);
    if (attacker) {
      attacker.vel.addScaledVector(dir, -7 / attacker.mass);
      attacker.stun = Math.max(attacker.stun, 0.3);
      attacker.flinch = Math.min(1, attacker.flinch + 0.6);
      if (attacker.isPlayer) { flashVignette(); game.shake = Math.max(game.shake, 0.35); game.kickP += 0.1; }
    }
    return 0;
  }

  // RAISE THE WALL: half gets through, the whole punch is banked
  if (defender.wall) {
    defender.wall.stored += dmg;
    dmg = dmg * 0.5;
    AudioFX.hit(0.5);
    spawnSpark(defender.chestWorldPos(TMP.v3));
  }

  // CAUGHT NAPPING: a sleeping wrestler eats 20% more and gets launched into
  // the cheap seats. No super armour here — the nap is the whole opening.
  if (defender.sleep) {
    dmg *= 4;                 // 300% MORE damage — catching the nap is the whole fight
    defender.takeHit(dmg, dir, big);
    // He does NOT wake and he does NOT ragdoll — he just gets launched across
    // the ring, still snoring, still drifting. Keeping him out of the ragdoll
    // system is what stops him snapping back to a stale position afterwards.
    const away = (dir && dir.lengthSq() > 0.0001)
      ? dir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    // HEAVILY exaggerated: cut the strings and boot the whole ragdoll
    const kick = away.clone().multiplyScalar(19); kick.y = 11;
    defender.sleepSmack(kick);
    game.slowmoTimer = Math.max(game.slowmoTimer, 0.35);
    AudioFX.slam();
    spawnSpark(defender.chestWorldPos(TMP.v3), true);
    game.shake = Math.max(game.shake, 1.0);
    world.crowd.pop(defender.pos);
    world.crowd.excitement = 1;
    if (defender.isPlayer) { flashVignette(); game.kickP += 0.3; }
    if (defender.hp <= 0) knockOutBoxer(defender, null);
    return dmg;
  }

  defender.takeHit(dmg, dir, big);
  if (defender.isPlayer) { flashVignette(); tryTriggerRage(defender); }
  return dmg;
}

// The wrestler snaps. You keep the camera; you lose the controls.
function tryTriggerRage(p) {
  if (!p || p.state !== 'fight' || game.matchOver || !game.enemy) return;
  const chance = rageChanceFor(p);
  if (chance <= 0 || Math.random() >= chance) return;
  if (p.rage) {                                  // already gone: extend, never restack
    p.rage.left = Math.min(RAGE_CAP, p.rage.left + 2);
    return;
  }
  p.rage = {
    left: RAGE_MIN + Math.random() * (RAGE_MAX - RAGE_MIN),
    ai: new AIController(p, game.enemy, combatAPI)
  };
  p.rage.ai.heat = 1;
  p.rage.ai.specialDelay = 1e9;                  // rage throws hands — see updateRage
  p.rage.ai.aggression = 1.6;                    // no thinking, only swinging
  p.rage.ai.comboPause = 0;
  announce('RAGE!', '#ff5533');
  AudioFX.roar();
  game.shake = Math.max(game.shake, 0.7);
  world.crowd.excitement = 1;
  $('hud').classList.add('raging');
}
function updateRage(p, dt) {
  const r = p.rage;
  r.left -= dt;
  if (r.left <= 0 || p.state !== 'fight' || game.matchOver || !game.enemy) { endRage(p); return; }
  r.ai.t = game.enemy;          // a tag-in swaps who you're swinging at
  // Your saved charge is YOURS — rage never spends the meter you built.
  p.specialCd = 999;
  r.ai.aggression = 1.6;          // it never calms down mid-rage
  r.ai.dodgeTimer = 0;            // and it never, ever backs off
  r.ai.update(dt, performance.now() / 1000);
  // the camera is dragged along to wherever the body decides to look
  let dy = p.yaw - game.camYaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  game.camYaw += dy * (1 - Math.exp(-7 * dt));
}
function endRage(p) {
  if (!p || !p.rage) return;
  p.rage = null;
  p.specialCd = 0;
  game.camYaw = p.yaw;          // hand the controls back pointing where you ended up
  $('hud').classList.remove('raging');
}

// ------------------------------------------------------------
// Punch resolution
// ------------------------------------------------------------
function resolvePunches(attacker, defender, dt) {
  if (attacker.punchT < 0) { attacker._pp = -1; return; }
  const prev = attacker._pp === undefined ? -1 : attacker._pp;
  attacker._pp = attacker.punchT;
  const HIT_AT = 0.4;
  if (!(prev < HIT_AT && attacker.punchT >= HIT_AT) || attacker.punchDidHit) return;
  attacker.punchDidHit = true;

  // A limp body is fair game; only two standing fighters can't trade mid-air.
  const limp = defender.isRagdolled;
  if (!limp && (defender.airborne || attacker.airborne)) return;
  const aimAt = limp ? defender.ragdoll.center() : defender.pos;
  const to = TMP.v.subVectors(aimAt, attacker.pos); to.y = 0;
  const dist = to.length();
  // A flat 1.85 left the slow heavyweights swinging at air: Blaze moves at half
  // speed, so anyone can simply walk out of his punch. Big bodies get long arms,
  // and the slow ones get a little more on top. Speed 100 still lands at 1.85.
  const bulk = attacker.cfg.bulk || 1;
  const slow = Math.max(0, 100 - attacker.speed) / 100;
  const reach = 1.5 + 0.35 * bulk + 0.35 * slow;
  // a whiff mid-flurry drops the Vicious Five back to its first rung
  if (dist > reach) { if (attacker.barrage && attacker.barrage.ladder) attacker.barrage.rung = 0; return; }
  const fw = attacker.isPlayer ? camForward() : camForwardOf(attacker);
  if (fw.dot(to.normalize()) < 0.45) { if (attacker.barrage && attacker.barrage.ladder) attacker.barrage.rung = 0; return; }

  const dir = to.clone();
  const isBarrage = !!attacker.barrage;
  const rungDmg = isBarrage && attacker.barrage.ladder
    ? sp(attacker, attacker.barrage.ladder[attacker.barrage.rung]) : null;
  const dmg = isBarrage ? (rungDmg != null ? rungDmg : attacker.barrage.dmg) : attacker.dmg;

  if (defender.state === 'fight') {
    const guarded = defender.shield > 0 || !!defender.wall;
    const big = !isBarrage && !guarded && Math.random() < 0.12 && defender.kdCd <= 0;
    // rapid barrage jabs barely shove — otherwise the flurry pushes its own
    // target out of reach and whiffs
    const dealt = dealDamage(attacker, defender, dmg,
      isBarrage ? dir.clone().multiplyScalar(0.25) : dir, big);
    if (!guarded) {
      AudioFX.hit(1); // every flurry punch lands with the full normal-punch thud
      spawnSpark(defender.chestWorldPos(TMP.v3));
    }
    // STEEL KNUCKLES: a plated punch that connects locks them up for half a
    // second, and burns one plate off the gloves
    if (attacker.steel > 0 && dealt > 0) {
      defender.stun = Math.max(defender.stun, 1.0);
      defender.flinch = Math.min(1, defender.flinch + 0.9);
      attacker.setSteel(attacker.steel - 1);
      announce('STEEL!', attacker.isPlayer ? '#dfe6f2' : '#ff8d7e');
      AudioFX.clang();
      spawnSpark(defender.chestWorldPos(TMP.v3), true);
      game.shake = Math.max(game.shake, 0.4);
      if (defender.isPlayer) { flashVignette(); game.kickP += 0.18; }
    }
    world.crowd.excitement = Math.min(1, world.crowd.excitement + 0.12);
    // you earn your special by landing clean punches — flurries don't count
    if (attacker.isPlayer && !isBarrage && dealt > 0 && attacker.meter < 1) {
      // Five clean punches to charge, unless the wrestler's card says otherwise.
      // Counted as whole punches: adding 1/6 six times lands on 0.9999... and
      // silently cost an extra punch.
      const need = attacker.cfg.meterPunches || 5;
      attacker.meterHits = (attacker.meterHits || 0) + 1;
      attacker.meter = Math.min(1, attacker.meterHits / need);
      if (attacker.meter >= 1) {
        announce(attacker.cfg.specialName + ' READY!', '#ffd94d');
        AudioFX.charged();
      }
    }
    // Vicious drinks the damage back
    if (dealt > 0 && isBarrage && attacker.barrage.heal) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.barrage.heal);
      spawnSpark(attacker.chestWorldPos(TMP.v3));
    }
    // ...and every hit that lands winds the next one up harder
    if (isBarrage && attacker.barrage.ladder) {
      const top = attacker.barrage.ladder.length - 1;
      if (dealt > 0) {
        if (attacker.barrage.rung >= top) {
          // the 25 landed — sell it with the hit itself, NOT another banner:
          // the move already announced itself when it started
          AudioFX.slam();
          game.shake = Math.max(game.shake, 0.55);
          spawnSpark(defender.chestWorldPos(TMP.v3), true);
          world.crowd.excitement = 1;
        }
        attacker.barrage.rung = Math.min(top, attacker.barrage.rung + 1);
      } else {
        attacker.barrage.rung = 0;
      }
    }
    if (defender.isPlayer) {
      game.shake = Math.max(game.shake, 0.25);
      game.kickP += 0.09 + Math.random() * 0.06;
      game.kickY += (Math.random() - 0.5) * 0.14;
    } else {
      game.shake = Math.max(game.shake, 0.12);
      game.kickP += 0.015; // tiny impact feedback when your punch lands
    }

    // RAGE ignores how bodies are supposed to behave — everything you touch
    // cartwheels off into the lights.
    if (attacker.rage && defender.hp > 0) {
      defender.kdCd = 0;
      defender.launch(dir.clone().multiplyScalar(11).setY(6.5), 0, attacker);
      AudioFX.slam();
      game.shake = Math.max(game.shake, 0.7);
      world.crowd.excitement = 1;
    }
    if (defender.hp <= 0) {
      const impulse = dir.clone().multiplyScalar(3.4).setY(3.6);
      knockOutBoxer(defender, impulse);
    } else if (big) {
      // heavy hit: swept clean off their feet — full ragdoll knockdown
      defender.kdCd = 5;
      defender.launch(dir.clone().multiplyScalar(4.6).setY(3.0), 0, attacker);
      AudioFX.slam();
      world.crowd.excitement = Math.min(1, world.crowd.excitement + 0.5);
      game.shake = Math.max(game.shake, 0.3);
    }
  } else if (defender.isRagdolled) {
    // A body on the canvas is a free hit. No damage — but it goes SAILING, and
    // every smack buys you another second before they're back on their feet.
    // Big enough to be ridiculous, small enough that you can chase it down and
    // do it again — the whole point is racking up the count.
    const swat = dir.clone().normalize();
    defender.ragdoll.addImpulse(swat.clone().multiplyScalar(SWAT_PUSH).setY(SWAT_LIFT));
    // no banner — the smack and the body flying sell it on their own
    if (defender.isKO && defender.koTimer < KO_MAX) {
      defender.koTimer = Math.min(KO_MAX, defender.koTimer + 1);
    }
    AudioFX.slam();
    spawnSpark(defender.ragdoll.center(), true);
    game.shake = Math.max(game.shake, 0.5);
    world.crowd.excitement = Math.min(1, world.crowd.excitement + 0.3);
  }
}

function knockOutBoxer(b, impulse) {
  b.knockOut(impulse);
  AudioFX.slam();
  world.crowd.pop(b.isRagdolled ? b.ragdoll.center() : b.pos);
  world.crowd.excitement = 1;
  game.shake = Math.max(game.shake, 0.5);
  game.slowmoTimer = 0.9;
  announce('KNOCKOUT!', '#ff5a4e');
  spawnSpark(b.chestWorldPos(TMP.v3), true);
  // they love it when YOU go down and hate it when you do the knocking out
  if (b.isPlayer) AudioFX.roar(); else AudioFX.boo();
  if (b.isPlayer) {
    container.classList.add('ko-grey');
    show('ko-overlay');
    Music.muffle(true);
  }
}

// ------------------------------------------------------------
// Barrage ticking
// ------------------------------------------------------------
function updateBarrage(b, opponent, dt) {
  if (!b.barrage) return;
  // auto-square-up so the flurry lands
  const to = TMP.v2.subVectors(opponent.pos, b.pos); to.y = 0;
  if (to.lengthSq() > 0.01) {
    const face = Math.atan2(to.x, to.z);
    if (b.isPlayer) {
      // steer the camera onto the target; the body follows the camera
      let dy = face - game.camYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      game.camYaw += dy * (1 - Math.exp(-6 * dt));
      b.yaw = game.camYaw;
    } else {
      b.yaw = face;
    }
  }

  // press forward so the whole flurry connects
  if (to.length() > 1.2) {
    b.moveInput.copy(to).normalize().multiplyScalar(b.moveSpeed * 2.4); // *0.25 in update
  }

  b.barrage.timer -= dt;
  if (b.barrage.timer <= 0 && b.barrage.left > 0) {
    b.punchCd = 0; b.punchT = -1;
    b.startPunch(b.barrage.speedMul);
    AudioFX.whoosh();
    // a striding flurry steps in with every swing, but never past their chest
    if (b.barrage.stride) {
      const gap = to.length() - 1.0;
      if (gap > 0.05) {
        const step = Math.min(b.barrage.stride, gap);
        b.pos.addScaledVector(TMP.v2.copy(to).normalize(), step);
        const lim = RING.half - 0.2;
        b.pos.x = THREE.MathUtils.clamp(b.pos.x, -lim, lim);
        b.pos.z = THREE.MathUtils.clamp(b.pos.z, -lim, lim);
        b.pos.y = groundYAt(b.pos.x, b.pos.z);
      }
    }
    b.barrage.left--;
    b.barrage.timer = b.barrage.cadence;
  }
  if (b.barrage.left <= 0 && b.punchT < 0) b.barrage = null;
}

// ------------------------------------------------------------
// Landing damage + ring-out
// ------------------------------------------------------------
function updateLandings(b) {
  if (b.state !== 'ragdoll') return;
  const c = b.ragdoll.center();
  const gy = groundYAt(c.x, c.z);

  if (b.pendingLandDmg > 0 && b.ragdoll.airTime > 0.12 && c.y < gy + 0.55) {
    const dmg = b.pendingLandDmg;
    b.pendingLandDmg = 0;
    b.hp = Math.max(0, b.hp - dmg);
    b.sinceHit = 0;
    AudioFX.slam();
    spawnSpark(b.ragdoll.center().clone().add(new THREE.Vector3(0, 0.3, 0)), true);
    game.shake = Math.max(game.shake, 0.45);
    world.crowd.excitement = 1;
    if (b.isPlayer) flashVignette();
    if (b.hp <= 0 && !b.isKO) knockOutBoxer(b, null);
  }

}

// RING OUT — leaving the ring loses the fight whether you're knocked out or not
function checkRingOut(b) {
  if (game.matchOver || b.eliminated) return;
  if (b.state === 'carried') return;              // still being held over the ring
  const c = b.isRagdolled ? b.ragdoll.center() : b.pos;
  // Out = past the ropes, not past the platform. The apron (the strip of
  // platform outside the ropes) used to count as "still in", so you could land
  // out there and the fight carried on. Rope-caught bodies clamp to
  // postHalf-0.05, so this sits just beyond them.
  const OUT = RING.postHalf + 0.1;
  const outside = Math.abs(c.x) > OUT || Math.abs(c.z) > OUT;
  if (!outside) return;
  // a body still sailing through the air isn't out until it comes down
  if (b.isRagdolled && c.y > 0.5 && !b.ragdoll.landed) return;
  eliminate(b);
}

function eliminate(loser) {
  loser.eliminated = true;
  game.matchOver = true;
  // DUELS: if the fallen side still has someone in the corner, this is a tag,
  // not the end of the fight.
  const down = loser.isPlayer ? (game.teamDown || []) : (game.enemyDown || []);
  const squad = loser.isPlayer ? (game.team || []) : (game.enemyTeam || []);
  down.push(loser.cfg.id);
  game.tagSide = (down.length < squad.length) ? (loser.isPlayer ? 'player' : 'enemy') : null;
  game.playerWon = !loser.isPlayer;
  game.slowmoTimer = 2.0;
  game.endTimer = loser.isPlayer ? 3.0 : 4.0;   // room for the replay, then the pose
  announce('RING OUT!!', '#ffd94d');
  AudioFX.bell(3);
  if (loser.isPlayer) AudioFX.roar(); else AudioFX.boo();
  // cut to a third-person shot of the flight — it's the best thing the game
  // does and you were only ever seeing it down the barrel of your own nose
  game.ringOutCam = { loser, t: 0 };
  const at = loser.isRagdolled ? loser.ragdoll.center() : loser.pos;
  world.crowd.pop(at);
  world.crowd.excitement = 1;
  const winner = loser.isPlayer ? game.enemy : game.player;
  winner.victoryT = 1;
  subhint('');
}

function showEndScreen() {
  cleanupMatch();
  const cup = TOURNAMENTS[game.tournament] || TOURNAMENTS.bronze;
  if (game.playerWon && isChallenge()) {
    const foe = BOXER_DEFS[game.ladder[game.ladder.length - 1]];
    $('end-medal').textContent = '⚔️';
    $('end-title').textContent = 'CHALLENGE CLEARED!';
    const foeName = foe ? foe.name : 'the challenger';
    $('end-sub').textContent = challengeBonus > 0
      ? BOXER_DEFS[game.selectedId].name + ' put ' + foeName + ' down — first clear, +' +
        challengeBonus + ' steroids!'
      : BOXER_DEFS[game.selectedId].name + ' put ' + foeName + ' down again.';
  } else if (game.playerWon) {
    $('end-medal').textContent = cup.medal;
    $('end-title').textContent = cup.name + ' CHAMPION!';
    $('end-sub').textContent =
      BOXER_DEFS[game.selectedId].name + ' beat all ' + game.ladder.length + ' wrestlers!';
  } else {
    $('end-medal').textContent = '💀';
    $('end-title').textContent = 'RING OUT...';
    const beaten = game.fightIndex;
    const foe = BOXER_DEFS[game.ladder[Math.min(beaten, game.ladder.length - 1)]];
    $('end-sub').textContent = isChallenge()
      ? (foe ? foe.name + ' put you on the floor. Come back for them.' : 'Challenge failed.')
      : (beaten > 0
          ? 'You got tossed on fight ' + (beaten + 1) + ' of ' + game.ladder.length + '. So close.'
          : 'You got tossed. The ' + cup.name.charAt(0) + cup.name.slice(1).toLowerCase() +
            ' Tournament goes on without you.');
  }
  $('btn-rematch').textContent = isChallenge() ? 'RETRY CHALLENGE' : 'RETRY TOURNAMENT';
  show('end-screen');
  game.state = 'end';
  Music.sting(game.playerWon);
  renderRoster();
}

// ------------------------------------------------------------
// Player movement + camera
// ------------------------------------------------------------
// A body you could be throwing out of the ring. Spinning past it wastes the
// only window that actually wins the fight, so no roll may run through it.
function downForTheCount(b) {
  return !!b && (b.isKO || b.state === 'carried');
}

// Mirrors what the AI already does for itself: drop out of the spin the instant
// they go down, so you can get to the grab.
function checkPlayerRollBreak() {
  const p = game.player, e = game.enemy;
  if (!p || !e || !p.roll) return;
  if (downForTheCount(e)) p.endRoll();
}

// PRIME HOUND'S SECOND GEAR. The boss whirls when he drops under his rage
// line; the trigger lived in the AI controller, so playing as the Hound you
// could never spin at all. Same line, same 8 seconds — but you steer yours.
function checkPlayerRage() {
  const p = game.player, e = game.enemy;
  if (!p || !e || game.matchOver) return;
  if (p.cfg.rageAt == null || p.rage) return;
  if (p.state !== 'fight' || p.roll || p.hp <= 0) return;
  if (p.hp > p.maxHp * p.cfg.rageAt) return;
  // they're on the canvas — hold the whirl. `rage` stays unset, so it fires
  // the moment they're back up rather than being spent on nobody.
  if (downForTheCount(e)) return;
  p.rage = true;
  combatAPI.doHoundSpin(p, e, true);
}

function updatePlayerInput(dt) {
  const p = game.player;
  p.moveInput.set(0, 0, 0);
  if (p.rage) { updateRage(p, dt); return; }   // not your body right now
  if (!game.locked || p.state !== 'fight') return;

  let f = 0, r = 0;
  if (keys['KeyW'] || keys['ArrowUp']) f += 1;
  if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) r -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) r += 1;

  const fw = camForward();
  const side = new THREE.Vector3(-fw.z, 0, fw.x);
  const mv = new THREE.Vector3().addScaledVector(fw, f).addScaledVector(side, r);
  if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(p.moveSpeed);
  p.moveInput.copy(mv);
  p.yaw = game.camYaw; // face where the camera looks
}

function updateCamera(dt, t) {
  const p = game.player;
  if (game.state === 'cutscene') {
    // slow menacing orbit that pushes in on the next opponent
    const k = Math.min(1, game.cutT / 6.5);
    const ang = game.cutT * 0.3; // start face-on, then drift around them
    const dist = 4.5 - k * 1.5;
    camera.position.set(Math.sin(ang) * dist, 2.05 - k * 0.45, 0.4 + Math.cos(ang) * dist);
    camera.lookAt(0, 0.95, 0.4);
    return;
  }
  if (game.state === 'ceremony') {
    // start on the medal, then drift up and back to take in the whole champion
    const k = Math.min(1, game.cerT / 5);
    const ease = k * k * (3 - 2 * k);
    const ang = -0.35 + game.cerT * 0.16;
    const dist = 1.9 + ease * 1.6;
    // heights are ring-relative: the canvas sits at RING.top, so the medal
    // hangs around RING.top + 1.2 and the head around RING.top + 1.7
    const medalY = RING.top + 1.22;
    camera.position.set(Math.sin(ang) * dist, medalY + 0.12 + ease * 0.62, 0.4 + Math.cos(ang) * dist);
    camera.lookAt(0, medalY + ease * 0.34, 0.4);
    return;
  }
  if (game.state === 'select') {
    // front-row view of the spinning boxers
    // aim below the fighter so they sit high in frame, above the info panel
    // framed so even Big Wave's topknot clears the header
    camera.position.set(0, 2.2, 8.8);
    camera.lookAt(0, -1.05, 0.4);
    return;
  }
  if (!p) {
    // main-menu orbit
    const a = t * 0.12;
    camera.position.set(Math.sin(a) * 11, 4.2 + Math.sin(t * 0.4) * 0.4, Math.cos(a) * 11);
    camera.lookAt(0, 1.3, 0);
    return;
  }
  if (game.state === 'versus') {
    const a = t * 0.25;
    camera.position.set(Math.sin(a) * 7, 2.6, Math.cos(a) * 7);
    camera.lookAt(0, 1.2, 0);
    return;
  }

  // RING OUT REPLAY: swing out and track the body as it sails over the ropes.
  if (game.ringOutCam) {
    const ro = game.ringOutCam;
    ro.t += dt;
    const b = ro.loser;
    if (ro.t < 1.7 && b) {
      if (p) { p.setBodyHidden(false); p.root.visible = true; }
      $('crosshair').style.opacity = '0';
      const c = b.isRagdolled ? b.ragdoll.center() : b.pos;
      // sit inside the ring, off to one side, looking out along the flight
      const out = new THREE.Vector3(c.x, 0, c.z);
      if (out.lengthSq() < 0.01) out.set(0, 0, 1);
      out.normalize();
      const side = new THREE.Vector3(-out.z, 0, out.x);
      const k = Math.min(1, ro.t / 1.7);
      const eye = new THREE.Vector3()
        .copy(c)
        .addScaledVector(out, -3.4 - k * 1.2)
        .addScaledVector(side, 2.8)
        .setY(RING.top + 2.3 + k * 0.7);
      if (!game.camEye) game.camEye = eye.clone();
      game.camEye.lerp(eye, 1 - Math.exp(-9 * dt));
      camera.position.copy(game.camEye);
      if (game.shake > 0.002) {
        camera.position.x += (Math.random() - 0.5) * game.shake * 0.12;
        camera.position.y += (Math.random() - 0.5) * game.shake * 0.12;
        game.shake *= Math.exp(-7 * dt);
      }
      camera.lookAt(c.x, c.y + 0.3, c.z);
      return;
    }
    game.ringOutCam = null;
    game.camEye = null;   // let the next shot place itself cleanly
  }

  // VICTORY LAP: the one moment we leave first person. Otherwise you'd be
  // celebrating behind your own eyes and never see the pose at all.
  if (p.victoryT > 0 && p.state === 'fight' && !p.isRagdolled) {
    p.setBodyHidden(false);
    p.root.visible = true;
    $('crosshair').style.opacity = '0';
    game.celebT = (game.celebT || 0) + dt;
    const k = Math.min(1, game.celebT / 1.3);
    const ease = k * k * (3 - 2 * k);
    const focus = p.pos.clone();
    focus.y += 1.28 * p.scale;
    // pull back off his shoulder, then arc around toward a three-quarter view
    const ang = p.root.rotation.y + Math.PI + game.celebT * 0.9;
    const dist = (1.75 + ease * 2.0) * p.scale;
    const eye = new THREE.Vector3(
      focus.x + Math.sin(ang) * dist,
      focus.y + 0.34 + ease * 0.5,
      focus.z + Math.cos(ang) * dist);
    eye.y = Math.max(eye.y, groundYAt(eye.x, eye.z) + 0.45);
    if (!game.camEye) game.camEye = eye.clone();
    game.camEye.lerp(eye, 1 - Math.exp(-16 * dt));
    camera.position.copy(game.camEye);
    if (game.shake > 0.002) {
      camera.position.x += (Math.random() - 0.5) * game.shake * 0.12;
      camera.position.y += (Math.random() - 0.5) * game.shake * 0.12;
      game.shake *= Math.exp(-7 * dt);
    }
    camera.lookAt(focus);
    return;
  }

  // ALWAYS FIRST PERSON. On your feet you look through your own eyes;
  // ragdolled, the camera rides your head — you fly wherever you're thrown.
  p.setBodyHidden(true);
  p.root.visible = p.state === 'fight'; // hide your flailing limbs while down
  $('crosshair').style.opacity = '';

  game.kickP *= Math.exp(-8 * dt);
  game.kickY *= Math.exp(-8 * dt);

  const eye = new THREE.Vector3();
  let smooth = 40;
  if (p.isRagdolled) {
    eye.copy(p.ragdoll.pts[0].p); // your head, wherever physics took it
    eye.y = Math.max(eye.y, groundYAt(eye.x, eye.z) + 0.16);
    smooth = 11;
  } else if (p.roll) {
    // Rolling: never tumble the view. The upright whirl gets hidden — its arms
    // scythe straight through the lens once per rotation. The tucked-up barrel
    // roll stays visible, because watching your own legs whip past is the fun.
    p.root.visible = !p.roll.upright;
    eye.copy(p.pos);
    eye.y += (p.roll.upright ? 1.42 : RIG.hipY * 0.95) * p.scale;
    smooth = 16;
  } else if (p.state === 'getup') {
    eye.copy(p.pos);
    eye.y += 1.56 * p.scale;
    smooth = 5; // rise back to your feet
  } else {
    const moving = p.moveInput.lengthSq() > 0.2;
    eye.copy(p.pos);
    eye.y += 1.56 * p.scale
      + (moving ? Math.abs(Math.sin(p.walkPhase)) * 0.05 : Math.sin(t * 2.2) * 0.015);
    eye.addScaledVector(camForward(), 0.05); // gloves sit lower in frame
  }

  if (!game.camEye) game.camEye = eye.clone();
  game.camEye.lerp(eye, 1 - Math.exp(-smooth * dt));

  const pitch = THREE.MathUtils.clamp(game.camPitch + game.kickP, -0.9, 0.9);
  const yaw = game.camYaw + game.kickY;
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camera.position.copy(game.camEye);
  if (game.shake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * game.shake * 0.12;
    camera.position.y += (Math.random() - 0.5) * game.shake * 0.12;
    game.shake *= Math.exp(-7 * dt);
  }
  camera.lookAt(camera.position.clone().add(dir));
}

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------
function updateHUD() {
  const p = game.player, e = game.enemy;
  if (!p) return;
  const pf = Math.max(0, p.hp / p.maxHp), ef = Math.max(0, e.hp / e.maxHp);
  $('hp-fill-p').style.transform = `scaleX(${pf})`;
  $('hp-ghost-p').style.transform = `scaleX(${pf})`;
  $('hp-fill-e').style.transform = `scaleX(${ef})`;
  $('hp-ghost-e').style.transform = `scaleX(${ef})`;
  $('hp-fill-p').classList.toggle('low', pf < 0.3);
  $('hp-fill-e').classList.toggle('low', ef < 0.3);

  // damage flash + shake
  if (game.lastPhp !== undefined) {
    if (p.hp < game.lastPhp - 0.01) hurtBar('.hp-wrap.left');
    if (e.hp < game.lastEhp - 0.01) hurtBar('.hp-wrap.right');
  }
  game.lastPhp = p.hp; game.lastEhp = e.hp;

  $('special-fill').style.transform = `scaleX(${p.meter})`;
  document.querySelector('.special-box').classList.toggle('ready', p.meter >= 1 && p.state === 'fight');
  // show the steel plates left on the gloves — otherwise the special looks inert
  $('special-name').textContent = p.steel > 0
    ? 'STEEL ' + '◆'.repeat(p.steel)
    : p.cfg.specialName;

  if (p.isKO) {
    $('ko-count').textContent = Math.ceil(p.koTimer);
  } else {
    if (!$('ko-overlay').classList.contains('hidden')) {
      hide('ko-overlay');
      container.classList.remove('ko-grey');
      Music.muffle(false);
    }
  }
  updateHints();
}

function hurtBar(sel) {
  const el = document.querySelector(sel);
  el.classList.remove('hurt');
  void el.offsetWidth; // restart the animation
  el.classList.add('hurt');
}

let lastHint = '';
function updateHints() {
  const p = game.player, e = game.enemy;
  let hint = '';
  if (!game.matchOver && p && p.state === 'fight') {
    if (p.carrying) hint = 'CLICK — throw them over the ropes!';
    else if (e.isKO && e.state === 'ragdoll') hint = 'They’re OUT! Grab the body (CLICK) and hurl it out of the ring!';
    else if (e.isKO && e.state === 'carried' && e.carriedBy === p) hint = 'CLICK — throw them over the ropes!';
  }
  if (hint !== lastHint) { lastHint = hint; subhint(hint); }
}

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
let lastT = performance.now();
function tick() {
  requestAnimationFrame(tick);
  frame(performance.now());
}
// test hook: advance the simulation manually (e.g. when rAF is throttled)
window.__step = (secs) => {
  let n = lastT;
  const steps = Math.max(1, Math.round(secs / (1 / 60)));
  for (let i = 0; i < steps; i++) { n += 1000 / 60; frame(n); }
};
function frame(now) {
  let dt = Math.min(0.05, Math.max(0.0001, (now - lastT) / 1000));
  lastT = now;
  const t = now / 1000;

  // slow motion drama
  if (game.slowmoTimer > 0) {
    game.slowmoTimer -= dt;
    game.timeScale = game.ringOutCam ? 0.22 : 0.35;   // crawl for the ring-out
  } else game.timeScale += (1 - game.timeScale) * 0.1;
  let sdt = dt * game.timeScale;

  // pause when unlocked mid-fight
  const fighting = game.state === 'fight';
  if (fighting && !game.locked && !game.matchOver) sdt = 0;

  if (fighting && sdt > 0) {
    if (game.fightIntro > 0) game.fightIntro -= sdt;

    updatePlayerInput(sdt);
    checkPlayerRollBreak();
    checkPlayerRage();
    game.ai.update(sdt, t);

    updateSuplexes(sdt);
    updatePiledrivers(sdt);
    updateCoins(sdt);
    updateCarry(game.player);
    updateCarry(game.enemy);

    updateBarrage(game.player, game.enemy, sdt);
    updateBarrage(game.enemy, game.player, sdt);

    game.player.update(sdt, t, game.enemy);
    game.enemy.update(sdt, t, game.player);

    resolvePunches(game.player, game.enemy, sdt);
    resolvePunches(game.enemy, game.player, sdt);

    updateLandings(game.player);
    updateLandings(game.enemy);
    checkRingOut(game.player);
    checkRingOut(game.enemy);

    updateHUD();

    if (game.endTimer > 0) {
      game.endTimer -= dt;
      if (game.endTimer <= 0) finishRound();
    }
  } else if (game.state === 'versus' && game.player) {
    game.player.update(0.0001, t, game.enemy);
    game.enemy.update(0.0001, t, game.player);
  } else if (game.state === 'select') {
    // turntable spin — absolute time, applied directly, so it never judders
    const ang = t * 0.9;
    for (const k in selectModels) {
      const md = selectModels[k];
      if (!md.root.visible) continue;
      md.yaw = ang;
      md.update(dt, t, null);
      md.root.rotation.y = ang;
      md.root.quaternion.setFromEuler(md.root.rotation);
    }
  } else if (game.state === 'ceremony' && game.cutModel) {
    game.cerT += dt;
    const md = game.cutModel;
    md.victoryT = 1;
    md.yaw = Math.sin(t * 0.35) * 0.22;
    md.update(dt, t, null);
  } else if (game.state === 'cutscene' && game.cutModel) {
    game.cutT += dt;
    const md = game.cutModel;
    game.cutPunchT -= dt;
    if (game.cutPunchT <= 0) { md.startPunch(1.2); game.cutPunchT = 0.75 + Math.random() * 0.5; }
    md.yaw = Math.sin(t * 0.5) * 0.35;
    md.update(dt, t, null);
  }

  // stage lighting only on the display screens
  const onStage = game.state === 'select' || game.state === 'cutscene';
  // enough to lift dark skin off the dark arena, not enough to blow out mid tones
  world.displayLight.intensity += ((onStage ? 0.8 : 0) - world.displayLight.intensity) * Math.min(1, dt * 6);
  world.displayFill.intensity += ((onStage ? 0.28 : 0) - world.displayFill.intensity) * Math.min(1, dt * 6);

  world.crowd.update(t, dt);
  updateSparks(dt);
  updateCracks(dt);
  updateRingWarp(dt);
  updatePauseOverlay();   // cheap, and self-corrects after any state change
  updateCamera(dt, t);
  renderer.render(scene, camera);
}
tick();
