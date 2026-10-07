import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { KeyValue } from "./KeyValue.js";

describe("KeyValue", () => {
  it("forwards a ref to the row", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<KeyValue ref={ref} label="NODES" value={200} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(container.firstElementChild);
  });

  it("renders both halves and keeps digits on a tabular grid", () => {
    render(<KeyValue label="NODES" value={200} />);
    // Label and value are separately classed so the stylesheet can give the
    // value tabular figures — which is why a column of these does not jitter
    // as the numbers change.
    expect(screen.getByText("NODES")).toHaveClass("nx-kv__label");
    expect(screen.getByText("200")).toHaveClass("nx-kv__value");
  });

  it("renders a value of zero rather than swallowing it as falsy", () => {
    render(<KeyValue label="DEGREE" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
