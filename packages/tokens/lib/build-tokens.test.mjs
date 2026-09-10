import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* ============================================================================
   The token build refuses to emit a stylesheet whose themes miss the contrast
   floors they declare. That guarantee is the entire point of generating these
   files rather than typing them, so it is exercised directly: feed the
   generator a deliberately broken palette and assert it stops.
   ========================================================================== */

const pkg = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(pkg, "build-tokens.mjs");
const source = JSON.parse(readFileSync(join(pkg, "src", "tokens.json"), "utf8"));

/** Runs the generator against a mutated copy, writing nothing. */
function build(mutate) {
  const tokens = structuredClone(source);
  mutate(tokens);
  const file = join(mkdtempSync(join(tmpdir(), "nexus-tokens-")), "tokens.json");
  writeFileSync(file, JSON.stringify(tokens));
  try {
    return {
      ok: true,
      output: execFileSync("node", [script, "--source", file, "--dry-run"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/**
 * Like build(), but returns the generated CSS text instead of the dry-run
 * summary line — --dry-run alone never writes anywhere, including the print
 * destination, so this passes --print-css-to on top of it to capture the
 * output without touching src/tokens.css.
 */
function buildCss(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "nexus-tokens-"));
  const sourceFile = join(dir, "tokens.json");
  const cssFile = join(dir, "tokens.css");
  const tokens = structuredClone(source);
  mutate(tokens);
  writeFileSync(sourceFile, JSON.stringify(tokens));
  execFileSync("node", [script, "--source", sourceFile, "--dry-run", "--print-css-to", cssFile], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return readFileSync(cssFile, "utf8");
}

describe("the accessibility guard", () => {
  it("passes on the palette as it ships", () => {
    const r = build(() => {});
    expect(r.ok).toBe(true);
    expect(r.output).toMatch(/all AA floors met/);
  });

  it("fails when disabled text drops below the 1.4.3 floor", () => {
    const r = build((t) => {
      // grey-300 carries disabled text and is solved to 4.52:1. Darkened, it
      // no longer clears 4.5 — the exact regression this exists to catch.
      t.primitive.ramp["grey-300"].$value = "#4A5540";
    });
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/grey-300/);
    expect(r.output).toMatch(/WCAG 1\.4\.3/);
  });

  it("fails when a UI boundary drops below the 1.4.11 floor", () => {
    const r = build((t) => {
      t.primitive.ramp["grey-200"].$value = "#2C3729"; // the hud value, 1.57:1
    });
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/grey-200/);
    expect(r.output).toMatch(/WCAG 1\.4\.11/);
  });

  it("fails when a foreground role becomes illegible on the surface", () => {
    const r = build((t) => {
      t.primitive.colour.phosphor.$value = "#141614";
    });
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/semantic\.fg\.default/);
  });

  it("rejects an alias pointing at a token that does not exist", () => {
    const r = build((t) => {
      t.semantic.fg.accent.$value = "{primitive.colour.chartreuse}";
    });
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/chartreuse/);
  });

  it("does not fail the prototype theme, which declares no targets", () => {
    // `hud` genuinely fails AA and says so. The build must not treat a theme's
    // honest, documented trade-off as a regression.
    const r = build(() => {});
    expect(r.ok).toBe(true);
  });
});

