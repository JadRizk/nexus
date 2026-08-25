import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { CommandPalette, Drawer } from "./overlays.js";

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

/* ============================================================================
   Drawer — role=dialog, hidden from assistive tech while closed, Escape
   dismisses via the shared focus trap.
   ========================================================================== */

function DrawerHarness() {
  const [open, setOpen] = useState(true);
  return (
    <Drawer open={open} onClose={() => setOpen(false)} title="Inspector">
      <button data-testid="inside">inside</button>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("is a labelled, modal dialog while open", () => {
    render(<DrawerHarness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Inspector");
  });

  it("closes on Escape", () => {
    render(<DrawerHarness />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    // aria-hidden="true" is exactly why a plain getByRole("dialog") can no
    // longer find it post-close — it's correctly dropped from the a11y tree.
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });
});
