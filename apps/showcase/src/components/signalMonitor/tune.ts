import { configFor } from "../../effects/glitch/core/config.js";
import type { Config } from "../../effects/glitch/core/config.js";

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
export function restingConfig(): Config {
  const config = configFor("BROADCAST");
  Object.assign(config.crt, { amt: 1, curve: 0.9, overscan: 1 });
  config.holo.flicker = 0;
  return config;
}

/** The part of a DOMRect the tuning reads. */
export type ScreenRect = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;

/**
 * The signal for a pointer at client position (`x`, `y`) over `rect`, in CSS
 * px: across the screen turns up colour bleed, down it turns up tracking.
 * Positions outside `rect` clamp to its edge.
 */
export function tuneFromPointer(rect: ScreenRect, x: number, y: number): Config {
  const across = clamp01((x - rect.left) / rect.width);
  const down = clamp01((y - rect.top) / rect.height);
  const config = restingConfig();
  Object.assign(config.chroma, {
    on: 1,
    amt: 0.5 + across * 0.5,
    width: 4 + across * 20,
    lag: -2 + across * 12,
  });
  Object.assign(config.tracking, {
    on: 1,
    amt: down,
    shift: down * 0.12,
    height: 0.06 + down * 0.18,
  });
  return config;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
