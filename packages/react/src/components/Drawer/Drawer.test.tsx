import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState, version as reactVersion } from "react";
import { Drawer } from "./Drawer.js";
import { inertAttr } from "./inert.js";

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

describe("inertAttr", () => {
  // Only one of these branches is reachable under whichever React the test
  // runner installs, and the unreachable one is exactly the one that broke —
  // React 19 reads `inert=""` as false, drops the attribute and warns, which
  // would leave a closed Drawer aria-hidden but still tabbable.
  it("gives React 18 the empty-string idiom it renders as-is", () => {
    expect(inertAttr("18.3.1")).toBe("");
  });

  it("gives React 19 and later the real boolean", () => {
    expect(inertAttr("19.0.0")).toBe(true);
    expect(inertAttr("19.2.8")).toBe(true);
    expect(inertAttr("20.0.0")).toBe(true);
  });
});

describe("Drawer", () => {
  it("is a labelled, modal dialog while open", () => {
    render(<DrawerHarness />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Inspector");
  });

  it("is inert while closed, in the spelling the running React understands", () => {
    // Both majors in `peerDependencies` are checked by asserting the rendered
    // attribute rather than the prop. React 19 classifies `inert` as boolean
    // and silently drops `inert=""`, which would leave this subtree
    // aria-hidden but still tabbable — so the assertion is on the DOM, which
    // is the only place that difference is visible.
    render(<Drawer open={false} onClose={() => {}} title="Inspector" />);
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toHaveAttribute("aria-hidden", "true");
    expect(dialog).toHaveAttribute("inert");
    if (/^18\./.test(reactVersion)) expect(dialog.getAttribute("inert")).toBe("");
  });

  it("drops inert once open", () => {
    render(<DrawerHarness />);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("inert");
  });

  it("closes on Escape", () => {
    render(<DrawerHarness />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    // aria-hidden="true" is exactly why a plain getByRole("dialog") can no
    // longer find it post-close — it's correctly dropped from the a11y tree.
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });
});
