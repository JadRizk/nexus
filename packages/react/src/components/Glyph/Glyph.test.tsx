import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GLYPH_SHAPES, Glyph } from "./Glyph.js";

/* ============================================================================
   The glyph set is what satisfies WCAG 1.4.1 — category is carried by shape,
   never by colour alone. That only holds if the silhouettes are actually
   different from one another, which is a property of the rendered geometry
   rather than of the props.
   ========================================================================== */

const geometry = (el: HTMLElement) =>
  [...el.querySelectorAll("circle,polygon,rect")]
    .map((n) => n.tagName + (n.getAttribute("points") ?? n.getAttribute("r") ?? ""))
    .join();

describe("Glyph", () => {
  it("draws six mutually distinct silhouettes", () => {
    const shapes = GLYPH_SHAPES.map((shape) => {
      const { container } = render(<Glyph shape={shape} />);
      return geometry(container);
    });
    expect(shapes).toHaveLength(6);
    expect(new Set(shapes).size).toBe(6);
  });

  it("is announced as an image when it carries meaning", () => {
    const { container } = render(<Glyph shape="hexagon" title="Atlas" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Atlas");
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("is hidden from assistive tech when it is decorative", () => {
    const { container } = render(<Glyph shape="hexagon" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("prefers a semantic tone over a raw colour when both are given", () => {
    const { container } = render(<Glyph shape="circle" tone="critical" colour="#123456" />);
    expect(container.querySelector("g")).toHaveAttribute("fill", "var(--nx-fg-critical)");
  });

  it("muted overrides both, and drops the glow", () => {
    const { container } = render(<Glyph shape="circle" tone="critical" muted />);
    expect(container.querySelector("g")).toHaveAttribute("fill", "var(--nx-fg-disabled)");
    expect(container.querySelector("svg")).toHaveStyle({ filter: "none" });
  });

  it("draws the ring as a stroke rather than a fill", () => {
    // The ring is the one shape that cannot be a filled path and still read as
    // a ring, so it takes a different branch worth covering.
    const { container } = render(<Glyph shape="ring" />);
    const circle = container.querySelector("circle")!;
    expect(circle).toHaveAttribute("fill", "none");
    expect(circle).toHaveAttribute("stroke-width", "2.1");
  });
});
