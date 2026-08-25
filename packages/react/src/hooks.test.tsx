import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useFocusTrap, useHotkey } from "./types.js";

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
      {active && (
        <div ref={ref} data-testid="trap" tabIndex={-1}>
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
            <div ref={ref} tabIndex={-1} data-testid="trap">
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

/* ============================================================================
   useHotkey
   ========================================================================== */

describe("useHotkey", () => {
  it("fires on the modifier + key combo it was given", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("mod+k", handler);
      return null;
    }
    render(<Harness />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores an unmodified key while a text field owns focus", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("/", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "/" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("still fires an unmodified key when nothing is focused", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("/", handler);
      return null;
    }
    render(<Harness />);
    fireEvent.keyDown(window, { key: "/" });
    expect(handler).toHaveBeenCalledOnce();
  });
});
