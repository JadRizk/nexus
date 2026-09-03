import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useHotkey } from "./useHotkey.js";

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

  it("still fires a modifier combo while a text field owns focus", () => {
    // The palette this exists for keeps focus in its own input for as long as
    // it is open, so a mod combo that refused to fire while a field is focused
    // could open the palette but never close it again.
    const handler = vi.fn();
    function Harness() {
      useHotkey("mod+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("treats Shift alone as unmodified, since Shift+letter is typing", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("shift+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "K", shiftKey: true });
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
