import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HazardRule } from "./HazardRule.js";

describe("HazardRule", () => {
  it("is purely decorative and says so", () => {
    const { container } = render(<HazardRule />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a height and opacity", () => {
    // Passed through as component tokens: the value is per-instance, the rule
    // that uses it is not.
    const { container } = render(<HazardRule height={9} opacity={0.5} />);
    expect(container.firstElementChild).toHaveStyle({
      "--nx-hazard-height": "9px",
      "--nx-hazard-opacity": "0.5",
    });
  });
});
