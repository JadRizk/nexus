import { createHash } from "node:crypto";

/** Significant digits kept for floats: every real change shows, and the text stays short. */
const DIGITS = 6;
const HASH_LENGTH = 12;

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(+value.toPrecision(DIGITS));
}

export function hashBytes(view: ArrayBufferView): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return createHash("sha1").update(bytes).digest("hex").slice(0, HASH_LENGTH);
}

export function hashText(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, HASH_LENGTH);
}

/** JSON with floats rounded and typed arrays hashed, so a payload reads in one line. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "number") return Number(formatNumber(item));
    if (ArrayBuffer.isView(item)) return `#${hashBytes(item)}`;
    return item;
  });
}

/**
 * The recording as text: a `==` line per step, a `--` line per frame, then that
 * frame's events in call order and one `key = value` line for each field that
 * changed since the frame before. The first frame writes every field.
 */
export interface Transcript {
  step(title: string): void;
  events(events: readonly string[]): void;
  frame(title: string, events: readonly string[], state: ReadonlyMap<string, string>): void;
  text(): string;
}

export function createTranscript(): Transcript {
  const lines: string[] = [];
  let previous = new Map<string, string>();
  return {
    step(title) {
      lines.push(`== ${title}`);
    },
    events(events) {
      lines.push(...events);
    },
    frame(title, events, state) {
      lines.push(`-- ${title}`, ...events);
      for (const [key, value] of state) {
        if (previous.get(key) !== value) lines.push(`  ${key} = ${value}`);
      }
      for (const key of previous.keys()) if (!state.has(key)) lines.push(`  ${key} gone`);
      previous = new Map(state);
    },
    text: () => `${lines.join("\n")}\n`,
  };
}
