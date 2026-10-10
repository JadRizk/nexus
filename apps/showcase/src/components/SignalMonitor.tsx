import { useEffect, useRef, useState } from "react";
import type { FocusEvent, PointerEvent } from "react";
import { Button, Panel } from "@nexus-cyberdeck/react";
import { restingConfig, tuneFromPointer } from "./signalMonitor/tune.js";
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

/** A ref the hooks below write as well as read, typed so React 18 accepts it. */
interface Box<T> {
  current: T;
}

/** Whether the page has had the press browsers require before audio may start. */
const mayPlay = () =>
  (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    ?.hasBeenActive ?? true;

export function SignalMonitor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const cfgRef = useRef<Config>(restingConfig());
  const srcRef = useRef(0);
  const seedRef = useRef(0);
  const activeRef = useRef<ActiveEvent[]>([]);
  const queueRef = useRef<QueuedEvent[]>([]);
  const stillRef = useRef(false);

  // Every visit lands on a channel chosen at random, and a graph dealt fresh:
  // chosen once, when the monitor mounts.
  const [{ channel, seed }] = useState(() => {
    const fresh = { current: 0 };
    shuffleSeed(fresh);
    return { channel: Math.floor(Math.random() * CHANNELS.length), seed: fresh.current };
  });
  const [err, setErr] = useState<string | null>(null);

  const invalidate = useGlitchEngine(
    hostRef,
    { cfgRef, srcRef, seedRef, activeRef, queueRef, stillRef },
    // A 560px screen: 30 fps at 1× is plenty, and a fraction of the cost.
    { onError: setErr, maxFps: 30, maxDpr: 1 },
  );

  const isStill = useReducedMotion(stillRef, invalidate);

  // The engine reads the choice from these refs; set before its first frame.
  useEffect(() => {
    srcRef.current = channel;
    seedRef.current = seed;
    invalidate();
  }, [channel, seed, invalidate]);

  const { audioRef, isSoundOn, toggleSound } = useMonitorAudio();
  const canRunFaults = !isStill && !err;
  const isAudible = isSoundOn && canRunFaults;
  const { fault, ran, jolt } = useFaultRunner({ activeRef, audioRef, canRunFaults, isAudible });
  const { isPresent, presenceHandlers } = usePresence();
  const isRoomOn = useMonitorRoom({
    audioRef,
    shouldPlay: isAudible && isPresent,
    faultCount: ran.count,
  });

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    cfgRef.current = tuneFromPointer(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
    invalidate();
  };

  const handleLeaveScreen = () => {
    cfgRef.current = restingConfig();
    invalidate();
  };

  return (
    <div
      className="sc-monitor"
      {...presenceHandlers}
      data-fault={fault ?? ""}
      data-faults={ran.count}
      data-last-fault={ran.last}
      data-room={isRoomOn ? "on" : "off"}
      data-channel={channel + 1}
      data-seed={seed}
    >
      <Panel corners={["tl", "tr", "bl", "br"]} padded={false} raised>
        <div
          className="sc-monitor__screen"
          onPointerMove={handleMove}
          onPointerLeave={handleLeaveScreen}
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
        {canRunFaults && (
          <div className="sc-monitor__bar">
            <div className="sc-monitor__channels">
              {/* An icon, named for screen readers; aria-pressed (from
                  `active`) says whether it is on, and the icon says it too:
                  waves when on, a cross when muted. */}
              <Button
                active={isSoundOn}
                onClick={toggleSound}
                className="sc-monitor__sound"
                aria-label="Sound"
                title="Sound"
              >
                <SpeakerIcon isOn={isSoundOn} />
              </Button>
              <Button onClick={jolt}>Jolt</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** A speaker: sounding when on, crossed out when muted. Drawn in the button's colour. */
function SpeakerIcon({ isOn }: { isOn: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
    >
      <path d="M2 6h3l4-3.5v11L5 10H2z" fill="currentColor" stroke="none" />
      {isOn ? (
        <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.4 6.4 0 0 1 0 9" />
      ) : (
        <path d="M11 6l4 4M15 6l-4 4" />
      )}
    </svg>
  );
}

/**
 * Whether the viewer asks for reduced motion, followed live. Mirrored into
 * `stillRef`, which the engine's frame loop reads, and the engine is asked
 * for a frame on every change so a still picture redraws at once.
 */
function useReducedMotion(stillRef: Box<boolean>, invalidate: () => void): boolean {
  const [isStill, setIsStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      stillRef.current = mq.matches;
      setIsStill(mq.matches);
      invalidate();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [stillRef, invalidate]);
  return isStill;
}

/**
 * The Sound toggle and the audio graph behind it. The graph is created on
 * first use (see openAudio) and disposed on unmount; Sound off mutes it
 * rather than closing it, so turning Sound back on needs no new press.
 */
function useMonitorAudio() {
  const audioRef = useRef<Audio | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(true);
  useEffect(() => () => audioRef.current?.dispose(), []);
  const toggleSound = () => {
    audioRef.current?.setVolume(isSoundOn ? 0 : VOLUME);
    setIsSoundOn(!isSoundOn);
  };
  return { audioRef, isSoundOn, toggleSound };
}

interface FaultRunnerOptions {
  readonly activeRef: Box<ActiveEvent[]>;
  readonly audioRef: Box<Audio | null>;
  /** False under reduced motion or with no engine: every press is ignored. */
  readonly canRunFaults: boolean;
  /** Whether a fault is voiced as well as shown. */
  readonly isAudible: boolean;
}

/**
 * Jolt: runs the next of SAFE_FAULTS, one at a time. `fault` is the running
 * fault's label, and `ran` every fault run so far, how many and the last.
 * The monitor keeps both on its root as data attributes, because none of it
 * is text on the page and a test cannot reliably catch a 0.7 s picture.
 */
function useFaultRunner({ activeRef, audioRef, canRunFaults, isAudible }: FaultRunnerOptions) {
  const [fault, setFault] = useState<string | null>(null);
  const [ran, setRan] = useState<{ count: number; last: string }>({ count: 0, last: "" });
  // The running fault, as a ref: two presses that land before a re-render
  // must still see the first one, or both would start.
  const running = useRef(false);
  const nextFault = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** Runs one fault, picture and sound, unless one is already running. */
  const runFault = (id: EventId): { dur: number } | null => {
    if (running.current || !canRunFaults) return null;
    running.current = true;
    const def = fireEvent(activeRef, id);
    if (isAudible) openAudio(audioRef, VOLUME)?.fire(id);
    setFault(def.label);
    setRan((r) => ({ count: r.count + 1, last: def.label }));
    timers.current.push(
      window.setTimeout(() => {
        running.current = false;
        setFault(null);
      }, def.dur * 1000),
    );
    return def;
  };

  // The rotation advances only when a fault actually runs, so a press that is
  // ignored mid-fault does not skip one.
  const jolt = () => {
    if (runFault(SAFE_FAULTS[nextFault.current % SAFE_FAULTS.length])) nextFault.current++;
  };

  return { fault, ran, jolt };
}

/**
 * Whether the pointer or keyboard focus is on the monitor, and the handlers
 * for its root that track both. Focus moving between the monitor's own
 * buttons is not leaving it.
 *
 * Only keyboard focus counts — what the browser marks :focus-visible. A click
 * on Sound or Jolt focuses the button too, and that focus stays behind when
 * the pointer leaves, which kept the room playing after a hover ended. A
 * hidden tab is never present: a pointer that leaves by switching tabs sends
 * no pointerleave.
 */
function usePresence() {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPageVisible = usePageVisible();
  const presenceHandlers = {
    onPointerEnter: () => setIsHovered(true),
    onPointerLeave: () => setIsHovered(false),
    onFocus: (e: FocusEvent<HTMLDivElement>) => setIsFocused(e.target.matches(":focus-visible")),
    onBlur: (e: FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsFocused(false);
    },
  };
  return { isPresent: isPageVisible && (isHovered || isFocused), presenceHandlers };
}

/** Whether the page's tab is the one showing, followed live. */
function usePageVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const sync = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return isVisible;
}

interface MonitorRoomOptions {
  readonly audioRef: Box<Audio | null>;
  /** Sound is audible and the pointer or focus is on the monitor. */
  readonly shouldPlay: boolean;
  /** Faults run so far; each one re-checks the room. */
  readonly faultCount: number;
}

/**
 * The room bed, and whether it is actually playing. It is never on unless
 * `shouldPlay`. It is state set by the effect rather than derived from
 * `shouldPlay`, because before the page's first press audio cannot open and
 * the room is still off.
 *
 * It is checked again after every fault too: when the page's first press is
 * Jolt while the pointer is already over the monitor, that press is what
 * allows audio, and the room should come up then rather than on the next
 * hover.
 */
function useMonitorRoom({ audioRef, shouldPlay, faultCount }: MonitorRoomOptions): boolean {
  const [isRoomOn, setIsRoomOn] = useState(false);
  const isBedOn = useRef(false);
  useEffect(() => {
    if (shouldPlay && !isBedOn.current) {
      const audio = openAudio(audioRef, VOLUME);
      if (!audio) return;
      audio.setBed(true, ROOM);
      isBedOn.current = true;
      setIsRoomOn(true);
    } else if (!shouldPlay && isBedOn.current) {
      audioRef.current?.setBed(false, ROOM);
      isBedOn.current = false;
      setIsRoomOn(false);
    }
  }, [audioRef, shouldPlay, faultCount]);
  return isRoomOn;
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
