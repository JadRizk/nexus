import { afterEach, describe, expect, it, vi } from "vitest";
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
    // jsdom reports no platform, so `mod` is Ctrl here.
    fireEvent.keyDown(field, { key: "k", ctrlKey: true });
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

  it("fires ctrl+k on ctrlKey specifically, and stays reachable from a focused field", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("ctrl+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire ctrl+k for metaKey alone, unlike mod", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("ctrl+k", handler);
      return null;
    }
    render(<Harness />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires alt+k on altKey, and stays reachable from a focused field", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("alt+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "k", altKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fires meta+k on metaKey specifically, and stays reachable from a focused field", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("meta+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire meta+k for ctrlKey alone, unlike mod", () => {
    const handler = vi.fn();
    function Harness() {
      useHotkey("meta+k", handler);
      return null;
    }
    render(<Harness />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws on an unrecognised combo part", () => {
    function Harness() {
      useHotkey("ctrl+foo+k", () => {});
      return null;
    }
    // Swallow the (expected) React error-boundary console noise for this render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/unrecognised combo part "foo"/);
    spy.mockRestore();
  });
});

/* --------------------------------------------------------------------------
   `mod`: Cmd on Apple platforms, Ctrl everywhere else, and only that key.
   jsdom reports no platform, which is the "everywhere else" case; the Apple
   cases stub it.
   -------------------------------------------------------------------------- */

function mount(combo: string) {
  const handler = vi.fn();
  function Harness() {
    useHotkey(combo, handler);
    return null;
  }
  render(<Harness />);
  return handler;
}

const press = (init: KeyboardEventInit) => fireEvent.keyDown(window, { key: "k", ...init });

const stubPlatform = (platform: string) =>
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);

afterEach(() => {
  vi.restoreAllMocks();
  delete (window.navigator as { userAgentData?: unknown }).userAgentData;
});

describe("useHotkey: mod is the platform's key", () => {
  it("is Ctrl on a non-Apple platform, and not Cmd or the Windows/Super key", () => {
    stubPlatform("Win32");
    const handler = mount("mod+k");

    press({ metaKey: true });
    expect(handler).not.toHaveBeenCalled();
    press({ ctrlKey: true, metaKey: true });
    expect(handler).not.toHaveBeenCalled();

    press({ ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(["MacIntel", "MacPPC", "iPhone", "iPad"])(
    "is Cmd on an Apple platform (%s), and not Ctrl",
    (platform) => {
      stubPlatform(platform);
      const handler = mount("mod+k");

      // Ctrl+K is kill-line in a native Mac text field; mod+k must not take it.
      press({ ctrlKey: true });
      expect(handler).not.toHaveBeenCalled();
      press({ ctrlKey: true, metaKey: true });
      expect(handler).not.toHaveBeenCalled();

      press({ metaKey: true });
      expect(handler).toHaveBeenCalledOnce();
    },
  );

  it("prefers userAgentData.platform over the deprecated navigator.platform", () => {
    stubPlatform("Win32");
    Object.defineProperty(window.navigator, "userAgentData", {
      value: { platform: "macOS" },
      configurable: true,
    });
    const handler = mount("mod+k");

    press({ ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    press({ metaKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("stays reachable from a focused text field, so the shortcut that opens a palette closes it", () => {
    stubPlatform("MacIntel");
    const handler = vi.fn();
    function Harness() {
      useHotkey("mod+k", handler);
      return <input data-testid="field" />;
    }
    render(<Harness />);
    const field = screen.getByTestId("field");
    field.focus();

    fireEvent.keyDown(field, { key: "k", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([
    ["Win32", { ctrlKey: true }],
    ["MacIntel", { metaKey: true }],
  ])("combines with alt and shift on %s, each still required exactly", (platform, mod) => {
    stubPlatform(platform);
    const alt = mount("mod+alt+k");
    const shift = mount("mod+shift+k");

    press({ ...mod, altKey: true });
    expect(alt).toHaveBeenCalledOnce();
    expect(shift).not.toHaveBeenCalled();

    press({ ...mod });
    expect(alt).toHaveBeenCalledOnce();

    press({ ...mod, shiftKey: true });
    expect(shift).toHaveBeenCalledOnce();
    expect(alt).toHaveBeenCalledOnce();
  });
});

describe("useHotkey: mod with an explicit ctrl or meta is contradictory", () => {
  it.each([
    ["mod+ctrl+k", /"mod" cannot be combined with "ctrl"/],
    ["mod+meta+k", /"mod" cannot be combined with "meta"/],
    ["ctrl+mod+k", /"mod" cannot be combined with "ctrl"/],
    ["shift+meta+mod+k", /"mod" cannot be combined with "meta"/],
  ])("%s throws", (combo, message) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => mount(combo)).toThrow(message);
    spy.mockRestore();
  });

  it("points at the spelling that does mean both keys", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => mount("mod+ctrl+k")).toThrow(/meta\+ctrl\+k/);
    spy.mockRestore();
  });

  it("meta+ctrl+k is that spelling: both keys, exactly", () => {
    const handler = mount("meta+ctrl+k");

    press({ metaKey: true });
    expect(handler).not.toHaveBeenCalled();
    press({ ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    press({ metaKey: true, ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });
});
