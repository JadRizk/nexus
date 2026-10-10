import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraphCanvas } from "./GraphCanvas.js";
import type { LinkCategory, NodeCategory } from "./types.js";

/* GraphCanvas's real work happens inside a mount effect that boots a WebGL
   context — nothing this suite can do in `node`/jsdom without a real GPU.
   What IS reachable without a browser is the initial render: the forwardRef
   function body runs and returns JSX before any effect fires, so a static
   SSR render sees exactly the root markup a screen reader would encounter
   before/without WebGL succeeding. That's enough to pin the three static
   accessibility fixes from NX-13: the root's role/name and the label layer's
   aria-hidden. The per-label and tooltip aria-hidden calls, and the tooltip
   contrast colour, are set imperatively inside boot() and are only exercised
   by the browser/axe suite (out of reach here — see PR notes). */

const nodeCategories: Record<string, NodeCategory> = {
  topic: {
    label: "TOPIC",
    code: "TOP",
    tier: 0,
    shape: 0,
    color: "#fff",
    size: 1,
    charge: 1,
    mass: 1,
  },
};
const linkCategories: Record<string, LinkCategory> = {};

function renderRoot(ariaLabel?: string, keyboardNavigation?: boolean) {
  const html = renderToStaticMarkup(
    createElement(GraphCanvas, {
      nodes: [{ id: "1", categoryId: "topic", label: "Node One" }],
      edges: [],
      nodeCategories,
      linkCategories,
      ariaLabel,
      ...(keyboardNavigation === undefined ? {} : { keyboardNavigation }),
    }),
  );
  return html;
}

const rootTag = (html: string) => html.slice(0, html.indexOf(">") + 1);

describe("GraphCanvas accessibility (static render)", () => {
  describe("with keyboard navigation (the default)", () => {
    // role="img" would make the focus target inside presentational.
    it("names the root as a group with a graph role description", () => {
      const root = rootTag(renderRoot("Knowledge graph of imported notes"));
      expect(root).toContain('role="group"');
      expect(root).toContain('aria-roledescription="graph"');
      expect(root).toContain('aria-label="Knowledge graph of imported notes"');
      expect(root).not.toContain('role="img"');
    });

    it("makes the root focusable by script only, so Escape can hand focus back to it", () => {
      expect(rootTag(renderRoot("Graph"))).toContain('tabindex="-1"');
    });

    it("renders a navigation layer that assistive tech can see", () => {
      const html = renderRoot("Graph");
      // The aria-hidden label layer plus the navigation layer.
      const layers =
        html.match(/<div[^>]*position:absolute;inset:0;pointer-events:none[^>]*>/g) ?? [];
      expect(layers).toHaveLength(2);
      expect(layers.filter((layer) => layer.includes('aria-hidden="true"'))).toHaveLength(1);
    });
  });

  describe("with keyboardNavigation={false}", () => {
    it('names the root element with role="img" and the ariaLabel prop', () => {
      const root = rootTag(renderRoot("Knowledge graph of imported notes", false));
      expect(root).toContain('role="img"');
      expect(root).toContain('aria-label="Knowledge graph of imported notes"');
      expect(root).not.toContain("tabindex");
    });

    // A nameless role="img" is an axe "role-img-alt" failure (WCAG 2.0 A).
    it("carries no role and no aria-label when ariaLabel is omitted or empty", () => {
      for (const label of [undefined, ""]) {
        const root = rootTag(renderRoot(label, false));
        expect(root).not.toContain("role=");
        expect(root).not.toContain("aria-label=");
      }
    });

    it("renders no navigation layer", () => {
      const layers =
        renderRoot("Graph", false).match(
          /<div[^>]*position:absolute;inset:0;pointer-events:none[^>]*>/g,
        ) ?? [];
      expect(layers).toHaveLength(1);
    });
  });

  it("hides the label layer from assistive tech", () => {
    const html = renderRoot("Graph");
    // The label pool + tooltip both live inside this layer; aria-hidden on
    // its container keeps the whole rotating-text pool out of the
    // accessibility tree regardless of which labels boot() later populates.
    expect(html).toMatch(/aria-hidden="true"/);
  });
});
