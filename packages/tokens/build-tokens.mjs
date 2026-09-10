#!/usr/bin/env node
/* ============================================================================
   Generates src/tokens.css and src/contrast.gen.ts from src/tokens.json.

   Before this existed, tokens.json declared a Style Dictionary $schema and was
   described as the source of truth, but nothing read it: tokens.css was hand
   written and was what actually shipped, and the contrast ratios were typed by
   hand into three separate places. Every one of those numbers happened to be
   correct — but nothing would have noticed if a hex had moved.

   Now there is exactly one hand-authored source of token data, the contrast
   figures are computed from the resolved colours, and the AA floors are
   asserted at build time. Change a hex past a floor and the build stops.

   Why not Style Dictionary itself: the token file is plain DTCG, so SD v4+ can
   read it unchanged if you ever want it. What SD would still need is a custom
   format for the per-theme ramp blocks, a second for the TypeScript output, a
   custom action for the contrast maths, and a concat step for base.css — at
   which point the config is larger than this file, and the token package keeps
   a build-time dependency it does not otherwise need.
   ========================================================================== */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ratio2 } from "./lib/wcag.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => join(here, "src", f);

// `--source <file>` and `--dry-run` exist so the accessibility guard below can
// itself be tested: build-tokens.test.mjs feeds in a deliberately broken token
// file and asserts the build refuses it. A guard nothing exercises is a guard
// nobody knows is wired up.
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : (argv[i + 1] ?? true);
};
const SOURCE = flag("--source") ?? src("tokens.json");
const DRY_RUN = argv.includes("--dry-run");
// Writes the generated tokens.css to this path instead of stdout's one-line
// summary, without touching src/tokens.css. Exists so build-tokens.test.mjs
// can inspect the generated CSS for a synthetic token tree — --dry-run alone
// prints nothing about the actual output, only whether the build succeeded.
const PRINT_CSS_TO = flag("--print-css-to");

const tokens = JSON.parse(readFileSync(SOURCE, "utf8"));

const THEMES = Object.keys(tokens.theme).filter((k) => !k.startsWith("$"));
const DEFAULT_THEME = THEMES.find((t) => tokens.theme[t].default) ?? THEMES[0];

/* ------------------------------------------------------------------ walking */

const isToken = (node) =>
  node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, "$value");

/** Every token in the tree, as [dottedPath, node]. */
function* walk(node, path = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (isToken(child)) yield [[...path, key].join("."), child];
    else if (child && typeof child === "object") yield* walk(child, [...path, key]);
  }
}

const byPath = new Map(walk(tokens));

/** The CSS custom property a token path maps to: primitive.colour.acid → --nx-acid. */
function cssName(path) {
  const parts = path.split(".");
  const [root, group, ...rest] = parts;
  const leaf = rest.join("-");

  if (root === "primitive") {
    // Groups that are purely organisational collapse away; groups that are a
    // real prefix in the CSS keep their name.
    const FLAT = new Set(["colour", "ramp", "motion", "effect", "crt", "scale", "shape"]);
    return FLAT.has(group) ? `--nx-${leaf}` : `--nx-${group}-${leaf}`;
  }
  if (root === "semantic") {
    const FLAT = new Set(["split", "focus"]);
    return FLAT.has(group) ? `--nx-${leaf}` : `--nx-${group}-${leaf}`;
  }
  throw new Error(`Unmapped token root: ${path}`);
}

/* ---------------------------------------------------------------- resolving */

const ALIAS = /^\{([^}]+)\}$/;

/** Alias → the CSS `var()` reference it becomes. */
function toCssValue(node, path) {
  const raw = String(node.$value);
  const alias = raw.match(ALIAS);
  if (alias) {
    const target = alias[1];
    if (!byPath.has(target)) {
      throw new Error(`${path} references {${target}}, which does not exist in tokens.json`);
    }
    return `var(${cssName(target)})`;
  }
  const scaleBy = node.$extensions?.["nexus.scaleBy"];
  if (scaleBy) return `calc(${raw} * var(--nx-${scaleBy}))`;
  return raw;
}

/** Alias → the literal value it ultimately resolves to, for a given theme. */
function resolveValue(path, theme, seen = new Set()) {
  if (seen.has(path)) throw new Error(`Circular token reference at ${path}`);
  seen.add(path);

  const node = byPath.get(path);
  if (!node) throw new Error(`Unknown token: ${path}`);

  const override = node.$extensions?.["nexus.themeOverrides"]?.[theme];
  const raw = String(override ?? node.$value);

  const alias = raw.match(ALIAS);
  return alias ? resolveValue(alias[1], theme, seen) : raw;
}

