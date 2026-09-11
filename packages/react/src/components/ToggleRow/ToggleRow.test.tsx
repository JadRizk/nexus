import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { ToggleRow } from "./ToggleRow.js";

describe("ToggleRow", () => {
  it("forwards a ref to the label", () => {
    const ref = createRef<HTMLLabelElement>();
    render(<ToggleRow ref={ref} checked onChange={() => {}} label="ATLAS" />);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current).toBe(screen.getByRole("checkbox").closest("label"));
  });

  it("is a real checkbox, visually hidden but reachable and announced", () => {
    render(<ToggleRow checked onChange={() => {}} label="ATLAS" />);
    const box = screen.getByRole("checkbox", { name: "ATLAS" });
    expect(box).toBeChecked();
    // Visually hidden via a class, not `display: none` — the latter would
    // remove it from the accessibility tree and the tab order entirely.
    expect(box).toHaveClass("nx-sr");
  });

  it("projects checked as a data attribute the stylesheet keys off", () => {
    const { rerender } = render(<ToggleRow checked={false} onChange={() => {}} label="ATLAS" />);
    expect(screen.getByRole("checkbox").closest("label")).toHaveAttribute("data-checked", "0");
    rerender(<ToggleRow checked onChange={() => {}} label="ATLAS" />);
    expect(screen.getByRole("checkbox").closest("label")).toHaveAttribute("data-checked", "1");
  });

  it("reports the new state, not the old one", () => {
    const onChange = vi.fn();
    render(<ToggleRow checked={false} onChange={onChange} label="ATLAS" />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders optional icon and meta content", () => {
    render(
      <ToggleRow
        checked
        onChange={() => {}}
        label="ATLAS"
        icon={<span data-testid="icon" />}
        meta="ATL"
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("ATL")).toBeInTheDocument();
  });

  it("renders a meta value of 0 rather than swallowing it as falsy", () => {
    render(<ToggleRow checked onChange={() => {}} label="ATLAS" meta={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
