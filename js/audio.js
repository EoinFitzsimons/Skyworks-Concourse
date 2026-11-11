/* Skyworks Concourse — synthesised ambience and effect cues (Web Audio API) */
'use strict';

const MUTE_KEY = 'skyworks.tactics.mute';

function makeAudio() {
  let ac = null, master, sfx, amb, running = false, chimeTimer = null, chordTimer = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  const A = { get muted() { return muted; }, get ready() { return !!ac; } };

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = 0.5; sfx.connect(master);
    amb = ac.createGain(); amb.gain.value = 0; amb.connect(master);
  }
  function noiseBuffer(sec = 2) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function startAmbient() {
    if (!ac || running) return;
    running = true;
    amb.gain.setTargetAtTime(0.28, ac.currentTime, 2);
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 0.7; filt.connect(amb);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.04;
    const lfoG = ac.createGain(); lfoG.gain.value = 220; lfo.connect(lfoG).connect(filt.frequency); lfo.start();
    const voices = [0, 1, 2].map(i => {
      const o = ac.createOscillator(); o.type = i === 1 ? 'triangle' : 'sawtooth';
      const g = ac.createGain(); g.gain.value = i === 1 ? 0.09 : 0.05;
      o.connect(g).connect(filt); o.start(); return { o, g };
    });
    const wind = ac.createBufferSource(); wind.buffer = noiseBuffer(3); wind.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 0.5;
    const wg = ac.createGain(); wg.gain.value = 0.05;
    const wl = ac.createOscillator(); wl.frequency.value = 0.08;
    const wlg = ac.createGain(); wlg.gain.value = 0.03; wl.connect(wlg).connect(wg.gain); wl.start();
    wind.connect(bp).connect(wg).connect(amb); wind.start();
    const chords = [[110, 164.81, 261.63], [87.31, 130.81, 220], [130.81, 196, 329.63], [98, 146.83, 246.94]];
    let ci = 0;
    const setChord = () => {
      if (!running) return;
      const ch = chords[ci++ % chords.length], t = ac.currentTime;
      voices.forEach((v, i) => v.o.frequency.setTargetAtTime(ch[i] * (i === 2 ? 0.5 : 1) * (i === 0 ? 1.003 : 1), t, 1.5));
      chordTimer = setTimeout(setChord, 11000);
    };
    setChord();
    const chime = () => {
      if (!running) return;
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      const base = notes[(Math.random() * notes.length) | 0];
      tone(base, 0.02, 2.2, 'sine', 0.04); setTimeout(() => tone(base * 1.5, 0.02, 1.6, 'sine', 0.03), 180);
      chimeTimer = setTimeout(chime, 4000 + Math.random() * 6000);
    };
    chimeTimer = setTimeout(chime, 2500);
  }
  function tone(freq, attack, decay, type = 'sine', gain = 0.2, t = ac.currentTime, slideTo = null) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(sfx); o.start(t); o.stop(t + attack + decay + 0.05);
  }
  function burst(decay, gain, freq = 1200, type = 'highpass', t = ac.currentTime) {
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(0.5);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f).connect(g).connect(sfx); s.start(t); s.stop(t + decay + 0.05);
  }
  const cues = {
    step() { burst(0.05, 0.05, 1800, 'highpass'); tone(220, 0.004, 0.05, 'triangle', 0.04); },
    select() { tone(880, 0.004, 0.06, 'square', 0.04); },
    cancel() { tone(330, 0.004, 0.09, 'square', 0.04, ac.currentTime, 220); },
    denied() { const t = ac.currentTime; tone(220, 0.01, 0.12, 'square', 0.06, t); tone(196, 0.01, 0.18, 'square', 0.06, t + 0.1); },
    swing() { burst(0.12, 0.12, 900, 'bandpass'); },
    hit() { tone(180, 0.005, 0.12, 'square', 0.12, ac.currentTime, 90); burst(0.08, 0.2, 2000); },
    bolt() { const t = ac.currentTime; tone(1400, 0.005, 0.18, 'sawtooth', 0.08, t, 300); burst(0.12, 0.1, 3000, 'highpass'); },
    hurt() { tone(140, 0.005, 0.25, 'sawtooth', 0.16, ac.currentTime, 60); burst(0.18, 0.22, 600, 'lowpass'); },
    steam() { burst(0.5, 0.18, 1200, 'bandpass'); },
    enemyDown() { const t = ac.currentTime; tone(440, 0.01, 0.3, 'sawtooth', 0.1, t, 110); burst(0.3, 0.2, 3000); tone(880, 0.01, 0.2, 'triangle', 0.06, t + 0.08); },
    pickup() { const t = ac.currentTime; tone(880, 0.01, 0.12, 'sine', 0.12, t); tone(1318.5, 0.01, 0.22, 'sine', 0.1, t + 0.08); },
    item() { const t = ac.currentTime; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.01, 0.35, 'triangle', 0.09, t + i * 0.09)); },
    quest() { const t = ac.currentTime; [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.01, 0.5, 'triangle', 0.08, t + i * 0.07)); },
    turn() { tone(660, 0.005, 0.1, 'triangle', 0.05); },
    enemyTurn() { tone(330, 0.005, 0.12, 'square', 0.03); },
    round() { const t = ac.currentTime; tone(392, 0.01, 0.2, 'triangle', 0.05, t); tone(523.25, 0.01, 0.25, 'triangle', 0.05, t + 0.1); },
    lift() { const t = ac.currentTime; tone(200, 0.02, 0.6, 'sine', 0.1, t, 800); burst(0.4, 0.08, 500, 'bandpass'); },
    heal() { const t = ac.currentTime; [659.25, 783.99, 987.77].forEach((f, i) => tone(f, 0.01, 0.3, 'sine', 0.07, t + i * 0.08)); },
    overclock() { const t = ac.currentTime; tone(110, 0.02, 0.5, 'sawtooth', 0.1, t, 880); tone(1760, 0.01, 0.3, 'sine', 0.05, t + 0.3); },
    alert() { tone(900, 0.005, 0.08, 'square', 0.05, ac.currentTime); tone(900, 0.005, 0.08, 'square', 0.05, ac.currentTime + 0.12); },
    charge() { burst(0.35, 0.15, 500, 'bandpass'); tone(120, 0.02, 0.35, 'sawtooth', 0.08, ac.currentTime, 240); },
    district() { const t = ac.currentTime; [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.02, 1.2, 'sine', 0.07, t + i * 0.18)); },
    buy() { const t = ac.currentTime; tone(659.25, 0.01, 0.15, 'square', 0.07, t); tone(987.77, 0.01, 0.3, 'square', 0.07, t + 0.1); },
    cleared() { const t = ac.currentTime; [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => tone(f, 0.02, 0.9, 'triangle', 0.08, t + i * 0.12)); },
    ignite() {
      const t = ac.currentTime;
      tone(80, 0.1, 3.5, 'sawtooth', 0.2, t, 640); burst(2.5, 0.18, 800, 'lowpass');
      [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.05, 3.2, 'triangle', 0.09, t + 1.2 + i * 0.15));
      setTimeout(() => { if (running) amb.gain.setTargetAtTime(0.45, ac.currentTime, 2); }, 1000);
    },
    gameover() { const t = ac.currentTime; [330, 277, 220, 165].forEach((f, i) => tone(f, 0.02, 0.9, 'sawtooth', 0.1, t + i * 0.35, f * 0.8)); }
  };
  A.init = init;
  A.start = () => { init(); if (ac.state === 'suspended') ac.resume(); startAmbient(); };
  A.play = name => { if (!ac || muted) return; try { cues[name] && cues[name](); } catch (e) { /* audio is best-effort */ } };
  A.setMuted = v => {
    muted = v; localStorage.setItem(MUTE_KEY, v ? '1' : '0');
    if (master) master.gain.setTargetAtTime(v ? 0 : 1, ac.currentTime, 0.05);
    if (!v && ac && ac.state === 'suspended') ac.resume();
  };
  A.toggle = () => { A.setMuted(!muted); return !muted; };
  return A;
}