/**
 * Primitives whose value differs by theme. Only primitives are ever emitted
 * per theme: a semantic token is a `var()` reference to a primitive, so it is
 * written once and picks up the theme through the cascade. That indirection is
 * the whole reason swapping a theme never touches component code, and
 * resolving semantics to literals here would quietly throw it away.
 */
function isThemed(path) {
  if (!path.startsWith("primitive.")) return false;
  return THEMES.some((t) => resolveValue(path, t) !== resolveValue(path, DEFAULT_THEME));
}

/**
 * Tokens whose *resolved* value depends on the theme — the themed primitives
 * plus everything downstream of one, whether through an alias
 * (`--nx-fg-disabled` → `--nx-grey-300`) or through the type scale
 * (`--nx-text-xs` → `--nx-font-scale`).
 *
 * These have to be re-declared inside each theme block, and that is not a
 * stylistic choice. A custom property's `var()` is substituted on the element
 * where the declaration matches, and only the *result* inherits. So a semantic
 * token declared once on `:root` resolves against `:root`'s primitives and
 * inherits as a fixed literal — meaning `data-nx-theme` on any element below
 * `:root` swapped the primitives on that element and changed nothing that
 * components actually read.
 *
 * That is what `NexusProvider` does, so the theme switch silently did nothing.
 * Re-declaring the downstream tokens per theme is what makes the attribute
 * work anywhere, which is what the README always claimed.
 */
function isThemeSensitive(path) {
  if (isThemed(path)) return true;
  const node = byPath.get(path);
  const scaleBy = node.$extensions?.["nexus.scaleBy"];
  if (scaleBy) {
    const target = [...byPath.keys()].find((p) => cssName(p) === `--nx-${scaleBy}`);
    // Recursive, not isThemed: isThemed only recognises a *primitive* whose
    // literal value differs by theme, and every semantic.* token is by
    // definition an alias rather than a primitive — so a scaleBy target that
    // pointed at a themed primitive through a semantic alias would read as
    // theme-insensitive under the non-recursive check, and silently stop
    // being re-declared per theme block. Using the same traversal as the
    // alias branch below keeps this one general rule instead of one that
    // only happens to hold for font-scale, the one scaleBy target that
    // exists today.
    if (target && isThemeSensitive(target)) return true;
  }
  const alias = String(node.$value).match(ALIAS);
  return alias ? isThemeSensitive(alias[1]) : false;
}

/* ----------------------------------------------------------------- contrast */

const SURFACE = resolveValue("semantic.bg.surface", DEFAULT_THEME);
const isOpaqueHex = (v) => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v);

/**
 * Measured against the panel surface. Grounds and translucent overlays are
 * excluded: a ratio against --nx-bg-surface is meaningless for a colour that
 * *is* a surface, or for a scrim that composites over one.
 */
const NOT_FOREGROUND = new Set(["void", "panel", "raised"]);

/**
 * Every opaque background a colour can actually land on, for a given theme:
 * the `semantic.bg.*` roles that resolve to a solid hex, as [cssName, hex].
 * Translucent roles (hover, active, track) are excluded because they
 * composite over whichever of these is underneath — their effective contrast
 * is a property of the stack, not of the token.
 *
 * The *reported* ratios below stay panel-referenced. "Every contrast ratio in
 * this system is measured against --nx-bg-surface" is a deliberate definition,
 * it is what `contrast.gen.ts` publishes, and this does not change it. What it
 * changes is the *guard*: the definition had a gap in practice, because Drawer
 * renders on --nx-bg-raised (#11150F), which is lighter than the panel, so a
 * ramp step solved to exactly its floor against the panel came in under that
 * floor where the component actually draws it. A floor asserted on one surface
 * is not a floor. Assert it on all of them; keep quoting one.
 */
function opaqueSurfaces(theme) {
  const out = [];
  for (const [path, node] of byPath) {
    if (!path.startsWith("semantic.bg.") || node.$type !== "color") continue;
    const value = resolveValue(path, theme);
    if (isOpaqueHex(value)) out.push([cssName(path), value]);
  }
  return out;
}

function contrastTable() {
  const table = {};
  for (const theme of THEMES) {
    const row = {};
    for (const [path, node] of byPath) {
      if (node.$type !== "color") continue;
      if (!path.startsWith("primitive.")) continue;
      const name = path.split(".").pop();
      if (NOT_FOREGROUND.has(name)) continue;
      const value = resolveValue(path, theme);
      if (!isOpaqueHex(value)) continue;
      row[name] = ratio2(value, SURFACE);
    }
    table[theme] = row;
  }
  return table;
}

