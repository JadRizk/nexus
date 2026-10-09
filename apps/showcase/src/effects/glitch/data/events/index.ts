import { BOOT_EVENT } from "./boot.js";
import { CORRUPT_EVENT } from "./corrupt.js";
import { CRASH_EVENT } from "./crash.js";
import { DEGAUSS_EVENT } from "./degauss.js";
import { DROPOUT_EVENT } from "./dropout.js";
import { INTERFERENCE_EVENT } from "./interference.js";
import { SCRUB_EVENT } from "./scrub.js";
import { SIGNAL_EVENT } from "./signal.js";
import type { EventDef } from "./types.js";

/** Every event, in the order Glitch Lab lists them (and their keys 1–8). */
export const EVENTS = [
  DROPOUT_EVENT,
  SIGNAL_EVENT,
  CORRUPT_EVENT,
  CRASH_EVENT,
  DEGAUSS_EVENT,
  SCRUB_EVENT,
  INTERFERENCE_EVENT,
  BOOT_EVENT,
] as const satisfies readonly EventDef[];

export type EventId = (typeof EVENTS)[number]["id"];

/** Events by id. Keyed by string because callers look up ids from the keyboard and the queue. */
export const EV_BY_ID: Readonly<Record<string, EventDef>> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);
