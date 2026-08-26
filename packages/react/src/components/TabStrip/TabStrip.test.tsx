import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { TabStrip } from "./TabStrip.js";

function Harness() {
  const [value, setValue] = useState("a");
  return (
    <TabStrip
      value={value}
      onChange={setValue}
      tabs={[{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }]}
    />
  );
}

describe("TabStrip", () => {
  it("marks only the active tab selected, with roving tabindex on the rest", () => {
    render(<Harness />);
    const a = screen.getByRole("tab", { name: "A" });
    const b = screen.getByRole("tab", { name: "B" });
    expect(a).toHaveAttribute("aria-selected", "true");
    expect(a).toHaveAttribute("tabindex", "0");
    expect(b).toHaveAttribute("aria-selected", "false");
    expect(b).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection and DOM focus with ArrowRight, wrapping past the last tab", () => {
    render(<Harness />);
    screen.getByRole("tab", { name: "A" }).focus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "A" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tab", { name: "B" }), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "C" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves backward with ArrowLeft, wrapping before the first tab", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "A" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute("aria-selected", "true");
  });

  it("Home and End jump to the first and last tab", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "B" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "C" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });
});
