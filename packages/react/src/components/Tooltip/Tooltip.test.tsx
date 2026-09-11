import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Tooltip } from "./Tooltip.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("Tooltip", () => {
  it("forwards a ref to the tooltip", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Tooltip ref={ref} x={0} y={0}>tidal_aperture</Tooltip>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("tooltip"));
  });

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

  it("accepts an id, so a subject can reference it with aria-describedby", () => {
    render(<Tooltip id="node-42-tip" x={0} y={0}>tidal_aperture</Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveAttribute("id", "node-42-tip");
  });

  it("long content wraps rather than truncating", () => {
    // jsdom applies no stylesheet (see STYLING.md — "What the tests assert"),
    // so this can't be asserted by measuring layout: a class-styled element
    // renders with no box model at all here. Instead this reads the
    // declared rule straight out of Tooltip.css and asserts the properties
    // that make text wrap at max-width rather than run past it or truncate:
    // white-space must not be nowrap, and a max-width must be declared. The
    // browser suite (browser/) is what proves this renders correctly against
    // a real engine.
    const css = readFileSync(join(here, "Tooltip.css"), "utf8");
    const rule = css.match(/\.nx-tooltip\s*\{([^}]*)\}/)?.[1];
    expect(rule, ".nx-tooltip rule not found in Tooltip.css").toBeTruthy();
    expect(rule).toMatch(/max-width\s*:\s*[^;]+;/);
    expect(rule).not.toMatch(/white-space\s*:\s*nowrap\s*;/);
    expect(rule).not.toMatch(/text-overflow\s*:\s*ellipsis\s*;/);
    expect(rule).toMatch(/white-space\s*:\s*normal\s*;/);
  });
});
