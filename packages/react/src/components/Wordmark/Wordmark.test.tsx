import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "./Wordmark.js";

describe("Wordmark", () => {
  it("passes the shear through as a component token", () => {
    const { rerender } = render(<Wordmark>NEXUS</Wordmark>);
    expect(screen.getByText("NEXUS")).toHaveStyle({ "--nx-wordmark-skew": "-9deg" });
    rerender(<Wordmark skew={0}>NEXUS</Wordmark>);
    expect(screen.getByText("NEXUS")).toHaveStyle({ "--nx-wordmark-skew": "0deg" });
  });

  it("takes a per-instance size", () => {
    render(<Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>);
    expect(screen.getByText("NEXUS")).toHaveStyle({ "--nx-wordmark-size": "var(--nx-text-lg)" });
  });
});
