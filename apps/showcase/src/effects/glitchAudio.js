/* ============================================================================
   GLITCH AUDIO
   Glitch Lab's synthesiser, apart from its UI, so Home's hero can voice the
   same faults the same way. See AUDIO.md for why it is synthesised.
   ========================================================================== */

/* ============================================================================
   AUDIO — synthesised, not sampled.

   Three reasons this beats sourcing files for these particular sounds:

   1. The events already carry keyframed envelopes. A synth can read the same
      curve; a .wav cannot. The audio and the picture fail together.
   2. Repetition is the tell. Fire DROPOUT twenty times with an identical
      sample and the illusion dies. Every shot here randomises playback rate,
      filter frequency and timing.
   3. Some of it is more accurate synthesised. CRT whine is 15.734 kHz — the
      NTSC horizontal scan rate — and an oscillator hits it exactly, for zero
      bytes and zero licensing.

   Nothing starts without a user gesture: browsers block it, and autoplaying
   audio is hostile regardless.
   ========================================================================== */

const NTSC_SCAN = 15734; // horizontal scan frequency — the CRT whine
const MAINS = 60; // hum fundamental; use 50 outside the Americas

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0.5;
  // A limiter, so stacked events cannot clip. Glitch audio has extreme crest
  // factors — an unlimited noise burst on top of a thunk will square off.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  // one shared noise table; re-pitched per voice so bursts never repeat
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const R = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------- primitives */
  function noise(t, dur, o = {}) {
    const {
      f0 = 2000,
      f1 = f0,
      q = 1,
      type = "bandpass",
      gain = 0.4,
      attack = 0.003,
      curve = "exp",
    } = o;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = R(0.7, 1.4);
    src.playbackRate.setValueAtTime(src.playbackRate.value, t);

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    if (curve === "exp") g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.06);
    src.onended = () => {
      try {
        g.disconnect();
        filt.disconnect();
      } catch {
        /* noop */
      }
    };
  }

  function tone(t, dur, o = {}) {
    const { f0 = 200, f1 = f0, type = "sine", gain = 0.25, attack = 0.004, lp = 0, q = 1 } = o;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(10, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);

    let node = osc;
    let filt = null;
    if (lp) {
      filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(lp, t);
      filt.Q.value = q;
      osc.connect(filt);
      node = filt;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => {
      try {
        g.disconnect();
        if (filt) filt.disconnect();
      } catch {
        /* noop */
      }
    };
  }

  /* -------------------------------------------------- per-event voicing --
     Each one is written from the same physical story as its shader. */
  const VOICES = {
    // Oxide flaw: broadband crack, then the AGC over-corrects and hisses.
    dropout(t) {
      noise(t, 0.045, { f0: R(2600, 4200), q: 0.8, gain: 0.55, attack: 0.001 });
      noise(t + 0.012, 0.14, { f0: R(900, 1400), f1: 400, q: 2.5, gain: 0.22 });
      if (Math.random() > 0.5) noise(t + R(0.05, 0.1), 0.03, { f0: 5200, gain: 0.3 });
    },

    // Sync failure: the 60Hz field buzz detunes downward, snow swells behind it.
    signal(t) {
      tone(t, 0.55, { f0: MAINS, f1: MAINS * 0.45, type: "sawtooth", gain: 0.16, lp: 800, q: 6 });
      noise(t + 0.02, 0.85, {
        f0: 1200,
        f1: 5000,
        q: 0.4,
        type: "highpass",
        gain: 0.3,
        attack: 0.06,
      });
      noise(t + 0.3, 0.5, { f0: 300, q: 1.2, gain: 0.14 });
      tone(t + 0.62, 0.28, { f0: MAINS * 0.5, f1: MAINS, type: "square", gain: 0.1, lp: 500 });
    },

    // Packet loss: stepped square blips at quantised pitches. Deliberately
    // scheduled on a grid — smooth glissando would undo the whole idea.
    corrupt(t) {
      const n = 7 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const at = t + i * 0.028;
        const f = [110, 220, 330, 440, 587, 880, 1320][(Math.random() * 7) | 0];
        tone(at, 0.024, { f0: f, type: "square", gain: 0.14, attack: 0.0005 });
        if (Math.random() > 0.6) noise(at, 0.02, { f0: R(3000, 7000), gain: 0.18, attack: 0.0005 });
      }
      noise(t, 0.05, { f0: 180, q: 3, gain: 0.35, attack: 0.001 });
    },

    // Mechanical failure: a low thump, a rising shriek, and sustained tearing.
    crash(t) {
      tone(t, 0.35, { f0: 90, f1: 32, type: "sine", gain: 0.5, attack: 0.001, lp: 300 });
      noise(t, 0.42, { f0: 400, f1: 2600, q: 0.6, gain: 0.42, attack: 0.002 });
      tone(t + 0.04, 0.3, { f0: 700, f1: 4200, type: "sawtooth", gain: 0.12, lp: 5000, q: 8 });
      noise(t + 0.18, 0.3, { f0: 6000, f1: 900, q: 1.5, gain: 0.25 });
    },

    // The degauss coil: a resonant thunk. Smooth, mechanical, no noise at all.
    degauss(t) {
      tone(t, 0.85, { f0: 150, f1: 38, type: "sine", gain: 0.55, attack: 0.006, lp: 420, q: 9 });
      tone(t + 0.01, 0.6, { f0: 300, f1: 76, type: "triangle", gain: 0.16, lp: 600, q: 4 });
      noise(t, 0.2, { f0: 120, f1: 60, q: 4, gain: 0.1, attack: 0.01 });
    },

    // Shuttle search: pitched tape wow sweeping past playback speed.
    scrub(t) {
      noise(t, 0.55, { f0: 500, f1: 2400, q: 3.5, gain: 0.28, attack: 0.01 });
      noise(t + 0.1, 0.45, { f0: 2200, f1: 700, q: 3.0, gain: 0.2, attack: 0.01 });
      tone(t, 0.5, { f0: 240, f1: 900, type: "sawtooth", gain: 0.07, lp: 2500, q: 5 });
    },

    // Something periodic nearby: mains hum with a slow beat against itself.
    interference(t) {
      tone(t, 1.7, { f0: MAINS, type: "sawtooth", gain: 0.1, lp: 400, q: 3, attack: 0.15 });
      tone(t + 0.05, 1.5, { f0: MAINS * 2 + 1.5, type: "sine", gain: 0.06, attack: 0.2 });
      for (let i = 0; i < 4; i++) {
        noise(t + 0.15 + i * 0.42, 0.12, { f0: R(1800, 3400), q: 2, gain: 0.1 });
      }
    },

    // Power-on: relay click, HV whine spinning up to scan frequency, thunk.
    boot(t) {
      noise(t, 0.02, { f0: 3000, q: 0.5, gain: 0.5, attack: 0.0005 }); // relay
      tone(t + 0.05, 0.9, { f0: 400, f1: NTSC_SCAN, type: "sine", gain: 0.05, attack: 0.2 });
      noise(t + 0.06, 0.7, { f0: 200, f1: 1800, q: 0.8, gain: 0.18, attack: 0.1 });
      VOICES.degauss(t + 0.55);
    },
  };

  /* ----------------------------------------------------------- ambience --
     The bed you stop hearing after ten seconds and immediately miss when it
     cuts. Off by default; the CRT whine especially is not for everyone. */
  let bed = null;
  // `fade` (seconds) eases the bed in and out through its own gain, so it can
  // follow something as quick as a hover without clicking. 0, the default, is
  // the hard switch Glitch Lab's toggle has always been.
  function setBed(on, opts = {}) {
    const { hiss = 0.35, hum = 0.3, whine = 0.25, fade = 0 } = opts;
    if (bed) {
      const old = bed;
      bed = null;
      // stop the sources AND disconnect the gain/filter nodes behind them,
      // or the graph accumulates orphans every time this is toggled
      const end = () => {
        old.sources.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* noop */
          }
        });
        old.chain.forEach((n) => {
          try {
            n.disconnect();
          } catch {
            /* noop */
          }
        });
      };
      if (fade > 0) {
        old.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
        setTimeout(end, fade * 1000 + 50);
      } else end();
    }
    if (!on) return;
    const sources = [];
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(master);
    if (fade > 0) {
      out.gain.setValueAtTime(0, t);
      out.gain.setTargetAtTime(1, t, fade / 4);
    }
    const chain = [out];

    // tape hiss
    const hs = ctx.createBufferSource();
    hs.buffer = noiseBuf;
    hs.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = "highpass";
    hf.frequency.value = 3200;
    const hg = ctx.createGain();
    hg.gain.value = hiss * 0.035;
    hs.connect(hf);
    hf.connect(hg);
    hg.connect(out);
    hs.start(t);
    sources.push(hs);
    chain.push(hf, hg);

    // mains hum plus its second harmonic
    [MAINS, MAINS * 2].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i ? "sine" : "sawtooth";
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 260;
      const g = ctx.createGain();
      g.gain.value = hum * (i ? 0.012 : 0.022);
      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      o.start(t);
      sources.push(o);
      chain.push(lp, g);
    });

    // the flyback whine. Many adults cannot hear 15.7kHz at all — that is
    // authentic, and the reason it is opt-in and separately levelled.
    const w = ctx.createOscillator();
    w.type = "sine";
    w.frequency.value = NTSC_SCAN;
    const wg = ctx.createGain();
    wg.gain.value = whine * 0.01;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23; // slow drift, so it feels alive
    const lfoG = ctx.createGain();
    lfoG.gain.value = 6;
    lfo.connect(lfoG);
    lfoG.connect(w.frequency);
    w.connect(wg);
    wg.connect(out);
    w.start(t);
    lfo.start(t);
    sources.push(w, lfo);
    chain.push(wg, lfoG);

    bed = { sources, chain, out };
  }

  return {
    ctx,
    resume: () => ctx.resume(),
    fire(id) {
      const v = VOICES[id];
      if (!v) return;
      // a touch of scheduling latency keeps the first sample from being clipped
      v(ctx.currentTime + 0.01);
    },
    setVolume: (v) => {
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    setBed,
    dispose() {
      setBed(false);
      try {
        ctx.close();
      } catch {
        /* noop */
      }
    },
  };
}
