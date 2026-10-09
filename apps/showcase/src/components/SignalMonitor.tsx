import { useEffect, useRef, useState } from "react";
import type { FocusEvent, PointerEvent } from "react";
import { Button, Panel } from "@nexus-cyberdeck/react";
import { configFor } from "../effects/glitch/core/config.js";
import type { Config } from "../effects/glitch/core/config.js";
import type { QueuedEvent } from "../effects/glitch/core/bus.js";
import { fireEvent, shuffleSeed } from "../effects/glitch/core/events.js";
import type { ActiveEvent } from "../effects/glitch/core/events.js";
import type { EventId } from "../effects/glitch/data/events/index.js";
import { useGlitchEngine } from "../effects/glitch/useGlitchEngine.js";
import { createAudio } from "../effects/glitchAudio.js";

/* ============================================================================
   showcase — SignalMonitor
   Home's hero: a small CRT running Glitch Lab's own signal path and
   synthesiser (effects/glitch/, effects/glitchAudio.js). The pointer
   tunes it — across for colour bleed, down for tracking. Each visit lands on
   a channel chosen at random (the graph, with a new layout every time; the
   test bars; or the HUD). Jolt fires one of Glitch Lab's faults.
   With Sound on, faults are voiced, and the room — tape hiss, mains hum, the
   flyback whine — comes up while the pointer or focus is on the monitor.

   Held to the system's own flash rule (WCAG 2.3.1): nothing fires by itself,
   one fault runs at a time, and the faults offered are the ones that move
   the picture rather than flash it. Under reduced motion the screen is a
   still frame that redraws only when it is tuned or changed, and the faults
   and the sound are withdrawn with their controls.

   Sound needs the page to have had a press first — browsers allow audio only
   after one — so a hover before any press is silent.
   ========================================================================== */

type Audio = NonNullable<ReturnType<typeof createAudio>>;

const CHANNELS = ["GRAPH", "BARS", "HUD"] as const;

// Faults that displace, ghost or shift colour. Dropout, signal loss, data
// corruption, head crash and cold boot all flash or blank the picture.
const SAFE_FAULTS = ["scrub", "interference", "degauss"] as const satisfies readonly EventId[];

const VOLUME = 0.45;
// The room: Glitch Lab's bed with the 15.7 kHz whine kept low, faded so it
// can follow a hover without clicking.
const ROOM = { hiss: 0.4, hum: 0.35, whine: 0.12, fade: 0.25 };

/**
 * The monitor's resting signal: Glitch Lab's BROADCAST preset, with three
 * changes for a screen that sits in a square frame on a page.
 *
 * - More bend, overscanned. The barrel curve is what reads as a television;
 *   overscan scales the bent picture out until its corners meet the frame,
 *   so lines still bow but no black shows past the glass. Degauss's bulge
 *   overscans with it.
 * - Full mix. At BROADCAST's 0.85, 15% of the flat picture showed through
 *   wherever the bent one did not reach.
 * - No hologram flicker. Degauss fades that layer in, and its shader
 *   otherwise dims at random on a 20 Hz clock; at zero, nothing on this
 *   screen steps in brightness.
 *
 * Glitch Lab keeps the preset as it is.
 */
function rest(): Config {
  const cfg = configFor("BROADCAST");
  Object.assign(cfg.crt, { amt: 1, curve: 0.9, overscan: 1 });
  cfg.holo.flicker = 0;
  return cfg;
}

/** Pointer position, 0–1 on each axis, to the knobs it turns. */
function tune(x: number, y: number): Config {
  const cfg = rest();
  Object.assign(cfg.chroma, { on: 1, amt: 0.5 + x * 0.5, width: 4 + x * 20, lag: -2 + x * 12 });
  Object.assign(cfg.tracking, { on: 1, amt: y, shift: y * 0.12, height: 0.06 + y * 0.18 });
  return cfg;
}

