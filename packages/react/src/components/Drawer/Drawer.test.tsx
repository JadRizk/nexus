import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState, version as reactVersion } from "react";
import { Drawer } from "./Drawer.js";
import { inertAttr } from "./inert.js";

const here = dirname(fileURLToPath(import.meta.url));

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

  it("forwards a ref to the dialog node, alongside the internal focus trap", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Drawer ref={ref} open onClose={() => {}} title="Inspector" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("defaults the close button's accessible name to \"Close details\"", () => {
    render(<DrawerHarness />);
    expect(screen.getByRole("button", { name: "Close details" })).toBeInTheDocument();
  });

  it("takes closeLabel as the close button's accessible name", () => {
    render(<Drawer open onClose={() => {}} title="Inspector" closeLabel="Dismiss inspector" />);
    expect(screen.getByRole("button", { name: "Dismiss inspector" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close details" })).not.toBeInTheDocument();
  });

  it("declares a z-index from the shared stacking-order token, not a hardcoded number", () => {
    // jsdom applies no stylesheet, so this reads Drawer.css directly rather
    // than measuring a computed style — same approach as Tooltip.test.tsx.
    // Fixed-position with no z-index at all is what let Drawer's stacking
    // order fall out of whatever the DOM happened to do around it.
    const css = readFileSync(join(here, "Drawer.css"), "utf8");
    const rule = css.match(/\.nx-drawer\s*\{([^}]*)\}/)?.[1];
    expect(rule, ".nx-drawer rule not found in Drawer.css").toBeTruthy();
    expect(rule).toMatch(/z-index\s*:\s*var\(--nx-z-drawer\)\s*;/);
  });
});
