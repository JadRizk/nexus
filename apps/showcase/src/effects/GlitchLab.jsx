import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Button,
  TabStrip,
  Slider,
  ToggleRow,
  SectionHeading,
  HazardRule,
  Wordmark,
} from "@nexus-cyberdeck/react";
import {
  CHAINS,
  configFor,
  EFFECTS,
  EV_BY_ID,
  EVENTS,
  PRESETS,
  sampleKeys,
  useGlitchEngine,
} from "./glitchEngine.js";
import { createAudio } from "./glitchAudio.js";

// Re-exported for the unit tests, which predate the split.
export { chaosEnv, hashf, sampleKeys } from "./glitchEngine.js";

/* ============================================================================
   GLITCH LAB
   A post-processing playground for the Nexus system. Raw WebGL — no three.js,
   because the whole point is to see the shaders.

   The pipeline is ordered as a real signal path, not by convenience:

     SOURCE → TAPE → COMPOSITE SIGNAL → DIGITAL → DISPLAY → GLASS

   Stacking these in the wrong order is most of why glitch effects read as
   fake. Chroma bleed applied *after* scanlines is a filter; applied before,
   it is an artifact.

   Two layers:
     RESTING STACK — what is always on. The look.
     EVENT BUS     — transient keyframed faults that override the resting
                     stack for a few hundred milliseconds, then hand it back.

   Ported from effects/GlitchLab.jsx verbatim below the CHROME marker — the
   shaders, physics of the event bus and the audio synth are untouched. Only
   the surrounding UI changed, from a second hand-rolled copy of the design
   system (its own `C` palette and `gl-*` CSS classes) to the real
   @nexus-cyberdeck/react components and @nexus-cyberdeck/tokens custom properties, so this page
   can't drift from the rest of the system the way the original standalone
   file would have.
   ========================================================================== */

/* The shaders, events, presets and render loop live in glitchEngine.js, and
   the synthesiser in glitchAudio.js — both shared with Home's hero. */

/* ================================================================ CHROME
   Everything from here down used to be a second hand-rolled copy of the
   design system: its own hex palette (`const C = {...}`) and its own
   gl-s/gl-b/gl-e/gl-p/gl-r/gl-col/gl-t CSS classes, standing in for
   Slider/Button/Panel/ToggleRow/Panel-column/TabStrip. None of that is
   needed here — this page renders inside the same NexusProvider tree as
   the rest of the showcase (see App.tsx), so it already inherits nx-root's
   base layer (font, colour, focus ring, scrollbars, reduced-motion) for
   free, and the real components already exist. Only the WebGL host div,
   the event-trigger cards and the keyframe chart below have no equivalent
   in @nexus-cyberdeck/react and stay bespoke — styled from tokens, not hex.
   ================================================================== */

const SOURCES = ["GRAPH", "BARS", "HUD"];
const GROUPS = ["TAPE", "SIGNAL", "DIGITAL", "DISPLAY", "GLASS"];
const TRACK_COL = [
  "var(--nx-fg-accent)",
  "var(--nx-fg-info)",
  "var(--nx-fg-warning)",
  "var(--nx-fg-critical)",
  "var(--nx-fg-cat-violet)",
  "var(--nx-fg-cat-lime)",
  "var(--nx-fg-default)",
  "#3AC6D4",
];
const fmt = (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(3));