/** Whether the page has had the press browsers require before audio may start. */
const mayPlay = () =>
  (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    ?.hasBeenActive ?? true;

export function SignalMonitor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const cfgRef = useRef<Config>(rest());
  const srcRef = useRef(0);
  const seedRef = useRef(0);
  const activeRef = useRef<ActiveEvent[]>([]);
  const queueRef = useRef<QueuedEvent[]>([]);
  const stillRef = useRef(false);
  const audioRef = useRef<Audio | null>(null);

  // Every visit lands on a channel chosen at random, and a graph dealt fresh:
  // chosen once, when the monitor mounts.
  const [{ channel, seed }] = useState(() => {
    const fresh = { current: 0 };
    shuffleSeed(fresh);
    return { channel: Math.floor(Math.random() * CHANNELS.length), seed: fresh.current };
  });
  const [still, setStill] = useState(false);
  const [sound, setSound] = useState(true);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  // Every fault run so far: how many, and the last. Kept on the root as data
  // attributes, with the running one and the room, because none of it is
  // text on the page and a test cannot reliably catch a 0.7 s picture.
  const [ran, setRan] = useState<{ count: number; last: string }>({ count: 0, last: "" });
  const [room, setRoom] = useState(false);
  // The running fault, as a ref: two presses that land before a re-render
  // must still see the first one, or both would start.
  const running = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const nextFault = useRef(0);
  const timers = useRef<number[]>([]);

  const invalidate = useGlitchEngine(
    hostRef,
    { cfgRef, srcRef, seedRef, activeRef, queueRef, stillRef },
    // A 560px screen: 30 fps at 1× is plenty, and a fraction of the cost.
    { onError: setErr, maxFps: 30, maxDpr: 1 },
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      stillRef.current = mq.matches;
      setStill(mq.matches);
      invalidate();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [invalidate]);

  // The engine reads the choice from these refs; set before its first frame.
  useEffect(() => {
    srcRef.current = channel;
    seedRef.current = seed;
    invalidate();
  }, [channel, seed, invalidate]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      audioRef.current?.dispose();
    },
    [],
  );

  const audible = sound && !still && !err;

  // The room follows the pointer and focus; it is never on without one of
  // them on the monitor, and Sound off silences it. It is checked again after
  // every fault too: when the page's first press is a channel or Jolt while
  // the pointer is already over the monitor, that press is what allows audio,
  // and the room should come up then rather than on the next hover.
  const wantRoom = audible && (hover || focused);
  const roomOn = useRef(false);
  useEffect(() => {
    if (wantRoom && !roomOn.current) {
      const a = openAudio(audioRef, VOLUME);
      if (!a) return;
      a.setBed(true, ROOM);
      roomOn.current = true;
      setRoom(true);
    } else if (!wantRoom && roomOn.current) {
      audioRef.current?.setBed(false, ROOM);
      roomOn.current = false;
      setRoom(false);
    }
  }, [wantRoom, ran.count]);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Runs one fault, picture and sound, unless one is already running. */
  const runFault = (id: EventId): { dur: number } | null => {
    if (running.current || still || err) return null;
    running.current = true;
    const def = fireEvent(activeRef, id);
    if (audible) openAudio(audioRef, VOLUME)?.fire(id);
    setFault(def.label);
    setRan((r) => ({ count: r.count + 1, last: def.label }));
    later(def.dur * 1000, () => {
      running.current = false;
      setFault(null);
    });
    return def;
  };

  // The rotation advances only when a fault actually runs, so a press that is
  // ignored mid-fault does not skip one.
  const jolt = () => {
    if (runFault(SAFE_FAULTS[nextFault.current % SAFE_FAULTS.length])) nextFault.current++;
  };

  const toggleSound = () => {
    audioRef.current?.setVolume(sound ? 0 : VOLUME);
    setSound(!sound);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    cfgRef.current = tune(x, y);
    invalidate();
  };

  const onLeaveScreen = () => {
    cfgRef.current = rest();
    invalidate();
  };

  // Focus moving between the monitor's own buttons is not leaving it.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <div
      className="sc-monitor"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      data-fault={fault ?? ""}
      data-faults={ran.count}
      data-last-fault={ran.last}
      data-room={room ? "on" : "off"}
      data-channel={channel + 1}
      data-seed={seed}
    >
      <Panel corners={["tl", "tr", "bl", "br"]} padded={false} raised>
        <div
          className="sc-monitor__screen"
          onPointerMove={onMove}
          onPointerLeave={onLeaveScreen}
          role="img"
          aria-label={`A live signal through Glitch Lab's shader pipeline, on channel ${channel + 1}, ${CHANNELS[channel]}`}
        >
          <div ref={hostRef} className="sc-monitor__host" />
          {err && (
            <div className="sc-monitor__fault">
              NO SIGNAL
              <span>WebGL is unavailable here, so the screen cannot run.</span>
            </div>
          )}
        </div>
        {/* Under reduced motion there is nothing to press, so no bar at all.
            Never disabled while a fault runs: disabling the focused button
            would drop a keyboard user's focus to the page; a press during a
            fault is ignored instead. */}
        {!still && !err && (
          <div className="sc-monitor__bar">
            <div className="sc-monitor__channels">
              <Button active={sound} onClick={toggleSound}>
                Sound
              </Button>
              <Button onClick={jolt}>Jolt</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/**
 * The monitor's audio graph, created on first use at `volume` and resumed on
 * every use; null until the page has had a press, when browsers would refuse
 * it anyway. Module-level so effects can call it without depending on it.
 */
function openAudio(ref: { current: Audio | null }, volume: number): Audio | null {
  if (!ref.current) {
    if (!mayPlay()) return null;
    ref.current = createAudio();
    ref.current?.setVolume(volume);
  }
  void ref.current?.resume();
  return ref.current;
}