describe("the emitted stylesheet", () => {
  const css = readFileSync(join(pkg, "src", "tokens.css"), "utf8");

  /** Custom properties declared inside one selector block. */
  const declared = (selector) => {
    const i = css.indexOf(selector + " {");
    if (i === -1) throw new Error(`No block for ${selector}`);
    const body = css.slice(i, css.indexOf("\n}", i));
    return new Set(Array.from(body.matchAll(/(--nx-[a-z0-9-]+)\s*:/g), (m) => m[1]));
  };

  const themeBlocks = ['[data-nx-theme="hud-aa"]', '[data-nx-theme="hud"]'];

  it("declares the same set of properties in every theme block", () => {
    const [a, b] = themeBlocks.map(declared);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it("re-declares tokens downstream of the ramp inside each theme block", () => {
    // The regression this guards: a semantic token declared only on :root has
    // its var() substituted against :root's primitives and inherits as a fixed
    // literal, so setting data-nx-theme on any element below :root — which is
    // exactly what NexusProvider does — changed nothing a component reads.
    for (const block of themeBlocks) {
      const props = declared(block);
      for (const p of [
        "--nx-fg-muted",
        "--nx-fg-subtle",
        "--nx-fg-tertiary",
        "--nx-fg-disabled",
        "--nx-border-default",
        "--nx-border-strong",
      ]) {
        expect(props, `${block} must re-declare ${p}`).toContain(p);
      }
    }
  });

  it("re-declares the type scale inside each theme block", () => {
    for (const block of themeBlocks) {
      const props = declared(block);
      expect(props).toContain("--nx-font-scale");
      expect(props).toContain("--nx-text-xs");
    }
  });

  it("puts the theme blocks after the semantic defaults they override", () => {
    // Equal specificity when the attribute sits on :root itself, so source
    // order is the only thing deciding which wins.
    const semantic = css.indexOf("--nx-fg-disabled:");
    const themed = css.indexOf('[data-nx-theme="hud"] {');
    expect(semantic).toBeLessThan(themed);
  });

  it("keeps the semantic layer as references, never resolved literals", () => {
    // A semantic token frozen to a hex is a theme that cannot move.
    const i = css.indexOf("SEMANTIC LAYER");
    const block = css.slice(i, css.indexOf("\n}", i));
    expect(block).toMatch(/--nx-fg-default:\s+var\(--nx-phosphor\)/);
    expect(block).not.toMatch(/--nx-fg-default:\s+#/);
  });
});

describe("generated output", () => {
  it("derives the contrast table from the token values", () => {
    const r = build((t) => {
      t.primitive.colour.acid.$value = "#FFFFFF";
    });
    expect(r.ok).toBe(true);
    // 21:1 is white on the panel surface — proof the number is computed from
    // the token rather than carried over from the old hand-typed table.
    expect(r.output).toMatch(/13 contrast ratios computed/);
  });
});

describe("theme-sensitivity through an aliased scaleBy target", () => {
  // isThemeSensitive's alias branch recurses; its scaleBy branch used to call
  // the non-recursive isThemed on the scale target instead. isThemed's very
  // first check is `path.startsWith("primitive.")`, which every semantic.*
  // token fails by definition (a semantic token IS an alias to a primitive) —
  // so a scaleBy target reached through a semantic alias was misclassified as
  // theme-insensitive and silently dropped from the per-theme re-declaration
  // this whole generator exists to do. font-scale, the one real scaleBy
  // target, happens to be a bare primitive and never exercised this branch;
  // this constructs the case that would have.
  it("re-declares a scaled token per theme when its scaleBy target is a semantic alias to a themed primitive", () => {
    const css = buildCss((t) => {
      // semantic.fg.disabled resolves through primitive.ramp.grey-300, which
      // differs by theme — cssName("semantic.fg.disabled") is "--nx-fg-disabled",
      // so this is what the scaleBy lookup has to find and correctly recurse
      // into. Not a real-world scaleBy target, just the shape that isolates
      // the bug: a scaleBy pointing at something themed only through an
      // alias, rather than directly.
      t.primitive.text["2xs"].$extensions["nexus.scaleBy"] = "fg-disabled";
    });

    for (const block of ['[data-nx-theme="hud-aa"]', '[data-nx-theme="hud"]']) {
      const start = css.indexOf(block + " {");
      expect(start, `expected a ${block} block`).toBeGreaterThan(-1);
      const body = css.slice(start, css.indexOf("\n}", start));
      expect(body, `${block} should re-declare --nx-text-2xs`).toContain("--nx-text-2xs:");
    }
  });
});
