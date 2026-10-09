import { useCallback, useEffect, useRef } from "react";
import { CHAINS } from "./glitch/data/chains.js";
import { EFFECTS } from "./glitch/data/effects/index.js";
import { EV_BY_ID, EVENTS } from "./glitch/data/events/index.js";
import { PRESETS } from "./glitch/data/presets.js";
import { COMMON } from "./glitch/shaders/common.js";
import { SRC_FS } from "./glitch/shaders/source.js";

export { CHAINS, COMMON, EFFECTS, EV_BY_ID, EVENTS, PRESETS, SRC_FS };

/* ============================================================================
   GLITCH ENGINE
   Glitch Lab's signal path, apart from its UI: the event bus (keyframed
   faults) and the WebGL render loop as a hook. The shaders, effects, events,
   chains and presets it runs live in ./glitch/. Glitch Lab drives every knob
   of it; Home's hero drives a few. One copy, so the two can never drift apart.

   The pipeline is ordered as a real signal path — see GlitchLab.jsx:

     SOURCE → TAPE → COMPOSITE SIGNAL → DIGITAL → DISPLAY → GLASS
   ========================================================================== */

/** Sample a keyframe track. A "step" key holds the previous value, then jumps. */
export function sampleKeys(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i],
      k0 = keys[i - 1];
    if (u <= k1[0]) {
      if (k1[2] === "step") return k0[1];
      const t = (u - k0[0]) / Math.max(1e-6, k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * t;
    }
  }
  return keys[keys.length - 1][1];
}

export const hashf = (n) => {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
};

/**
 * The chaos term. Quantised to ~24Hz so it stutters like frames dropping
 * rather than shimmering like noise, and it only ever *reduces* the envelope —
 * a fault that randomly gets stronger than its own peak feels wrong.
 */
export function chaosEnv(u, chaos, seed) {
  if (chaos <= 0) return 1;
  const f = Math.floor(u * 24);
  const n = hashf(f * 7.13 + seed * 31.7);
  const dip = n > 0.72 ? 1 - chaos * (0.35 + 0.65 * hashf(f * 3.1 + seed)) : 1;
  return dip;
}

