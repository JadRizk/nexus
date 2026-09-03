import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BlinkCursor } from "./BlinkCursor.js";

describe("BlinkCursor", () => {
  it("is decorative and carries the class the capped animation is bound to", () => {
    // The 0.94Hz cap lives on the --nx-blink token and is applied through this
    // class. Losing the class silently removes the cap along with the blink.
    const { container } = render(<BlinkCursor />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("nx-blink");
  });

  it("accepts a different character", () => {
    const { container } = render(<BlinkCursor char="_" />);
    expect(container.firstElementChild).toHaveTextContent("_");
  });
});
