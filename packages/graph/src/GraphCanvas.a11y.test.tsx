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
  topic: { label: "TOPIC", code: "TOP", tier: 0, shape: 0, color: "#fff", size: 1, charge: 1, mass: 1 },
};
const linkCategories: Record<string, LinkCategory> = {};

function renderRoot(ariaLabel?: string) {
  const html = renderToStaticMarkup(
    createElement(GraphCanvas, {
      nodes: [{ id: "1", categoryId: "topic", label: "Node One" }],
      edges: [],
      nodeCategories,
      linkCategories,
      ariaLabel,
    }),
  );
  return html;
}

describe("GraphCanvas accessibility (static render)", () => {
  it('names the root element with role="img" and the ariaLabel prop', () => {
    const html = renderRoot("Knowledge graph of imported notes");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Knowledge graph of imported notes"');
  });

  // NX-13 rework: this replaces a prior version of this test that asserted
  // "omits aria-label but keeps role=img" — i.e. it codified the violation
  // as intended behaviour. role="img" with no accessible name is an axe
  // "role-img-alt" failure (WCAG 2.0 A, serious): a screen reader announces
  // "image" with nothing to say what it's an image of, which is worse than
  // the plain, role-less div this component had before. This test asserts
  // the opposite of the old one — the root must carry NEITHER role="img"
  // NOR aria-label when the prop is omitted — and fails immediately if
  // role="img" is restored unconditionally.
  it("carries no role and no aria-label on the root when ariaLabel is omitted", () => {
    const html = renderRoot();
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("aria-label=");
  });

  it("also omits role when ariaLabel is the empty string", () => {
    // An empty label is not a name either — guard the falsy-but-present case
    // so `ariaLabel=""` can't slip a nameless role="img" through the same
    // door as `undefined`.
    const html = renderRoot("");
    expect(html).not.toContain('role="img"');
  });

  it("hides the label layer from assistive tech", () => {
    const html = renderRoot("Graph");
    // The label pool + tooltip both live inside this layer; aria-hidden on
    // its container keeps the whole rotating-text pool out of the
    // accessibility tree regardless of which labels boot() later populates.
    expect(html).toMatch(/aria-hidden="true"/);
  });
});