/* ------------------------------------------------------------------- assert */

const failures = [];

/**
 * A token that opts out of a floor and says why in tokens.json.
 *
 * Exactly one token uses this today, `semantic.border.default`: a hairline
 * that has never met 3.0 and whose lift would move every panel and button
 * edge in the system. Encoding the exemption in the token file rather than as
 * a name list in here is what keeps it reviewable — the reason sits next to
 * the value, and adding one is a diff in the source of truth.
 */
const isExempt = (node) => node.$extensions?.["nexus.contrast"] === "decorative";

/**
 * The semantic colour roles that carry a floor, and which floor.
 *
 * Foregrounds are text (1.4.3), so they answer to `floors.text`. Borders and
 * the focus ring are non-text (1.4.11, 2.4.11), so they answer to
 * `floors.nonText`. Before this, every foreground was gated at a hardcoded
 * 3.0 — the large-text allowance — while the themes declared 4.5 and the
 * README quoted 4.5. The guard was a full AA step below the claim it existed
 * to defend.
 */
const ROLES = [
  ["semantic.fg.", "text", "text — WCAG 1.4.3"],
  ["semantic.border.", "nonText", "UI boundary — WCAG 1.4.11"],
  ["semantic.focus.", "nonText", "focus indicator — WCAG 1.4.11 and 2.4.11"],
];

function assertFloors(table) {
  for (const theme of THEMES) {
    const floors = tokens.theme[theme].wcag;
    if (!floors) continue;
    const grounds = opaqueSurfaces(theme);

    /** Fails the build for every surface `value` misses `floor` on. */
    const check = (label, value, floor, why, suffix = "") => {
      for (const [ground, bg] of grounds) {
        const got = ratio2(value, bg);
        if (got < floor) {
          failures.push(
            `${label} is ${got}:1 on ${ground} (${bg}), below the ${floor}:1 floor for ${why}.` +
              suffix,
          );
        }
      }
    };

    // The two ramp steps the theme's accessibility claim actually rests on:
    // disabled text must clear 1.4.3, and the UI boundary must clear 1.4.11.
    const checks = [
      ["grey-300", floors.text, "disabled text — WCAG 1.4.3"],
      ["grey-200", floors.nonText, "UI boundary — WCAG 1.4.11"],
    ];
    for (const [step, floor, why] of checks) {
      if (table[theme][step] === undefined) {
        failures.push(`${theme}: ramp step ${step} is missing, so ${why} cannot be checked`);
        continue;
      }
      check(
        `${theme}/${step}`,
        resolveValue(`primitive.ramp.${step}`, theme),
        floor,
        why,
        " Move the colour back or change the theme's declared wcag targets deliberately.",
      );
    }

    // Every semantic colour role, on every opaque surface it can land on.
    for (const [prefix, kind, why] of ROLES) {
      for (const [path, node] of byPath) {
        if (!path.startsWith(prefix) || node.$type !== "color") continue;
        if (isExempt(node)) continue;
        const value = resolveValue(path, theme);
        if (!isOpaqueHex(value)) continue;
        check(`${path} resolves to ${value} in ${theme}, which`, value, floors[kind], why);
      }
    }
  }
}

/* --------------------------------------------------------------- CSS output */

const GENERATED = (from) => `/* ============================================================================
   GENERATED FILE — do not edit.

   Produced from ${from} by packages/tokens/build-tokens.mjs.
   Edit the token source and run \`npm run build:tokens\`.
   ========================================================================== */`;

/** Wraps prose to fit the 80-column banner style the stylesheets use. */
function wrap(text, width = 74, indent = "   ") {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? line + " " + w : w;
  }
  if (line) lines.push(line);
  return lines.join("\n" + indent);
}

/** Pads names so the values line up, which is most of what makes the file readable. */
function declBlock(entries, indent = "  ") {
  const width = Math.max(0, ...entries.map(([n]) => n.length)) + 1;
  return entries
    .map(([name, value, comment]) => {
      const line = `${indent}${(name + ":").padEnd(width + 1)} ${value};`;
      return comment ? `${line.padEnd(56)} /* ${comment} */` : line;
    })
    .join("\n");
}

