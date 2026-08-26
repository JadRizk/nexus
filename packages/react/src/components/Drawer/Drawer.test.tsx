import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Drawer } from "./Drawer.js";

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