export default function GlitchLab() {
  const hostRef = useRef(null);
  const [err, setErr] = useState(null);
  const [source, setSource] = useState(0);
  const [fps, setFps] = useState(0);
  const [tab, setTab] = useState("events");
  const [openFx, setOpenFx] = useState("chroma");
  const [openEv, setOpenEv] = useState("signal");
  const [live, setLive] = useState([]);
  const [autoFire, setAutoFire] = useState(false);
  const [sound, setSound] = useState(false);
  const [vol, setVol] = useState(0.5);
  const [bed, setBedOn] = useState(false);
  const audioRef = useRef(null);
  const [rate, setRate] = useState(0.35);

  const makeBase = configFor;
  const [cfg, setCfg] = useState(() => makeBase("VHS 1987"));
  // The render loop reads these asynchronously via requestAnimationFrame, so
  // they only ever need to be current as of the last commit. Assigning during
  // render instead would leave them holding values from a render React threw
  // away, which is exactly the case concurrent rendering makes reachable.
  const cfgRef = useRef(cfg);
  const srcRef = useRef(source);
  const autoRef = useRef(autoFire);
  const rateRef = useRef(rate);
  useEffect(() => {
    cfgRef.current = cfg;
    srcRef.current = source;
    autoRef.current = autoFire;
    rateRef.current = rate;
  });
  const activeRef = useRef([]);
  const queueRef = useRef([]);

  const set = (id, key, v) => setCfg((p) => ({ ...p, [id]: { ...p[id], [key]: v } }));

  const fire = useCallback((id) => {
    const def = EV_BY_ID[id];
    if (!def) return;
    activeRef.current.push({ def, t0: performance.now() / 1000, seed: Math.random() * 1000 });
    audioRef.current?.fire(id);
  }, []);

  const fireChain = useCallback((chain) => {
    const now = performance.now() / 1000;
    for (const [d, id] of chain.steps) queueRef.current.push({ at: now + d, id });
  }, []);

  // Audio only ever starts from a user gesture: browsers require it, and
  // autoplaying sound is hostile regardless of policy.
  const enableSound = useCallback(() => {
    if (!audioRef.current) {
      const a = createAudio();
      if (!a) return;
      audioRef.current = a;
    }
    audioRef.current.resume();
    audioRef.current.setVolume(vol);
    setSound(true);
  }, [vol]);

  useEffect(() => {
    audioRef.current?.setVolume(sound ? vol : 0);
  }, [vol, sound]);
  useEffect(() => {
    audioRef.current?.setBed(sound && bed);
  }, [bed, sound]);
  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const ev = EVENTS.find((x) => x.key === e.key);
      if (ev) {
        e.preventDefault();
        fire(ev.id);
        setOpenEv(ev.id);
        setTab("events");
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        fire(EVENTS[(Math.random() * EVENTS.length) | 0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  useGlitchEngine(
    hostRef,
    { cfgRef, srcRef, activeRef, queueRef, autoRef, rateRef, audioRef },
    { onError: setErr, onLive: setLive, onFps: setFps },
  );

  const selFx = EFFECTS.find((e) => e.id === openFx);
  const selEv = EV_BY_ID[openEv];
  const activeCount = EFFECTS.filter((e) => cfg[e.id]?.on).length;

  if (err) {
    return (
      <div
        style={{
          background: "var(--nx-bg-canvas)",
          color: "var(--nx-fg-critical)",
          height: "100%",
          padding: "var(--nx-space-8)",
          fontFamily: "var(--nx-font-mono)",
          fontSize: "var(--nx-text-sm)",
          lineHeight: 1.8,
        }}
      >
        <div style={{ letterSpacing: "var(--nx-track-wider)", marginBottom: "var(--nx-space-4)" }}>
          ▚ SHADER FAULT
        </div>
        <div style={{ color: "var(--nx-fg-subtle)" }}>{err}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--nx-bg-canvas)",
        overflow: "hidden",
        fontFamily: "var(--nx-font-mono)",
        fontSize: "var(--nx-text-xs)",
        color: "var(--nx-fg-subtle)",
      }}
    >
      <style>{`
        .nxgl-trigger { position: relative; overflow: hidden; text-align: left; cursor: pointer;
          border: var(--nx-hairline) solid var(--nx-border-default); background: rgba(12,16,12,.6);
          color: var(--nx-fg-default); font-family: var(--nx-font-mono); font-size: var(--nx-text-2xs);
          font-weight: var(--nx-weight-medium); letter-spacing: var(--nx-track-wide); text-transform: uppercase;
          padding: var(--nx-space-3) var(--nx-space-3); transition: all var(--nx-dur-micro); }
        .nxgl-trigger:hover { border-color: var(--nx-border-accent); background: var(--nx-bg-hover); }
        .nxgl-trigger:active { background: var(--nx-fg-accent); color: var(--nx-bg-canvas); }
      `}</style>

      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {/* ------------------------------------------------------ left column */}
      <div
        style={{
          position: "absolute",
          top: "var(--nx-space-5)",
          bottom: "var(--nx-space-5)",
          left: "var(--nx-space-5)",
          width: 226,
          overflowY: "auto",
          scrollbarWidth: "thin",
          display: "flex",
          flexDirection: "column",
          gap: "var(--nx-space-4)",
        }}
      >
        <Panel style={{ flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "var(--nx-space-4)",
            }}
          >
            <Wordmark size="var(--nx-text-lg)">GLITCH LAB</Wordmark>
            <span
              style={{
                fontFamily: "var(--nx-font-stencil)",
                fontSize: "var(--nx-text-xl)",
                lineHeight: 0.8,
                color:
                  fps > 50
                    ? "var(--nx-fg-accent)"
                    : fps > 28
                      ? "var(--nx-fg-warning)"
                      : "var(--nx-fg-critical)",
              }}
            >
              {fps}
            </span>
          </div>
          <HazardRule style={{ marginBottom: "var(--nx-space-4)" }} />
          <div style={{ display: "flex", gap: "var(--nx-space-2)" }}>
            {SOURCES.map((s, i) => (
              <Button
                key={s}
                active={source === i}
                style={{ flex: 1 }}
                onClick={() => setSource(i)}
              >
                {s}
              </Button>
            ))}
          </div>
          <div
            style={{
              marginTop: "var(--nx-space-4)",
              color: "var(--nx-fg-tertiary)",
              letterSpacing: "var(--nx-track-wide)",
              fontSize: "var(--nx-text-2xs)",
            }}
          >
            RESTING STATE
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--nx-space-2)",
              marginTop: "var(--nx-space-2)",
            }}
          >
            {Object.keys(PRESETS).map((p) => (
              <Button
                key={p}
                style={{ fontSize: "var(--nx-text-2xs)" }}
                onClick={() => setCfg(makeBase(p))}
              >
                {p}
              </Button>
            ))}
          </div>
        </Panel>

        {/* ------------------------------------------------ event triggers */}
        <Panel style={{ flexShrink: 0 }}>
          <SectionHeading>/// EVENTS — TRANSIENT</SectionHeading>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)" }}
          >
            {EVENTS.map((e) => {
              const run = live.find((l) => l.id === e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className="nxgl-trigger"
                  onMouseDown={() => {
                    fire(e.id);
                    setOpenEv(e.id);
                    setTab("events");
                  }}
                >
                  {run && (
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "var(--nx-bg-active)",
                        transform: `scaleX(${1 - run.u})`,
                        transformOrigin: "left",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "var(--nx-space-2)",
                    }}
                  >
                    <span>{e.label}</span>
                    <span style={{ color: "var(--nx-fg-disabled)" }}>{e.key}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <SectionHeading style={{ margin: "var(--nx-space-5) 0 var(--nx-space-2)" }}>
            /// CHAINS — CASCADING
          </SectionHeading>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)" }}
          >
            {CHAINS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="nxgl-trigger"
                onMouseDown={() => fireChain(c)}
              >
                <span style={{ color: "var(--nx-fg-warning)" }}>{c.label}</span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--nx-space-2)",
              marginTop: "var(--nx-space-4)",
              alignItems: "center",
            }}
          >
            <Button active={autoFire} style={{ flex: 1 }} onClick={() => setAutoFire((v) => !v)}>
              Auto
            </Button>
            <Button
              style={{ flex: 1 }}
              onMouseDown={() => fire(EVENTS[(Math.random() * EVENTS.length) | 0].id)}
            >
              Random
            </Button>
          </div>
          {autoFire && (
            <div style={{ marginTop: "var(--nx-space-3)" }}>
              <Slider
                label="frequency"
                value={rate}
                min={0}
                max={1}
                step={0.01}
                onChange={setRate}
                format={(v) => v.toFixed(2)}
              />
            </div>
          )}

          <div
            style={{
              marginTop: "var(--nx-space-4)",
              paddingTop: "var(--nx-space-3)",
              borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-normal)",
              minHeight: 26,
            }}
          >
            {live.length === 0 ? (
              <span style={{ color: "var(--nx-fg-disabled)" }}>
                BUS IDLE · KEYS 1–8 · SPACE RANDOM
              </span>
            ) : (
              live.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "var(--nx-fg-accent)",
                  }}
                >
                  <span>▸ {l.label}</span>
                  <span style={{ color: "var(--nx-fg-tertiary)" }}>{Math.round(l.u * 100)}%</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* ------------------------------------------------ audio */}
        <Panel style={{ flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--nx-space-3)",
            }}
          >
            <SectionHeading style={{ marginBottom: 0 }}>/// AUDIO — SYNTHESISED</SectionHeading>
            <Button
              active={sound}
              onClick={() => (sound ? (setSound(false), setBedOn(false)) : enableSound())}
            >
              {sound ? "ON" : "ENABLE"}
            </Button>
          </div>
          {sound ? (
            <>
              <Slider
                label="volume"
                value={vol}
                min={0}
                max={1}
                step={0.01}
                onChange={setVol}
                format={(v) => v.toFixed(2)}
              />
              <div
                style={{
                  display: "flex",
                  gap: "var(--nx-space-2)",
                  marginTop: "var(--nx-space-1)",
                }}
              >
                <Button active={bed} style={{ flex: 1 }} onClick={() => setBedOn((v) => !v)}>
                  Room tone
                </Button>
              </div>
              <div
                style={{
                  marginTop: "var(--nx-space-3)",
                  color: "var(--nx-fg-subtle)",
                  fontSize: "var(--nx-text-2xs)",
                  lineHeight: 1.6,
                }}
              >
                Bed is tape hiss + 60Hz mains + flyback whine at 15.734kHz — the NTSC scan rate.
                Many adults cannot hear that last one at all.
              </div>
            </>
          ) : (
            <div
              style={{
                color: "var(--nx-fg-subtle)",
                fontSize: "var(--nx-text-2xs)",
                lineHeight: 1.65,
              }}
            >
              No files, no licences. Every voice is generated, so no two shots of an event are
              identical.
            </div>
          )}
        </Panel>

        {/* ------------------------------------------------ resting stack */}
        <Panel style={{ flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "var(--nx-space-3)",
            }}
          >
            <SectionHeading style={{ marginBottom: 0 }}>/// STACK</SectionHeading>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>
              {activeCount} ON
            </span>
          </div>
          {GROUPS.map((g) => (
            <div key={g} style={{ marginBottom: "var(--nx-space-3)" }}>
              <div
                style={{
                  color: "var(--nx-fg-disabled)",
                  fontSize: "var(--nx-text-2xs)",
                  letterSpacing: "var(--nx-track-wider)",
                  marginBottom: "var(--nx-space-1)",
                }}
              >
                {g}
              </div>
              {EFFECTS.filter((e) => e.group === g).map((e) => {
                const hot = live.some((l) => EV_BY_ID[l.id].tracks.some((t) => t.fx === e.id));
                return (
                  <div
                    key={e.id}
                    onClick={() => {
                      setOpenFx(e.id);
                      setTab("fx");
                    }}
                    style={{
                      cursor: "pointer",
                      borderLeft: `2px solid ${openFx === e.id ? "var(--nx-fg-accent)" : "transparent"}`,
                    }}
                  >
                    <ToggleRow
                      checked={!!cfg[e.id].on}
                      onChange={(v) => set(e.id, "on", v ? 1 : 0)}
                      label={
                        <span style={{ color: hot ? "var(--nx-fg-critical)" : undefined }}>
                          {e.label}
                          {hot ? " ●" : ""}
                        </span>
                      }
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </Panel>
      </div>

      {/* ----------------------------------------------------- right column */}
      <div
        style={{
          position: "absolute",
          top: "var(--nx-space-5)",
          bottom: "var(--nx-space-5)",
          right: "var(--nx-space-5)",
          width: 282,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}
      >
        <Panel padded={false}>
          <div style={{ padding: "var(--nx-space-3) var(--nx-space-3) 0" }}>
            <TabStrip
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "events", label: "Event" },
                { value: "fx", label: "Effect" },
              ]}
            />
          </div>

          {tab === "events" && selEv && (
            <div style={{ padding: "var(--nx-space-5)" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span
                  style={{
                    color: "var(--nx-fg-accent)",
                    fontWeight: 700,
                    letterSpacing: "var(--nx-track-wide)",
                    fontSize: "var(--nx-text-sm)",
                  }}
                >
                  {selEv.label}
                </span>
                <Button onMouseDown={() => fire(selEv.id)}>Fire</Button>
              </div>
              <div
                style={{
                  color: "var(--nx-fg-tertiary)",
                  fontSize: "var(--nx-text-2xs)",
                  letterSpacing: "var(--nx-track-wider)",
                  margin: "var(--nx-space-3) 0 var(--nx-space-4)",
                }}
              >
                {(selEv.dur * 1000) | 0}MS · CHAOS {selEv.chaos.toFixed(2)} · {selEv.tracks.length}{" "}
                TRACKS
              </div>
              <p
                style={{
                  margin: "0 0 var(--nx-space-5)",
                  color: "var(--nx-fg-subtle)",
                  lineHeight: 1.75,
                  fontSize: "var(--nx-text-sm)",
                }}
              >
                {selEv.cause}
              </p>

              <SectionHeading>/// ENVELOPES</SectionHeading>
              <TrackViz ev={selEv} live={live.find((l) => l.id === selEv.id)} />

              <div style={{ marginTop: "var(--nx-space-4)" }}>
                {selEv.tracks.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "var(--nx-fg-subtle)",
                      fontSize: "var(--nx-text-2xs)",
                      padding: "1px 0",
                    }}
                  >
                    <span style={{ color: TRACK_COL[i % TRACK_COL.length] }}>
                      {t.fx}.{t.param}
                    </span>
                    <span style={{ color: "var(--nx-fg-disabled)" }}>
                      {t.mode}
                      {t.keys.some((k) => k[2] === "step") ? " · step" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "var(--nx-space-5)",
                  paddingTop: "var(--nx-space-4)",
                  borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
                }}
              >
                <SectionHeading>/// INTEGRATION</SectionHeading>
                <pre
                  style={{
                    margin: 0,
                    padding: "var(--nx-space-4) var(--nx-space-5)",
                    background: "rgba(0,0,0,.35)",
                    border: "var(--nx-hairline) solid var(--nx-border-default)",
                    color: "var(--nx-fg-muted)",
                    fontFamily: "var(--nx-font-mono)",
                    fontSize: "var(--nx-text-2xs)",
                    lineHeight: 1.7,
                    overflowX: "auto",
                  }}
                >
                  <code>{`// on route change
glitch.fire("boot");

// on failed request
glitch.fire("${selEv.id}");

// on cascading failure
glitch.chain([[0,"dropout"],
  [0.12,"corrupt"],[0.34,"signal"]]);`}</code>
                </pre>
              </div>
            </div>
          )}

          {tab === "fx" && selFx && (
            <div style={{ padding: "var(--nx-space-5)" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span
                  style={{
                    color: "var(--nx-fg-accent)",
                    fontWeight: 700,
                    letterSpacing: "var(--nx-track-wide)",
                    fontSize: "var(--nx-text-sm)",
                  }}
                >
                  {selFx.label}
                </span>
                <Button
                  active={!!cfg[selFx.id].on}
                  onClick={() => set(selFx.id, "on", cfg[selFx.id].on ? 0 : 1)}
                >
                  {cfg[selFx.id].on ? "ON" : "OFF"}
                </Button>
              </div>
              <div
                style={{
                  color: "var(--nx-fg-tertiary)",
                  fontSize: "var(--nx-text-2xs)",
                  letterSpacing: "var(--nx-track-wider)",
                  margin: "var(--nx-space-3) 0 var(--nx-space-4)",
                }}
              >
                {selFx.group} STAGE
              </div>
              <p
                style={{
                  margin: "0 0 var(--nx-space-5)",
                  color: "var(--nx-fg-subtle)",
                  lineHeight: 1.75,
                  fontSize: "var(--nx-text-sm)",
                }}
              >
                {selFx.note}
              </p>
              <div
                style={{
                  height: "var(--nx-hairline)",
                  background: "var(--nx-border-default)",
                  marginBottom: "var(--nx-space-4)",
                }}
              />
              <Slider
                label="mix"
                value={cfg[selFx.id].amt}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set(selFx.id, "amt", v)}
                format={fmt}
              />
              {selFx.params.map(([k, lo, hi]) => (
                <Slider
                  key={k}
                  label={k}
                  value={cfg[selFx.id][k]}
                  min={lo}
                  max={hi}
                  step={(hi - lo) / 200}
                  onChange={(v) => set(selFx.id, k, v)}
                  format={fmt}
                />
              ))}
              <div
                style={{
                  marginTop: "var(--nx-space-3)",
                  color: "var(--nx-fg-disabled)",
                  fontSize: "var(--nx-text-2xs)",
                  lineHeight: 1.6,
                }}
              >
                Events override these while running, then hand control back.
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "var(--nx-space-4)",
          left: "50%",
          transform: "translateX(-50%)",
          color: "var(--nx-fg-disabled)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        events override the resting stack, then hand it back · 1–8 · space
      </div>
    </div>
  );
}

/** Draws each track's keyframe curve, with a playhead when the event is live. */
function TrackViz({ ev, live }) {
  const W = 254,
    H = 72,
    N = 90;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{
        display: "block",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        background: "rgba(0,0,0,.35)",
      }}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={g * W}
          y1={0}
          x2={g * W}
          y2={H}
          stroke="var(--nx-border-default)"
          strokeWidth="1"
        />
      ))}
      {ev.tracks.map((t, ti) => {
        let d = "";
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const v = sampleKeys(t.keys, u);
          // normalise each track against its own range so shape is comparable
          const lo = Math.min(...t.keys.map((k) => k[1]));
          const hi = Math.max(...t.keys.map((k) => k[1]));
          const n = hi === lo ? 0.5 : (v - lo) / (hi - lo);
          d += `${i ? "L" : "M"}${(u * W).toFixed(1)},${(H - 4 - n * (H - 9)).toFixed(1)}`;
        }
        return (
          <path
            key={ti}
            d={d}
            fill="none"
            stroke={TRACK_COL[ti % TRACK_COL.length]}
            strokeWidth="1.2"
            opacity="0.85"
          />
        );
      })}
      {live && (
        <>
          <line
            x1={live.u * W}
            y1={0}
            x2={live.u * W}
            y2={H}
            stroke="var(--nx-fg-default)"
            strokeWidth="1.4"
          />
          <rect
            x={0}
            y={0}
            width={live.u * W}
            height={H}
            fill="var(--nx-fg-accent)"
            opacity="0.07"
          />
        </>
      )}
    </svg>
  );
}
