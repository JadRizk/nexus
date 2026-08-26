#!/usr/bin/env node
/* ============================================================================
   Concatenates the per-component stylesheets into the single styles.css this
   package ships.

   The package's contract with a consumer is one plain stylesheet — no bundler
   plugin, no CSS-in-JS runtime, works from a <link> tag. That contract is
   worth keeping, but it used to mean one 226-line file that every component's
   rules shared, so nothing lived next to the component it belonged to.

   Now each component owns its CSS in its own folder and this assembles the
   shipped artefact. Adding a component means adding a file; there is no
   central list to remember to update.

   Order is alphabetical and therefore stable, which is safe here because no
   two components' rules target the same selector — every rule is scoped to
   that component's own `nx-` class. If that ever stops being true, the fix is
   to stop relying on source order rather than to hand-sort this file.
   ========================================================================== */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "src");

const HEADER = `/* ============================================================================
   GENERATED FILE — do not edit.

   Assembled by packages/react/build-styles.mjs from each component's own
   stylesheet (src/components/Panel/Panel.css and so on) plus src/styles.
   Edit the component's stylesheet and run \`npm run build:styles\`.

   Pseudo-elements and pseudo-classes for the parts a component cannot reach
   through an inline \`style\` prop: corner ticks, hover and active states on
   native elements, and the capped blink. Every value here reads from an
   @nexus/tokens custom property — this file owns no colours itself.
   ========================================================================== */
`;

const banner = (title) => {
  const dashes = "-".repeat(Math.max(3, 74 - title.length));
  return `/* ${dashes} ${title} */`;
};

const parts = [];

const componentsDir = join(src, "components");
for (const name of readdirSync(componentsDir).sort()) {
  const file = join(componentsDir, name, `${name}.css`);
  try {
    parts.push([name, readFileSync(file, "utf8").trim()]);
  } catch {
    /* most components need no CSS of their own */
  }
}

const stylesDir = join(src, "styles");
for (const file of readdirSync(stylesDir).sort()) {
  if (!file.endsWith(".css")) continue;
  const body = readFileSync(join(stylesDir, file), "utf8");
  // Drop the part file's own banner; this file supplies one per section.
  const stripped = body.replace(/^\/\*[\s\S]*?\*\/\n+/, "").trim();
  parts.push([file.replace(/\.css$/, ""), stripped]);
}

const out =
  HEADER +
  parts.map(([name, body]) => `\n${banner(name)}\n${body}\n`).join("") ;

writeFileSync(join(src, "styles.css"), out);

console.log(
  `styles.css assembled from ${parts.length} parts — ` +
    parts.map(([n]) => n).join(", "),
);
