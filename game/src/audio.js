// audio.js — generative WebAudio music and synth sound effects.
// One small job: a moonlit pad progression with wandering pentatonic plucks,
// plus a named sound for every game action. No audio files, ever.

const CHORDS = [
  [110.0, 164.81, 261.63, 329.63],   // A minor
  [87.31, 130.81, 220.0, 261.63],    // F major
  [98.0, 146.83, 246.94, 293.66],    // G major
  [110.0, 164.81, 220.0, 329.63],    // A minor colour
];
const PLUCKS = [440, 523.25, 659.25, 783.99, 880, 1046.5];

export function createAudio() {
  let ctx = null, master = null, musicGain = null, muted = false;
  let chordStep = 0, nextNoteAt = 0, pluckIndex = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      nextNoteAt = ctx.currentTime + 0.1;
      return true;
    } catch { return false; }
  }

  function tone(freq, dur, type, vol, dest, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  const sfx = {
    shoot() { tone(880 + Math.random() * 120, 0.07, 'square', 0.05, master, 420); },
    echoShoot() { tone(660 + Math.random() * 80, 0.08, 'triangle', 0.05, master, 990); },
    hit() { noiseBurst(0.05, 0.08, 1800); },
    kill() { tone(520, 0.14, 'triangle', 0.12, master, 130); noiseBurst(0.09, 0.06, 900); },
    dew() { tone(1320 + Math.random() * 200, 0.09, 'sine', 0.07, master, 1760); },
    hurt() { tone(180, 0.2, 'sawtooth', 0.14, master, 70); },
    lanternHit() { tone(140, 0.3, 'sawtooth', 0.16, master, 55); noiseBurst(0.2, 0.1, 300); },
    dash() { noiseBurst(0.14, 0.1, 2400); },
    echo() { tone(392, 0.5, 'sine', 0.14, master, 784); tone(587, 0.5, 'sine', 0.09, master, 1175); },
    echoFail() { tone(220, 0.15, 'square', 0.07, master, 180); },
    buy() { tone(784, 0.12, 'triangle', 0.12, master); setTimeout(() => tone(1175, 0.16, 'triangle', 0.12, master), 60); },
    deny() { tone(196, 0.16, 'square', 0.09, master, 147); },
    wave() { tone(262, 0.4, 'triangle', 0.13, master, 392); },
    boss() { tone(98, 0.9, 'sawtooth', 0.18, master, 65); tone(147, 0.9, 'sawtooth', 0.1, master, 98); },
    phase() { tone(110, 0.5, 'sawtooth', 0.16, master, 220); noiseBurst(0.4, 0.1, 500); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.13, master), i * 130)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.13, master), i * 160)); },
    streak() { tone(1568, 0.1, 'sine', 0.08, master, 2093); },
  };

  return {
    unlock() { ensure(); },
    play(name) { if (!ctx || muted) return; if (sfx[name]) sfx[name](); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted: () => muted,
    update(intensity) {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      if (now < nextNoteAt) return;
      const chord = CHORDS[chordStep % CHORDS.length];
      for (const f of chord) tone(f, 2.4, 'sine', 0.05, musicGain);
      const plucks = 1 + Math.floor(intensity * 2);
      for (let i = 0; i < plucks; i++) {
        const f = PLUCKS[(pluckIndex + i * 2) % PLUCKS.length] * (chordStep % 2 ? 1 : 0.5);
        setTimeout(() => tone(f, 0.7, 'triangle', 0.035, musicGain), i * 210);
      }
      pluckIndex += 1 + (chordStep % 3);
      chordStep++;
      nextNoteAt = now + 2.2;
    },
  };
}
