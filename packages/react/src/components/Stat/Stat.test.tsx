import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stat } from "./Stat.js";

describe("Stat", () => {
  it("resolves a tone to the matching semantic custom property", () => {
    render(<Stat label="Conflict" value="2" tone="critical" />);
    expect(screen.getByText("2").parentElement).toHaveStyle({
      "--nx-stat-value-fg": "var(--nx-fg-critical)",
    });
  });

  it("falls back to the default foreground when no tone is given", () => {
    render(<Stat label="Class" value="NODE" />);
    expect(screen.getByText("NODE").parentElement).toHaveStyle({
      "--nx-stat-value-fg": "var(--nx-fg-default)",
    });
  });

  it("renders label and value as given, including a zero", () => {
    render(<Stat label="Degree" value={0} />);
    expect(screen.getByText("Degree")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
