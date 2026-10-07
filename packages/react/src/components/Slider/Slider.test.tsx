import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Slider } from "./Slider.js";

/* ============================================================================
   Slider stays a native <input type="range"> on purpose: keyboard support,
   touch target size and value announcement come free. These tests are what
   stop it quietly becoming a div.
   ========================================================================== */

describe("Slider", () => {
  const base = { label: "Scanlines", value: 0.5, min: 0, max: 1, step: 0.05 };

  it("is a real range input with its label bound to it", () => {
    render(<Slider {...base} onChange={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Scanlines" });
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "1");
    expect(slider).toHaveAttribute("step", "0.05");
  });

  it("announces the formatted value, not the raw number", () => {
    render(<Slider {...base} onChange={() => {}} format={(v) => `${Math.round(v * 100)}%`} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "50%");
  });

  it("falls back to the raw value when no formatter is given", () => {
    render(<Slider {...base} onChange={() => {}} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "0.5");
  });

  it("reports changes as a number, not a string", () => {
    const onChange = vi.fn();
    render(<Slider {...base} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0.75" } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it("hides the duplicated on-screen readout from assistive tech", () => {
    // The visible number repeats what aria-valuetext already announces;
    // exposing both makes a screen reader say the value twice.
    render(<Slider {...base} onChange={() => {}} format={(v) => `${v}x`} />);
    expect(screen.getByText("0.5x")).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards a ref to the input, not the wrapping field", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Slider {...base} ref={ref} onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByRole("slider"));
  });
});
