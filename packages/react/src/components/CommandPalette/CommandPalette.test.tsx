import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette.js";

const ITEMS = [
  { id: 1, label: "atlas_prime" },
  { id: 2, label: "atlas_relay" },
  { id: 3, label: "vector_null" },
];

/* ============================================================================
   CommandPalette — the ARIA combobox pattern: input owns
   aria-activedescendant, results are a real listbox, count is announced.
   ========================================================================== */

describe("CommandPalette", () => {
  it("wires the input to the listbox and announces the result count", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    const list = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(screen.getByRole("status")).toHaveTextContent("3 results");
  });

  it("moves aria-activedescendant with ArrowDown and selects that option on Enter", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[1]!.id);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("filters as the query changes and announces zero results", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} emptyLabel="NO MATCH" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("NO MATCH")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 results");
  });

  it("renders nothing while closed", () => {
    const { container } = render(<CommandPalette open={false} onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
