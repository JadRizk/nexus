import source from "@nexus-cyberdeck/tokens/tokens.json";
import { contrast } from "@nexus-cyberdeck/tokens";
import type { NexusTheme } from "@nexus-cyberdeck/tokens";

/* ============================================================================
   showcase — token model
   tokens.json flattened into the rows the Tokens page renders, so the page is
   generated from the source of truth rather than hand-copied from it: a token
   added to the JSON appears here with its description, and one renamed can
   never leave a stale swatch behind.

   cssName mirrors the rule in packages/tokens/build-tokens.mjs, which is a
   build script rather than a module and so cannot be imported. model.test.ts
   holds the two in step by diffing this model against the generated
   tokens.css: a mismatch in either direction fails.
   ========================================================================== */

interface TokenNode {
  $value: string | number;
  $type?: string;
  $description?: string;
  $extensions?: {
    "nexus.themeOverrides"?: Record<string, string>;
    "nexus.scaleBy"?: string;
    "nexus.contrast"?: string;
  };
}

interface ThemeMeta {
  default: boolean;
  label: string;
  wcag: { text: number; nonText: number } | null;
  note?: string;
}

type Tree = { [key: string]: Tree | TokenNode | string };

const tree = source as unknown as Tree & { theme: Record<string, ThemeMeta | string> };

export const THEMES = Object.keys(tree.theme).filter((k) => !k.startsWith("$")) as NexusTheme[];
export const THEME_META = Object.fromEntries(
  THEMES.map((t) => [t, tree.theme[t] as ThemeMeta]),
) as Record<NexusTheme, ThemeMeta>;
const DEFAULT_THEME = THEMES.find((t) => THEME_META[t].default) ?? THEMES[0]!;

export type Layer = "primitive" | "semantic";

export interface Token {
  /** Dotted path in tokens.json: "semantic.fg.accent". */
  path: string;
  layer: Layer;
  /** The JSON group under the layer: "fg", "colour", "space". */
  group: string;
  /** The custom property: "--nx-fg-accent". */
  name: string;
  type: string;
  description?: string;
  /** The custom property this token aliases, if it is an alias. */
  alias?: string;
  /** The literal each theme resolves to, after following aliases. */
  values: Record<NexusTheme, string>;
  /** Rendered size in px per theme, for tokens multiplied by the type scale. */
  px?: Record<NexusTheme, number>;
  /** True when any theme resolves this token differently. */
  themed: boolean;
  /** Excluded from contrast floors by design (`nexus.contrast: decorative`). */
  decorative: boolean;
  /** Tokens that alias this one. */
  referencedBy: string[];
}

const isToken = (node: unknown): node is TokenNode =>
  !!node && typeof node === "object" && "$value" in node;

function* walk(node: Tree, path: string[] = []): Generator<[string, TokenNode]> {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || key === "theme") continue;
    if (isToken(child)) yield [[...path, key].join("."), child];
    else if (child && typeof child === "object") yield* walk(child, [...path, key]);
  }
}

const byPath = new Map(walk(tree));

/** primitive.colour.acid → --nx-acid. Mirrors build-tokens.mjs. */
export function cssName(path: string): string {
  const [root, group = "", ...rest] = path.split(".");
  const leaf = rest.join("-");
  const flat =
    root === "primitive"
      ? ["colour", "ramp", "motion", "effect", "crt", "scale", "shape", "z"]
      : ["split", "focus"];
  return flat.includes(group) ? `--nx-${leaf}` : `--nx-${group}-${leaf}`;
}

const ALIAS = /^\{([^}]+)\}$/;
const aliasOf = (node: TokenNode) => String(node.$value).match(ALIAS)?.[1];

function resolve(path: string, theme: NexusTheme): string {
  const node = byPath.get(path)!;
  const raw = String(node.$extensions?.["nexus.themeOverrides"]?.[theme] ?? node.$value);
  const target = raw.match(ALIAS)?.[1];
  return target ? resolve(target, theme) : raw;
}

/** The primitive an alias chain ends at: semantic.fg.accent → primitive.colour.acid. */
function rootOf(path: string): string {
  const target = aliasOf(byPath.get(path)!);
  return target ? rootOf(target) : path;
}

const pathByName = new Map([...byPath.keys()].map((p) => [cssName(p), p]));

function scaleFactor(name: string, theme: NexusTheme): number {
  const path = pathByName.get(`--nx-${name}`);
  return path ? Number(resolve(path, theme)) : 1;
}

