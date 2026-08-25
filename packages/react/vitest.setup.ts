import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL's auto-cleanup only self-registers when it detects Vitest's globals;
// this config deliberately doesn't set `test.globals: true` (explicit
// imports over ambient globals), so cleanup has to be wired by hand or
// every test after the first in a file sees the previous render's DOM too.
afterEach(() => {
  cleanup();
});

// jsdom does no layout, so `offsetParent` is always null — which silently
// breaks useFocusTrap's visibility filter (`el.offsetParent !== null`),
// since every element reads as invisible. This is the standard, widely-used
// workaround rather than a reason to move to full browser-mode testing:
// treat every element as visible by reporting its parent as the offset
// parent, which is all the trap's simple truthy check actually needs.
Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return this.parentNode;
  },
});
