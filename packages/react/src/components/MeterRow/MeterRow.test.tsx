import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MeterRow } from "./MeterRow.js";

describe("MeterRow", () => {
  it("forwards a ref to the row", () => {
    const ref = createRef<HTMLDivElement>();
    render(<MeterRow ref={ref} label="LINK" value={5} total={7} tone="info" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("meter").parentElement);
  });

  it("is a real meter with a composed label, not a decorative div", () => {
    render(<MeterRow label="LINK" value={5} total={7} tone="info" />);
    const meter = screen.getByRole("meter", { name: "LINK: 5 of 7" });
    expect(meter).toHaveAttribute("aria-valuenow", "5");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "7");
  });

  it("clamps a value above the total instead of overflowing the bar", () => {
    render(<MeterRow label="LINK" value={12} total={7} tone="info" />);
    const fill = screen.getByRole("meter").firstElementChild!;
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("survives a total of zero rather than dividing by it", () => {
    // An empty category is a real state — a node with no relations at all.
    render(<MeterRow label="LINK" value={0} total={0} tone="info" />);
    const fill = screen.getByRole("meter").firstElementChild!;
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("clamps a negative value to zero", () => {
    render(<MeterRow label="LINK" value={-3} total={7} tone="info" />);
    expect(screen.getByRole("meter").firstElementChild!).toHaveStyle({ width: "0%" });
  });

  it("accepts a raw colour for a category the token system does not name", () => {
    render(<MeterRow label="LINK" value={1} total={2} colour="#3AC6D4" />);
    // The colour reaches the bar, the label and the glow through one component
    // token, so they cannot disagree about which category this row is.
    expect(screen.getByRole("meter").parentElement).toHaveStyle({
      "--nx-meter-fg": "#3AC6D4",
    });
  });
});