/* ================================================================== WebGL */
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "shader compile failed");
  }
  return s;
}
const VS = `
attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export function program(gl, frag) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, VS);
  const f = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) || "link failed");
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}
function makeRT(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb };
}

/**
 * A full effect config: every effect at its parameter defaults (only the CRT
 * on), with the named preset applied over it. A fresh object each call.
 *
 * @param {string} preset A key of PRESETS.
 * @returns {Record<string, Record<string, number>>} Effect id → its knobs.
 */
export function configFor(preset) {
  const cfg = {};
  for (const e of EFFECTS) {
    cfg[e.id] = { on: e.id === "crt" ? 1 : 0, amt: 1 };
    for (const [k, , , d] of e.params) cfg[e.id][k] = d;
  }
  for (const [k, v] of Object.entries(PRESETS[preset])) Object.assign(cfg[k], v);
  return cfg;
}

/**
 * Starts the event `id` on an engine's event bus (its `activeRef`), now.
 *
 * @returns The event's definition, or undefined for an unknown id.
 */
export function fireEvent(activeRef, id) {
  const def = EV_BY_ID[id];
  if (def)
    activeRef.current.push({ def, t0: performance.now() / 1000, seed: Math.random() * 1000 });
  return def;
}

/** Gives the graph source a new layout: a fresh seed in `seedRef`, never 0. */
export function shuffleSeed(seedRef) {
  seedRef.current = 1 + Math.floor(Math.random() * 997);
}

// The clock a still frame is drawn at, so it is the same frame every time.
const STILL_TIME = 2.5;

/**
 * Runs the pipeline into a canvas appended to `hostRef.current`. Everything
 * the loop reads is a ref, so it is current as of the last commit without
 * re-arming the loop. Required: cfgRef (effect config, as Glitch Lab builds
 * it), srcRef (source index), activeRef and queueRef (the event bus). Optional:
 * autoRef/rateRef (auto-fire), audioRef, stillRef (true: draw one frame per
 * invalidate() instead of looping — for reduced motion), seedRef (the graph
 * source's layout seed; see shuffleSeed).
 *
 * Options: onError/onLive/onFps callbacks; maxFps (0 = every display frame)
 * and maxDpr, for a small screen that should not cost what Glitch Lab does.
 *
 * Returns `invalidate`, which draws a frame now; needed only for stills.
 *
 * @param {{ current: HTMLElement | null }} hostRef
 * @param {Record<string, { current: any }>} refs
 * @param {{
 *   onError?: (message: string) => void,
 *   onLive?: (running: Array<{ id: string, label: string, u: number }>) => void,
 *   onFps?: (fps: number) => void,
 *   maxFps?: number,
 *   maxDpr?: number,
 * }} [options]
 * @returns {() => void}
 */
export function useGlitchEngine(
  hostRef,
  refs,
  { onError, onLive, onFps, maxFps = 0, maxDpr = 1.5 } = {},
) {
  const none = useRef(null);
  const { cfgRef, srcRef, activeRef, queueRef } = refs;
  const autoRef = refs.autoRef ?? none;
  const rateRef = refs.rateRef ?? none;
  const audioRef = refs.audioRef ?? none;
  const stillRef = refs.stillRef ?? none;
  const seedRef = refs.seedRef ?? none;
  const callbacks = useRef({ onError, onLive, onFps });
  useEffect(() => {
    callbacks.current = { onError, onLive, onFps };
  });
  const invalidate = useRef(() => {});
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(canvas);
    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) {
      callbacks.current.onError?.("WebGL unavailable in this context.");
      return undefined;
    }

    let progs,
      srcProg,
      copyProg,
      quad,
      rtA,
      rtB,
      feed0,
      feed1,
      raf = 0;
    try {
      srcProg = program(gl, SRC_FS);
      copyProg = program(
        gl,
        `${COMMON}\nvoid main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }`,
      );
      progs = {};
      for (const e of EFFECTS) progs[e.id] = program(gl, e.frag);
    } catch (e) {
      callbacks.current.onError?.(String(e.message || e));
      return undefined;
    }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    let W = 1,
      H = 1;
    const dpr = Math.min(window.devicePixelRatio, maxDpr);
    const minGap = maxFps > 0 ? 1000 / maxFps - 1 : 0;
    let lastDraw = -Infinity;
    const resize = () => {
      W = Math.max(2, Math.floor(host.clientWidth * dpr));
      H = Math.max(2, Math.floor(host.clientHeight * dpr));
      canvas.width = W;
      canvas.height = H;
      [rtA, rtB, feed0, feed1].forEach((rt) => {
        if (!rt) return;
        gl.deleteTexture(rt.tex);
        gl.deleteFramebuffer(rt.fb);
      });
      rtA = makeRT(gl, W, H);
      rtB = makeRT(gl, W, H);
      feed0 = makeRT(gl, W, H);
      feed1 = makeRT(gl, W, H);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      invalidate.current();
    });
    ro.observe(host);

    const bind = (prog) => {
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      return (n) => gl.getUniformLocation(prog, n);
    };

    let t0 = performance.now(),
      fAcc = 0,
      fN = 0,
      fT = 0,
      nextAuto = 2,
      liveT = 0;

    const frame = (now) => {
      // A still renders one frame per invalidate() rather than looping.
      const still = !!stillRef.current;
      if (!still) raf = requestAnimationFrame(frame);
      // Under a frame cap, skip display frames until the gap has passed.
      if (!still && now - lastDraw < minGap) return;
      lastDraw = now;
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const time = still ? STILL_TIME : now / 1000;
      const base = cfgRef.current;

      /* ---- event bus -------------------------------------------------- */
      for (let i = queueRef.current.length - 1; i >= 0; i--) {
        if (queueRef.current[i].at <= time) {
          const { id } = queueRef.current.splice(i, 1)[0];
          const def = EV_BY_ID[id];
          if (def) {
            activeRef.current.push({ def, t0: time, seed: Math.random() * 1000 });
            audioRef.current?.fire(id);
          }
        }
      }
      if (autoRef.current) {
        nextAuto -= dt;
        if (nextAuto <= 0) {
          const e = EVENTS[(Math.random() * EVENTS.length) | 0];
          activeRef.current.push({ def: e, t0: time, seed: Math.random() * 1000 });
          audioRef.current?.fire(e.id);
          nextAuto = 0.4 + (1 - rateRef.current) * 7 + Math.random() * 2;
        }
      }

      // Resolve every active event into a per-effect override layer. Multiple
      // events stack: `max` takes the strongest, `add` accumulates.
      const ov = {};
      const running = [];
      for (let i = activeRef.current.length - 1; i >= 0; i--) {
        const ev = activeRef.current[i];
        const u = (time - ev.t0) / ev.def.dur;
        if (u >= 1) {
          activeRef.current.splice(i, 1);
          continue;
        }
        if (u < 0) continue;
        const env = chaosEnv(u, ev.def.chaos, ev.seed);
        running.push({ id: ev.def.id, label: ev.def.label, u });
        for (const tr of ev.def.tracks) {
          const raw = sampleKeys(tr.keys, u);
          const v = tr.param === "amt" ? raw * env : raw;
          const slot = (ov[tr.fx] ||= {});
          if (tr.mode === "max") slot[tr.param] = Math.max(slot[tr.param] ?? 0, v);
          else if (tr.mode === "add") slot[tr.param] = (slot[tr.param] ?? 0) + v;
          else slot[tr.param] = v;
        }
      }
      liveT += dt;
      if (liveT > 0.05) {
        liveT = 0;
        callbacks.current.onLive?.(running);
      }

      /* ---- render ----------------------------------------------------- */
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, rtA.fb);
      let u = bind(srcProg);
      gl.uniform2f(u("uRes"), W, H);
      gl.uniform1f(u("uTime"), time);
      gl.uniform1i(u("uMode"), srcRef.current);
      gl.uniform1f(u("uSeed"), seedRef.current ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      let src = rtA,
        dst = rtB;

      for (const e of EFFECTS) {
        const b = base[e.id];
        const o = ov[e.id];
        const restAmt = b.on ? b.amt : 0;
        const amt = o?.amt !== undefined ? Math.max(restAmt, o.amt) : restAmt;
        if (amt <= 0.001) continue;

        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        u = bind(progs[e.id]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(u("uTex"), 0);
        if (e.id === "feedback") {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, feed0.tex);
          gl.uniform1i(u("uPrev"), 1);
        }
        gl.uniform2f(u("uRes"), W, H);
        gl.uniform1f(u("uTime"), time);
        gl.uniform1f(u("uAmt"), amt);
        gl.uniform1f(u("uBurst"), 0);
        for (const [k, lo, hi] of e.params) {
          let v = b[k];
          if (o && o[k] !== undefined) v = o[k];
          gl.uniform1f(u(`u_${k}`), Math.min(hi, Math.max(lo, v)));
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (e.id === "feedback") {
          gl.bindFramebuffer(gl.FRAMEBUFFER, feed1.fb);
          const cu = bind(copyProg);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dst.tex);
          gl.uniform1i(cu("uTex"), 0);
          gl.uniform2f(cu("uRes"), W, H);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          const t = feed0;
          feed0 = feed1;
          feed1 = t;
        }
        const t = src;
        src = dst;
        dst = t;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      u = bind(copyProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(u("uTex"), 0);
      gl.uniform2f(u("uRes"), W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      fAcc += 1 / Math.max(dt, 1e-4);
      fN++;
      fT += dt;
      if (fT > 0.5) {
        callbacks.current.onFps?.(Math.round(fAcc / fN));
        fAcc = 0;
        fN = 0;
        fT = 0;
      }
    };
    raf = requestAnimationFrame(frame);
    invalidate.current = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    return () => {
      invalidate.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    };
    // Refs only, all stable: the loop is armed once per mount.
  }, [
    hostRef,
    cfgRef,
    srcRef,
    activeRef,
    queueRef,
    autoRef,
    rateRef,
    audioRef,
    stillRef,
    seedRef,
    maxFps,
    maxDpr,
  ]);

  return useCallback(() => invalidate.current(), []);
}