/** The semantic layer: role names, written once as var() references. */
function semanticBlock() {
  const block = [];
  block.push(`/* ============================================================================
   SEMANTIC LAYER — the only names components may use.

   A second :root block on purpose: primitives and semantics are separate
   layers that happen to share a scope, and collapsing them into one block to
   satisfy no-duplicate-selectors would erase the only visible boundary
   between "raw value" and "role".
   ========================================================================== */
/* stylelint-disable-next-line no-duplicate-selectors */`);
  block.push(":root {");

  for (const [i, group] of ["bg", "fg", "border", "split", "focus"].entries()) {
    const entries = [];
    for (const [path, node] of byPath) {
      if (!path.startsWith(`semantic.${group}.`)) continue;
      // First sentence only — enough to carry the rule, short enough to sit
      // at the end of the line without pushing the file past 100 columns.
      const first = node.$description?.split(/\.\s|(?<=\.)$/)[0]?.trim();
      const short = first && first.length <= 46 ? first.replace(/\.$/, "") : null;
      entries.push([cssName(path), toCssValue(node, path), short]);
    }
    if (!entries.length) continue;
    if (i) block.push("");
    block.push(declBlock(entries));
  }
  block.push("}");
  block.push("");

  return block.join("\n");
}

function buildCss(table) {
  const out = [];

  out.push(GENERATED("src/tokens.json"));
  out.push("");
  out.push(`/* ${tokens.$description.split(". ")[0]}.

   Zero dependencies. Works with React, Vue, Svelte, plain HTML, or a Tailwind
   preset generated from the same tokens.json.

   Usage:
     <html data-nx-theme="${DEFAULT_THEME}">     default${tokens.theme[DEFAULT_THEME].wcag ? ", WCAG AA" : ""}
${THEMES.filter((t) => t !== DEFAULT_THEME)
  .map((t) => `     <html data-nx-theme="${t}">        ${tokens.theme[t].label}`)
  .join("\n")}

   Every semantic name exists in every theme, so swapping never touches
   component code. */`);
  out.push("");

  /* ---- primitives (theme-invariant only) ---- */
  out.push(`/* ============================================================================
   PRIMITIVES
   Never referenced from a component — use the semantic layer. Contrast figures
   are computed against --nx-bg-surface (${SURFACE}) at build time, not typed in.
   ========================================================================== */`);
  out.push(":root {");

  const groups = [
    ["primitive.colour", "surfaces + signature palette"],
    ["primitive.font", "typography"],
    ["primitive.text", null],
    ["primitive.track", null],
    ["primitive.weight", null],
    ["primitive.leading", null],
    ["primitive.space", "layout"],
    ["primitive.shape", null],
    ["primitive.motion", "motion"],
    ["primitive.effect", "elevation + scrim"],
    ["primitive.crt", "CRT layer"],
  ];

  const sections = [];
  for (const [prefix, label] of groups) {
    const entries = [];
    for (const [path, node] of byPath) {
      if (!path.startsWith(prefix + ".")) continue;
      if (isThemed(path)) continue; // emitted per theme below
      const name = path.split(".").pop();
      const value = resolveValue(path, DEFAULT_THEME);
      const comment = isOpaqueHex(value) && !NOT_FOREGROUND.has(name)
        ? `${ratio2(value, SURFACE).toFixed(2)}:1`
        : null;
      entries.push([cssName(path), toCssValue(node, path), comment]);
    }
    if (!entries.length) continue;
    sections.push({ label, entries, prefix });
  }

  for (const [i, s] of sections.entries()) {
    if (i) out.push("");
    if (s.label) out.push(`  /* ${s.label} */`);
    // The restricted colour keeps its warning inline — it is the one token
    // whose $description is a rule rather than a note.
    const alarm = byPath.get("primitive.colour.alarm");
    if (s.prefix === "primitive.colour" && alarm) {
      const idx = s.entries.findIndex(([n]) => n === "--nx-alarm");
      const head = declBlock(s.entries.slice(0, idx));
      out.push(head);
      out.push("");
      out.push(`  /* ${alarm.$description.replace(/\s+/g, " ").replace(/(.{68}) /g, "$1\n     ")} */`);
      out.push(declBlock(s.entries.slice(idx)));
    } else {
      out.push(declBlock(s.entries));
    }
  }
  out.push("}");
  out.push("");

  /* ---- semantic (defaults) ----
     Emitted before the theme blocks on purpose: when the theme attribute sits
     on the same element as :root, both selectors match at equal specificity
     and the later declaration wins. The theme has to be the later one. */
  out.push(semanticBlock());

  /* ---- per-theme blocks ---- */
  const themed = [...byPath.keys()].filter(isThemed);
  const sensitive = [...byPath.keys()].filter((p) => isThemeSensitive(p) && !isThemed(p));
  for (const theme of THEMES) {
    const meta = tokens.theme[theme];
    const isDefault = theme === DEFAULT_THEME;
    const ratios = themed
      .map((p) => table[theme][p.split(".").pop()])
      .filter((r) => r !== undefined);
    const range = ratios.length
      ? `${Math.min(...ratios).toFixed(2)}–${Math.max(...ratios).toFixed(2)}:1`
      : "";

    out.push(`/* ============================================================================
   THEME: ${theme}${isDefault ? " (default)" : ""} — ${meta.label}.${
     meta.wcag
       ? ` Signature colours untouched; only the
   muted ramp lifts. Solved against exact contrast targets, hue 100deg sat 13%.`
       : `
   ${wrap(`${meta.note} Muted range ${range}.`)}`
   }
   ========================================================================== */`);
    out.push(isDefault ? `:root,\n[data-nx-theme="${theme}"] {` : `[data-nx-theme="${theme}"] {`);

    const entries = themed.map((path) => {
      const name = path.split(".").pop();
      const value = resolveValue(path, theme);
      const r = table[theme][name];
      let comment = r !== undefined ? `${r.toFixed(2)}:1` : null;
      // A description like "target 7.0 — AAA body text" is a statement about
      // the theme that was solved for those targets. Repeating it in a theme
      // that misses them by half would be actively misleading, so descriptions
      // only travel with the theme that declares WCAG targets of its own.
      const desc = meta.wcag ? byPath.get(path).$description : null;
      if (comment && desc) comment += `  ${desc.replace(/\.$/, "")}`;
      return [cssName(path), value, comment];
    });
    out.push(declBlock(entries));

    // Everything downstream of a themed primitive, re-resolved in this scope.
    if (sensitive.length) {
      out.push("");
      out.push("  /* re-resolved here so the theme works on any element, not only :root */");
      out.push(declBlock(sensitive.map((p) => [cssName(p), toCssValue(byPath.get(p), p), null])));
    }
    out.push("}");
    out.push("");
  }

  /* ---- hand-authored base layer ---- */
  const base = readFileSync(src("base.css"), "utf8");
  out.push(base.slice(base.indexOf("/* ============================================================================\n   BASE")).trimEnd());

  return out.join("\n") + "\n";
}

