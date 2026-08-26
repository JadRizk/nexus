import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip } from "./Tooltip.js";

describe("Tooltip", () => {
  it("has a tooltip role and sits where it is told", () => {
    render(<Tooltip x={40} y={12}>tidal_aperture</Tooltip>);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveStyle({ left: "40px", top: "12px" });
  });

  it("keys its accent bar off the tone", () => {
    render(<Tooltip x={0} y={0} tone="critical">unresolved</Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveStyle({
      "--nx-tooltip-accent": "var(--nx-fg-critical)",
    });
  });

  it("carries the class its styling hangs off", () => {
    // pointer-events, the surface and the type are all in Tooltip.css now;
    // the visual suite is what proves they arrive.
    render(<Tooltip x={0} y={0}>tidal_aperture</Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveClass("nx-tooltip");
  });
});
