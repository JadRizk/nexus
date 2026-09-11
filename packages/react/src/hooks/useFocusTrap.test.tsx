import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { RefObject } from "react";
import { useFocusTrap } from "./useFocusTrap.js";

/* ============================================================================
   useFocusTrap — the hook Drawer and CommandPalette both share. This is,
   per its own comment, "the single most-often-botched part of a design
   system," so it gets tested directly rather than only through the
   components that consume it.
   ========================================================================== */

function TrapHarness({ onDismiss }: { onDismiss: () => void }) {
  const [active, setActive] = useState(true);
  const ref = useFocusTrap<HTMLDivElement>(active, () => {
    onDismiss();
    setActive(false);
  });
  return (
    <div>
      <button data-testid="outside">outside</button>
      {/* The cast below is for the same reason as the one in
          Drawer.tsx/CommandPalette.tsx: RefObject<T | null> only structurally
          matches a DOM ref prop under @types/react 19, not 18. */}
      {active && (
        <div ref={ref as RefObject<HTMLDivElement>} data-testid="trap" tabIndex={-1}>
          <button data-testid="first">first</button>
          <button data-testid="second">second</button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first focusable element as soon as it activates", () => {
    render(<TrapHarness onDismiss={() => {}} />);
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("wraps Tab from the last element back to the first", () => {
    render(<TrapHarness onDismiss={() => {}} />);
    screen.getByTestId("second").focus();
    fireEvent.keyDown(screen.getByTestId("trap"), { key: "Tab" });
    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    render(<TrapHarness onDismiss={() => {}} />);
    fireEvent.keyDown(screen.getByTestId("trap"), { key: "Tab", shiftKey: true });
    expect(screen.getByTestId("second")).toHaveFocus();
  });

  // The path the unit test used to leave uncovered: focus leaves by a pointer
  // click rather than by Tab, which the node-level keydown handler never
  // sees. userEvent, not fireEvent, because only the former actually moves
  // focus to what it clicks — fireEvent.click dispatches the event and
  // nothing else, which would make these pass against the old trap too.
  describe("after a pointer click outside", () => {
    it("pulls focus back to the element that last held it inside", async () => {
      const user = userEvent.setup();
      render(<TrapHarness onDismiss={() => {}} />);
      screen.getByTestId("second").focus();

      await user.click(screen.getByTestId("outside"));
      expect(screen.getByTestId("second")).toHaveFocus();
    });

    it("still dismisses on Escape", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<TrapHarness onDismiss={onDismiss} />);

      await user.click(screen.getByTestId("outside"));
      await user.keyboard("{Escape}");
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("keeps Tab inside the trap", async () => {
      const user = userEvent.setup();
      render(<TrapHarness onDismiss={() => {}} />);

      await user.click(screen.getByTestId("outside"));
      await user.tab();
      expect(screen.getByTestId("second")).toHaveFocus();
      await user.tab();
      expect(screen.getByTestId("first")).toHaveFocus();
    });

    it("falls back to the first focusable when the last-focused element is gone", async () => {
      const user = userEvent.setup();
      function Shrinking() {
        const [extra, setExtra] = useState(true);
        const ref = useFocusTrap<HTMLDivElement>(true);
        return (
          <div>
            <button data-testid="outside">outside</button>
            <div ref={ref as RefObject<HTMLDivElement>} tabIndex={-1}>
              <button data-testid="first">first</button>
              {extra && (
                <button data-testid="extra" onClick={() => setExtra(false)}>extra</button>
              )}
            </div>
          </div>
        );
      }
      render(<Shrinking />);
      // Clicking "extra" focuses it and then unmounts it, so the trap's
      // memory of where focus was points at a detached node.
      await user.click(screen.getByTestId("extra"));
      expect(screen.queryByTestId("extra")).toBeNull();

      await user.click(screen.getByTestId("outside"));
      expect(screen.getByTestId("first")).toHaveFocus();
    });

    it("ignores focus that lands on a non-element target", () => {
      // A focusin whose target is the document itself (some browsers fire one
      // when the window regains focus) must be a no-op, not a crash.
      render(<TrapHarness onDismiss={() => {}} />);
      fireEvent.focusIn(document);
      expect(screen.getByTestId("first")).toHaveFocus();
    });
  });

  it("lets only the most recently activated trap guard the document", async () => {
    // A palette opened over a drawer: both traps are active at once. If both
    // enforced the guard, each would pull focus back into its own node from
    // inside the other's focusin handler and the two would recurse until the
    // stack overflowed. The newest wins; when it goes, the older resumes.
    const user = userEvent.setup();
    function Stacked() {
      const [inner, setInner] = useState(false);
      const outerRef = useFocusTrap<HTMLDivElement>(true);
      const innerRef = useFocusTrap<HTMLDivElement>(inner, () => setInner(false));
      return (
        <div>
          <button data-testid="outside">outside</button>
          <div ref={outerRef as RefObject<HTMLDivElement>} tabIndex={-1}>
            <button data-testid="outer-btn" onClick={() => setInner(true)}>open inner</button>
          </div>
          {inner && (
            <div ref={innerRef as RefObject<HTMLDivElement>} tabIndex={-1}>
              <button data-testid="inner-btn">inner</button>
            </div>
          )}
        </div>
      );
    }
    render(<Stacked />);
    expect(screen.getByTestId("outer-btn")).toHaveFocus();

    await user.click(screen.getByTestId("outer-btn"));
    expect(screen.getByTestId("inner-btn")).toHaveFocus();

    // The outer trap must not fight the inner one for focus.
    await user.click(screen.getByTestId("outside"));
    expect(screen.getByTestId("inner-btn")).toHaveFocus();

    // Inner closes: focus restores to its opener, and the outer trap is the
    // one guarding again.
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("outer-btn")).toHaveFocus();
    await user.click(screen.getByTestId("outside"));
    expect(screen.getByTestId("outer-btn")).toHaveFocus();
  });

  it("calls onDismiss on Escape and restores focus to whatever opened it", () => {
    const onDismiss = vi.fn();
    function Wrapper() {
      const [open, setOpen] = useState(false);
      const ref = useFocusTrap<HTMLDivElement>(open, () => {
        onDismiss();
        setOpen(false);
      });
      return (
        <div>
          <button data-testid="opener" onClick={() => setOpen(true)}>open</button>
          {open && (
            <div ref={ref as RefObject<HTMLDivElement>} tabIndex={-1} data-testid="trap">
              <button data-testid="inner">inner</button>
            </div>
          )}
        </div>
      );
    }
    render(<Wrapper />);
    screen.getByTestId("opener").focus();
    fireEvent.click(screen.getByTestId("opener"));
    expect(screen.getByTestId("inner")).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId("trap"), { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.getByTestId("opener")).toHaveFocus();
  });
});
