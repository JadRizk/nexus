import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, expect, it } from "vitest";

/* ============================================================================
   Where the decorative hairline may be used.

   `--nx-border-default` resolves to grey-100, 1.61:1 against the panel, and is
   exempt from WCAG 1.4.11's 3:1 non-text floor through `nexus.contrast:
   "decorative"` in tokens.json. That exemption is only sound while nothing is
   *identified* by the hairline alone: a control with a text label and visible
   state changes does not need its border to be seen, and a container or a
   divider is not a control. A control whose only boundary is this token (a
   text field with no border of its own, say) would be a real failure.

   So the uses are a reviewed list. Adding one fails this test until the new
   entry is written down with the reason it does not identify anything; use
   `--nx-border-strong` (3:1) for a boundary that does.
   ========================================================================== */

const components = join(dirname(fileURLToPath(import.meta.url)), "components");

const REVIEWED: Record<string, string> = {
  "Button/.nx-btn":
    "Text-labelled control. Identified by its label; hover and active change colour and fill.",
  'Button/.nx-btn:is(:disabled, [aria-disabled="true"]):hover':
    "Resets a disabled button's hover back to the resting hairline. Disabled controls are exempt.",
  "TabStrip/.nx-tabstrip":
    "Outline of a group of text-labelled tabs. The selected tab is an inverted accent block.",
  "Panel/.nx-panel": "Non-interactive container.",
  "Tooltip/.nx-tooltip": "Non-interactive, transient text.",
  "Drawer/.nx-drawer__header": "Divider between regions that already have their own edges.",
  "Drawer/.nx-drawer__footer": "Divider between regions that already have their own edges.",
  "CommandPalette/.nx-palette__hints": "Divider above a decorative, aria-hidden key legend.",
  "GraphOutline/.nx-graph-outline__node":
    "Divider between list entries. Each entry is identified by its text label; the disclosure's own focus ring marks focus.",
};

/** `Component/selector` for every rule in a component's stylesheet that reads the token. */
function usesOfDecorativeHairline(): string[] {
  const found: string[] = [];
  for (const dir of readdirSync(components)) {
    const file = join(components, dir, `${dir}.css`);
    if (!existsSync(file)) continue;
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (body.includes("--nx-border-default")) {
        found.push(`${dir}/${selector.trim().replace(/\s+/g, " ")}`);
      }
    }
  }
  return found.sort();
}

describe("the decorative hairline (--nx-border-default)", () => {
  it("is only used where it identifies nothing", () => {
    const unreviewed = usesOfDecorativeHairline().filter((use) => !(use in REVIEWED));
    expect(
      unreviewed,
      `${unreviewed.join(", ")} read --nx-border-default, which is 1.61:1 and exempt from the ` +
        "WCAG 1.4.11 non-text floor. If this rule draws a boundary that identifies a control, use " +
        "--nx-border-strong. If it is a container or divider, add it to REVIEWED with the reason.",
    ).toEqual([]);
  });

  it("has no stale entries in the reviewed list", () => {
    const current = new Set(usesOfDecorativeHairline());
    const stale = Object.keys(REVIEWED).filter((use) => !current.has(use));
    expect(stale, "entries in REVIEWED that no longer use the token").toEqual([]);
  });

  it("gives the search field, the one boundary that identifies a control, the 3:1 token", () => {
    const css = readFileSync(join(components, "CommandPalette", "CommandPalette.css"), "utf8");
    const rule = css.match(/\.nx-palette__field\s*\{([^}]*)\}/);
    assert(rule, "CommandPalette.css has a .nx-palette__field rule");
    const field = rule[1];
    expect(field).toContain("--nx-border-strong");
    expect(field).not.toContain("--nx-border-default");
  });
});
