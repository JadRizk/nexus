import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LinkGlyph } from "./LinkGlyph.js";

describe("LinkGlyph", () => {
  it("encodes relation type by dash pattern and arrowhead, not colour alone", () => {
    const solid = render(<LinkGlyph />).container;
    expect(solid.querySelector("path")).not.toHaveAttribute("stroke-dasharray");
    expect(solid.querySelector("polygon")).toBeNull();

    const dashed = render(<LinkGlyph dashed arrow />).container;
    expect(dashed.querySelector("path")).toHaveAttribute("stroke-dasharray", "2.2 1.9");
    expect(dashed.querySelector("polygon")).not.toBeNull();
  });

  it("takes a semantic tone", () => {
    const { container } = render(<LinkGlyph tone="warning" />);
    expect(container.querySelector("path")).toHaveAttribute("stroke", "var(--nx-fg-warning)");
  });

  it("is decorative unless given a title", () => {
    expect(render(<LinkGlyph />).container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const titled = render(<LinkGlyph title="Cites" />).container.querySelector("svg")!;
    expect(titled).toHaveAttribute("role", "img");
    expect(titled).toHaveAccessibleName("Cites");
  });
});