export const TOKENS: readonly Token[] = [...byPath].map(([path, node]) => {
  const [layer, group] = path.split(".") as [Layer, string];
  const values = Object.fromEntries(THEMES.map((t) => [t, resolve(path, t)])) as Record<
    NexusTheme,
    string
  >;
  const scaleBy = node.$extensions?.["nexus.scaleBy"];
  const px = scaleBy
    ? (Object.fromEntries(
        THEMES.map((t) => [t, Number.parseFloat(values[t]) * 16 * scaleFactor(scaleBy, t)]),
      ) as Record<NexusTheme, number>)
    : undefined;
  const alias = aliasOf(node);
  const differs = (r: Record<NexusTheme, string | number>) =>
    THEMES.some((t) => r[t] !== r[DEFAULT_THEME]);

  return {
    path,
    layer,
    group,
    name: cssName(path),
    type: node.$type ?? "",
    description: node.$description,
    alias: alias ? cssName(alias) : undefined,
    values,
    px,
    themed: differs(values) || (px ? differs(px) : false),
    decorative: node.$extensions?.["nexus.contrast"] === "decorative",
    referencedBy: [...byPath]
      .filter(([, other]) => aliasOf(other) === path)
      .map(([p]) => cssName(p)),
  };
});

export const tokensIn = (layer: Layer, ...groups: string[]) =>
  TOKENS.filter((t) => t.layer === layer && groups.includes(t.group));

export const tokenByName = (name: string) => TOKENS.find((t) => t.name === name);

/**
 * Contrast against --nx-bg-surface, from the table the token build computes.
 * Only opaque palette colours have one; a translucent wash or a non-colour
 * returns undefined.
 */
export function contrastOf(token: Token, theme: NexusTheme): number | undefined {
  const leaf = rootOf(token.path).split(".").pop()!;
  return (contrast[theme] as Record<string, number>)[leaf];
}

/**
 * The typed accessor @nexus-cyberdeck/tokens exports for this token, if any —
 * what a TypeScript consumer writes instead of the raw `var()`.
 */
export function accessorOf(token: Token): string | undefined {
  const leaf = token.name.replace(/^--nx-/, "");
  const after = (prefix: string) => leaf.slice(prefix.length);
  if (token.layer === "semantic") {
    if (token.group === "fg") return `tone("${after("fg-")}")`;
    if (token.group === "bg") return `surface("${after("bg-")}")`;
    if (token.group === "border") return `border("${after("border-")}")`;
    return undefined;
  }
  switch (token.group) {
    case "space":
      return `space(${after("space-")})`;
    case "text":
      return `text("${after("text-")}")`;
    case "track":
      return `track("${after("track-")}")`;
    case "font":
      return `font.${after("font-")}`;
    case "shape":
      return `shape.${leaf}`;
    case "effect":
      return leaf.startsWith("glow-") ? `elevation.${after("glow-")}` : undefined;
    case "motion":
      return leaf.startsWith("dur-") ? `duration("${after("dur-")}")` : `motion.${leaf}`;
    default:
      return undefined;
  }
}

/* -------------------------------------------------------- component layer */

export interface ComponentToken {
  name: string;
  /** The fallback the component uses when nothing sets the token. */
  fallback: string;
}

export interface ComponentLayer {
  /** Component → the --nx-* hooks it reads with a fallback. */
  hooks: Map<string, ComponentToken[]>;
  /** Global token → the components whose CSS references it. */
  usedBy: Map<string, string[]>;
}

/**
 * Every `var(--nx-x, fallback)` in a component's CSS is a component token: a
 * hook a consumer sets on any ancestor to restyle that component without
 * forking it. The fallback is a semantic token or a literal, and may itself
 * contain a `var()`, so arguments are split by paren depth rather than regex.
 */
export function parseComponentCss(files: Record<string, string>): ComponentLayer {
  const globals = new Set(TOKENS.map((t) => t.name));
  const hooks = new Map<string, ComponentToken[]>();
  const usedBy = new Map<string, Set<string>>();

  for (const [file, rawCss] of Object.entries(files)) {
    const component = file.split("/").slice(-2, -1)[0]!;
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const own = new Map<string, string>();

    for (let i = css.indexOf("var("); i !== -1; i = css.indexOf("var(", i + 4)) {
      let depth = 0;
      let end = i + 4;
      for (; end < css.length; end++) {
        if (css[end] === "(") depth++;
        else if (css[end] === ")") {
          if (depth === 0) break;
          depth--;
        }
      }
      const body = css.slice(i + 4, end);
      const comma = body.indexOf(",");
      const name = (comma === -1 ? body : body.slice(0, comma)).trim();
      if (!name.startsWith("--nx-")) continue;

      if (globals.has(name)) {
        if (!usedBy.has(name)) usedBy.set(name, new Set());
        usedBy.get(name)!.add(component);
      } else if (comma !== -1 && !own.has(name)) {
        own.set(
          name,
          body
            .slice(comma + 1)
            .trim()
            .replace(/\s+/g, " "),
        );
      }
    }

    if (own.size) {
      hooks.set(
        component,
        [...own].map(([name, fallback]) => ({ name, fallback })),
      );
    }
  }

  return {
    hooks: new Map([...hooks].sort(([a], [b]) => a.localeCompare(b))),
    usedBy: new Map([...usedBy].map(([k, v]) => [k, [...v].sort()])),
  };
}
