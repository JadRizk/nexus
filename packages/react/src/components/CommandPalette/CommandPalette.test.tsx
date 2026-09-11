import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
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
  it("clamps cursor to a valid index if results repopulate for the same query", () => {
    // The specific regression this guards: End on an empty result list used
    // to leave cursor at -1 with nothing to re-clamp it, so if `items`
    // changed to a non-empty set for the same query (an async results
    // update), Enter would silently do nothing until an arrow key was
    // pressed. `hits` becomes empty here not through the query — the effect
    // under test only fires on `hits.length` changing, not on `query`
    // changing (that path is already covered elsewhere).
    const onSelect = vi.fn();
    const { rerender } = render(
      <CommandPalette open onClose={() => {}} items={[]} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "End" });

    rerender(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

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

  it("forwards a ref to the dialog surface", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CommandPalette ref={ref} open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });
});
