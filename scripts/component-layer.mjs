// The component token layer, read from the component stylesheets at build
// time. Consumed by the showcase's Vite config as a virtual module, so the
// token reference ships a few kilobytes of JSON instead of every component's
// raw CSS plus a parser that would run on every page load. The same idea as
// ds-figures.mjs: derive from the code, once, where the code is.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsDir = join(root, "packages/react/src/components");

/**
 * Every `var(--nx-x, fallback)` in a component's CSS is a component token: a
 * hook a consumer sets on any ancestor to restyle that component without
 * forking it. The fallback is a semantic token or a literal, and may itself
 * contain a `var()`, so arguments are split by paren depth rather than regex.
 *
 * @param {Record<string, string>} files  path → CSS; the component is the parent directory name
 * @param {ReadonlySet<string>} globals   the --nx-* names the token package defines
 * @returns {{ hooks: Array<[string, Array<{ name: string, fallback: string }>]>,
 *             usedBy: Array<[string, string[]]> }}
 */
export function parseComponentCss(files, globals) {
  /** @type {Map<string, Array<{ name: string, fallback: string }>>} */
  const hooks = new Map();
  /** @type {Map<string, Set<string>>} */
  const usedBy = new Map();

  for (const [file, rawCss] of Object.entries(files)) {
    const component = file.split(/[\\/]/).slice(-2, -1)[0];
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
    /** @type {Map<string, string>} */
    const own = new Map();

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
        usedBy.get(name).add(component);
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

    if (own.size)
      hooks.set(
        component,
        [...own].map(([name, fallback]) => ({ name, fallback })),
      );
  }

  return {
    hooks: [...hooks].sort(([a], [b]) => a.localeCompare(b)),
    usedBy: [...usedBy].map(([k, v]) => [k, [...v].sort()]),
  };
}

/** The names tokens.css defines — the same set ds-figures.mjs counts. */
function globalTokenNames() {
  const css = readFileSync(join(root, "packages/tokens/src/tokens.css"), "utf8");
  return new Set(Array.from(css.matchAll(/^\s*(--nx-[a-z0-9-]+)\s*:/gm), (m) => m[1]));
}

/** The stylesheet paths the layer is read from, for a watcher to track. */
export function componentCssFiles() {
  return readdirSync(componentsDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(componentsDir, f));
}

/** The whole component layer, from the files on disk. */
export function componentLayer() {
  const files = Object.fromEntries(componentCssFiles().map((f) => [f, readFileSync(f, "utf8")]));
  return parseComponentCss(files, globalTokenNames());
}
