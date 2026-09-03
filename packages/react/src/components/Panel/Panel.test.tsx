import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./Panel.js";

/* ============================================================================
   Panel's corner ticks are drawn by CSS keyed off `data-nx-corners`, so the
   attribute is the whole contract between the component and the stylesheet.
   Getting it wrong is invisible in the DOM and invisible in jsdom — it cost
   this system its signature detail for the entire life of the library, so the
   attribute is asserted exactly.
   ========================================================================== */

describe("Panel", () => {
  it("projects the requested corners as a space-separated attribute", () => {
    render(<Panel corners={["tl", "br"]}>body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-corners", "tl br");
  });

  it("defaults to a two-armed bracket", () => {
    render(<Panel>body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-corners", "tl br");
  });

  it('supports all four corners and the literal "none"', () => {
    const { rerender } = render(<Panel corners={["tl", "tr", "bl", "br"]}>body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-corners", "tl tr bl br");

    rerender(<Panel corners="none">body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-corners", "none");
  });

  it("projects padded and raised as attributes the stylesheet keys off", () => {
    // Appearance is asserted by the visual suite against a real renderer.
    // These assert the contract between the component and its CSS, which is
    // all that is knowable in jsdom — no stylesheet is applied here, so
    // toHaveStyle on a class-styled element would pass for a component with
    // no styling at all.
    const { rerender } = render(<Panel padded={false}>body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-padded", "0");

    rerender(<Panel raised>body</Panel>);
    expect(screen.getByText("body")).toHaveAttribute("data-nx-padded", "1");
    expect(screen.getByText("body")).toHaveAttribute("data-nx-raised", "1");
  });

  it("merges a caller's className rather than replacing its own", () => {
    render(<Panel className="inspector">body</Panel>);
    const panel = screen.getByText("body");
    expect(panel).toHaveClass("nx-panel");
    expect(panel).toHaveClass("inspector");
  });

  it("still forwards an inline style for per-instance layout", () => {
    render(<Panel style={{ width: 280 }}>body</Panel>);
    expect(screen.getByText("body")).toHaveStyle({ width: "280px" });
  });

  it("forwards arbitrary props, so a caller can give it a role or a label", () => {
    render(<Panel role="region" aria-label="Inspector">body</Panel>);
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
  });
});
