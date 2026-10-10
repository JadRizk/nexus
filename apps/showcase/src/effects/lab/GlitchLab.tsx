import { useRef, useState } from "react";
import { configFor } from "../glitch/core/config.js";
import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import type { EffectId } from "../glitch/data/effects/index.js";
import { withKnob } from "../glitch/lab/knobs.js";
import { useGlitchEngine } from "../glitch/useGlitchEngine.js";
import { AudioPanel } from "./AudioPanel.js";
import { EventsPanel } from "./EventsPanel.js";
import { Inspector } from "./Inspector.js";
import { ShaderFault } from "./ShaderFault.js";
import { SourcePanel } from "./SourcePanel.js";
import { StackPanel } from "./StackPanel.js";
import { useEventBus } from "./useEventBus.js";
import { useLabAudio } from "./useLabAudio.js";
import { useLabHotkeys } from "./useLabHotkeys.js";
import { useLabSelection } from "./useLabSelection.js";
import { useLatestRef } from "./useLatestRef.js";

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

   The engine and the synthesiser live in ../glitch, shared with Home's hero.
   Only the WebGL host, the trigger cards and the envelope chart have no
   @nexus-cyberdeck/react equivalent; they are styled from tokens.
   ========================================================================== */

const TRIGGER_STYLES = `
        .nxgl-trigger { position: relative; overflow: hidden; text-align: left; cursor: pointer;
          border: var(--nx-hairline) solid var(--nx-border-default); background: rgba(12,16,12,.6);
          color: var(--nx-fg-default); font-family: var(--nx-font-mono); font-size: var(--nx-text-2xs);
          font-weight: var(--nx-weight-medium); letter-spacing: var(--nx-track-wide); text-transform: uppercase;
          padding: var(--nx-space-3) var(--nx-space-3); transition: all var(--nx-dur-micro); }
        .nxgl-trigger:hover { border-color: var(--nx-border-accent); background: var(--nx-bg-hover); }
        .nxgl-trigger:active { background: var(--nx-fg-accent); color: var(--nx-bg-canvas); }
      `;

export default function GlitchLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(0);
  const [fps, setFps] = useState(0);
  const [live, setLive] = useState<RunningEvent[]>([]);
  const [isAutoFire, setAutoFire] = useState(false);
  const [rate, setRate] = useState(0.35);
  const [config, setConfig] = useState(() => configFor("VHS 1987"));
  const cfgRef = useLatestRef(config);
  const srcRef = useLatestRef(source);
  const autoRef = useLatestRef(isAutoFire);
  const rateRef = useLatestRef(rate);

  const audio = useLabAudio();
  const { activeRef, queueRef, fire, fireRandom, fireChain } = useEventBus(audio.audioRef);
  const selection = useLabSelection();
  const fireAndShow = (id: string) => {
    fire(id);
    selection.showEvent(id);
  };
  useLabHotkeys({ fireAndShow, fireRandom });

  useGlitchEngine(
    hostRef,
    { cfgRef, srcRef, activeRef, queueRef, autoRef, rateRef, audioRef: audio.audioRef },
    { onError: setError, onLive: setLive, onFps: setFps },
  );

  const setKnob = (id: EffectId, knob: string, value: number) =>
    setConfig((previous) => withKnob(previous, id, knob, value));

  if (error) return <ShaderFault message={error} />;

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
      <style>{TRIGGER_STYLES}</style>

      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

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
        <SourcePanel
          fps={fps}
          source={source}
          onSource={setSource}
          onPreset={(preset) => setConfig(configFor(preset))}
        />
        <EventsPanel
          live={live}
          onFireEvent={fireAndShow}
          onFireChain={fireChain}
          onFireRandom={fireRandom}
          isAutoFire={isAutoFire}
          onToggleAutoFire={() => setAutoFire((isOn) => !isOn)}
          rate={rate}
          onRate={setRate}
        />
        <AudioPanel
          isSoundOn={audio.isSoundOn}
          onToggleSound={audio.toggleSound}
          volume={audio.volume}
          onVolume={audio.setVolume}
          isBedOn={audio.isBedOn}
          onToggleBed={audio.toggleBed}
        />
        <StackPanel
          config={config}
          live={live}
          openEffect={selection.openEffect}
          onOpen={selection.showEffect}
          onKnob={setKnob}
        />
      </div>

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
        <Inspector
          tab={selection.tab}
          onTab={selection.setTab}
          openEvent={selection.openEvent}
          openEffect={selection.openEffect}
          config={config}
          live={live}
          onFire={fire}
          onKnob={setKnob}
        />
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
