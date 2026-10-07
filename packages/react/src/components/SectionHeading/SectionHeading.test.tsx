import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { SectionHeading } from "./SectionHeading.js";

describe("SectionHeading", () => {
  it("forwards a ref to the div", () => {
    const ref = createRef<HTMLDivElement>();
    render(<SectionHeading ref={ref}>/// subject</SectionHeading>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByText("/// subject"));
  });

  it("renders its children and forwards props", () => {
    render(<SectionHeading id="subject">/// subject</SectionHeading>);
    const heading = screen.getByText("/// subject");
    expect(heading).toHaveAttribute("id", "subject");
  });

  it("renders a span when asked, for phrasing-only parents such as legend", () => {
    render(<SectionHeading as="span">/// subject</SectionHeading>);
    const heading = screen.getByText("/// subject");
    expect(heading.tagName).toBe("SPAN");
    expect(heading).toHaveClass("nx-heading");
  });

  it("is not a heading element, so it never lands in the document outline", () => {
    // Deliberate: these are dense panel labels, not document structure. A
    // screen reader's heading list should not fill up with them.
    render(<SectionHeading>/// subject</SectionHeading>);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
