import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import type { RunningEvent } from "./core/resolveEvents.js";
import { EFFECTS } from "./data/effects/index.js";
import { createFrameLoop } from "./frameLoop.js";
import type { EngineRefs } from "./frameLoop.js";
import { createRenderer } from "./gl/renderer.js";
import type { Renderer } from "./gl/renderer.js";

export interface EngineOptions {
  readonly onError?: (message: string) => void;
  /** The running events, newest first, at most every 0.05 s. */
  readonly onLive?: (running: RunningEvent[]) => void;
  /** Frames per second, every 0.5 s. */
  readonly onFps?: (fps: number) => void;
  /** The most frames per second to draw; 0 (the default) draws every display frame. */
  readonly maxFps?: number;
  /** The most device pixels per CSS pixel to render at; 1.5 by default. */
  readonly maxDpr?: number;
}

interface Mount {
  readonly refs: Required<EngineRefs>;
  readonly invalidate: { current: () => void };
  readonly onError: (message: string) => void;
  readonly onLive: (running: RunningEvent[]) => void;
  readonly onFps: (fps: number) => void;
  readonly maxFps: number;
  readonly maxDpr: number;
}

const noop = (): void => undefined;

/** `String(error.message || error)`, for whatever a failed compile threw. */
function messageOf(error: unknown): string {
  return String((error as { message?: unknown }).message || error);
}

/** The canvas the engine draws into, filling `host`. */
function mountCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  host.appendChild(canvas);
  return canvas;
}

function contextOf(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  return (
    canvas.getContext("webgl", { antialias: false, alpha: false }) ||
    (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null)
  );
}

/**
 * Mounts a canvas in `host` and runs the pipeline in it until the returned
 * teardown. On no WebGL or a failed compile it reports through `onError` and
 * returns undefined, leaving the canvas in place.
 */
function startEngine(host: HTMLElement, mount: Mount): (() => void) | undefined {
  const canvas = mountCanvas(host);
  const gl = contextOf(canvas);
  if (!gl) {
    mount.onError("WebGL unavailable in this context.");
    return undefined;
  }
  let renderer: Renderer;
  try {
    renderer = createRenderer(gl, EFFECTS);
  } catch (error) {
    mount.onError(messageOf(error));
    return undefined;
  }

  const dpr = Math.min(window.devicePixelRatio, mount.maxDpr);
  const toPixels = (cssPixels: number) => Math.max(2, Math.floor(cssPixels * dpr));
  const resize = () => renderer.resize(toPixels(host.clientWidth), toPixels(host.clientHeight));
  resize();
  const observer = new ResizeObserver(() => {
    resize();
    mount.invalidate.current();
  });
  observer.observe(host);

  let frameHandle = 0;
  const frame = createFrameLoop({
    refs: mount.refs,
    renderer,
    onLive: mount.onLive,
    onFps: mount.onFps,
    maxFps: mount.maxFps,
    startedAt: performance.now(),
    requestFrame: (callback) => {
      frameHandle = requestAnimationFrame(callback);
    },
  });
  frameHandle = requestAnimationFrame(frame);
  mount.invalidate.current = () => {
    cancelAnimationFrame(frameHandle);
    frameHandle = requestAnimationFrame(frame);
  };

  return () => {
    mount.invalidate.current = noop;
    cancelAnimationFrame(frameHandle);
    observer.disconnect();
    canvas.remove();
  };
}

/**
 * Runs Glitch Lab's pipeline into a canvas appended to `hostRef.current`, armed
 * once per mount. Every ref is read each frame (see `EngineRefs`); the
 * callbacks are always the latest ones passed.
 *
 * @returns `invalidate`, which draws a frame now; needed only for stills.
 */
export function useGlitchEngine(
  hostRef: { readonly current: HTMLElement | null },
  refs: EngineRefs,
  { onError, onLive, onFps, maxFps = 0, maxDpr = 1.5 }: EngineOptions = {},
): () => void {
  const none = useRef(null);
  const { cfgRef, srcRef, activeRef, queueRef } = refs;
  const autoRef = refs.autoRef ?? none;
  const rateRef = refs.rateRef ?? none;
  const audioRef = refs.audioRef ?? none;
  const stillRef = refs.stillRef ?? none;
  const seedRef = refs.seedRef ?? none;
  const reportError = useEffectEvent((message: string) => onError?.(message));
  const reportLive = useEffectEvent((running: RunningEvent[]) => onLive?.(running));
  const reportFps = useEffectEvent((fps: number) => onFps?.(fps));
  const invalidate = useRef<() => void>(noop);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    return startEngine(host, {
      refs: { cfgRef, srcRef, activeRef, queueRef, autoRef, rateRef, audioRef, stillRef, seedRef },
      invalidate,
      onError: reportError,
      onLive: reportLive,
      onFps: reportFps,
      maxFps,
      maxDpr,
    });
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
