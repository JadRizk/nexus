import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Legend } from "./Legend.js";

describe("Legend", () => {
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

  it("renders nothing but an empty container when given no groups", () => {
    const { container } = render(<Legend groups={[]} />);
    expect(container.querySelectorAll("fieldset")).toHaveLength(0);
  });
});