/* ---------------------------------------------------------------- TS output */

function buildTs(table) {
  const rows = THEMES.map((theme) => {
    const entries = Object.entries(table[theme]);
    const body = entries
      .map(([name, r]) => `    ${/^[a-z][a-z0-9]*$/.test(name) ? name : `"${name}"`}: ${r},`)
      .join("\n");
    return `  "${theme}": {\n${body}\n  },`;
  }).join("\n");

  const floors = THEMES.filter((t) => tokens.theme[t].wcag)
    .map((t) => `  "${t}": { text: ${tokens.theme[t].wcag.text}, nonText: ${tokens.theme[t].wcag.nonText} },`)
    .join("\n");

  return `${GENERATED("src/tokens.json")}

export type NexusTheme = ${THEMES.map((t) => `"${t}"`).join(" | ")};

/**
 * Contrast of every palette entry against \`--nx-bg-surface\` (${SURFACE}),
 * computed from the resolved token values at build time.
 *
 * Exported so a consuming app can assert its own colour choices in a test
 * rather than discovering the problem in an audit.
 */
export const contrast = {
${rows}
} as const;

/** The AA floors each theme declares for itself in tokens.json. */
export const themeTargets = {
${floors}
} as const;
`;
}

/* -------------------------------------------------------------------- build */

const table = contrastTable();
assertFloors(table);

if (failures.length) {
  console.error("\nToken build failed — the accessibility floors are not met:\n");
  for (const f of failures) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}

const css = buildCss(table);
const ts = buildTs(table);

if (!DRY_RUN) {
  writeFileSync(src("tokens.css"), css);
  writeFileSync(src("contrast.gen.ts"), ts);
}
if (PRINT_CSS_TO) writeFileSync(PRINT_CSS_TO, css);

const colours = Object.keys(table[DEFAULT_THEME]).length;
console.log(
  `${DRY_RUN ? "[dry run] " : ""}tokens.css + contrast.gen.ts generated from tokens.json — ` +
    `${byPath.size} tokens, ${colours} contrast ratios computed, ` +
    `${THEMES.length} themes, all AA floors met on ` +
    `${opaqueSurfaces(DEFAULT_THEME).length} opaque surfaces.`,
);
