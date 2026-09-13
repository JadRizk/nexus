import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Legend } from "./Legend.js";

describe("Legend", () => {
  it("forwards a ref to the container", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<Legend ref={ref} groups={[]} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(container.firstElementChild);
  });

  it("binds each group heading to its rows with a real fieldset", () => {
    // A heading that merely sits above a set of checkboxes is not associated
    // with them; a fieldset/legend pair is what a screen reader announces as
    // the group name when focus enters a row.
    render(
      <Legend
        groups={[
          { title: "entity class", rows: <input type="checkbox" aria-label="ATLAS" /> },
          { title: "relation", rows: <input type="checkbox" aria-label="LINK" /> },
        ]}
      />,
    );
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAccessibleName(/entity class/i);
    expect(groups[1]).toHaveAccessibleName(/relation/i);
  });

  it("keeps each legend's content to phrasing content", () => {
    // <legend> accepts phrasing content only. A <div> in there is invalid
    // HTML, and a parser that acts on that moves the title out of the legend
    // — which takes the group's accessible name with it.
    const { container } = render(
      <Legend groups={[{ title: "entity class", rows: <input type="checkbox" aria-label="ATLAS" /> }]} />,
    );
    const legend = container.querySelector("legend")!;
    expect(legend.querySelectorAll("div")).toHaveLength(0);
    expect(legend.querySelector("span.nx-heading")).not.toBeNull();
  });

  it("renders nothing but an empty container when given no groups", () => {
    const { container } = render(<Legend groups={[]} />);
    expect(container.querySelectorAll("fieldset")).toHaveLength(0);
  });
});
