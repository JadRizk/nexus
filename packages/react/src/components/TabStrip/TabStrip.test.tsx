import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
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

  it("defaults the tablist's accessible name to \"View\"", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist")).toHaveAccessibleName("View");
  });

  it("takes label as the tablist's accessible name", () => {
    render(
      <TabStrip
        label="Panels"
        value="a"
        onChange={() => {}}
        tabs={[{ value: "a", label: "A" }]}
      />,
    );
    expect(screen.getByRole("tablist")).toHaveAccessibleName("Panels");
  });

  it("forwards a ref to the tablist", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <TabStrip
        ref={ref}
        value="a"
        onChange={() => {}}
        tabs={[{ value: "a", label: "A" }]}
      />,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("tablist"));
  });

  it("binds a tabpanel to a tab via aria-labelledby/aria-controls", () => {
    // TabStrip is a controlled, single-panel pattern: the caller swaps one
    // tabpanel's content rather than mounting one per tab, so every tab's
    // aria-controls points at that one panel id, and the panel's
    // aria-labelledby points back at whichever tab is currently active —
    // both ends of the binding a screen reader needs to announce "tab A,
    // selected, 1 of 2" and treat the panel below as that tab's content.
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <>
          <TabStrip
            id="view-tabs"
            panelId="view-panel"
            value={value}
            onChange={setValue}
            tabs={[{ value: "a", label: "A" }, { value: "b", label: "B" }]}
          />
          <div id="view-panel" role="tabpanel" aria-labelledby={`view-tabs-${value}`}>
            {value}
          </div>
        </>
      );
    }
    render(<Harness />);

    const tabA = screen.getByRole("tab", { name: "A" });
    const tabB = screen.getByRole("tab", { name: "B" });
    const panel = screen.getByRole("tabpanel");

    expect(tabA).toHaveAttribute("id", "view-tabs-a");
    expect(tabA).toHaveAttribute("aria-controls", "view-panel");
    expect(tabB).toHaveAttribute("aria-controls", "view-panel");
    expect(panel).toHaveAttribute("id", "view-panel");
    expect(panel).toHaveAttribute("aria-labelledby", tabA.id);

    fireEvent.click(tabB);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabB.id);
  });

  it("derives each tab's id from useId() when no id prop is given", () => {
    render(
      <TabStrip
        value="a"
        onChange={() => {}}
        tabs={[{ value: "a", label: "A" }]}
      />,
    );
    // No `id` prop was passed, so the base comes from useId() — the exact
    // string is React's own implementation detail, but every tab still gets
    // a real, non-empty id built from it.
    const tab = screen.getByRole("tab", { name: "A" });
    expect(tab.id).toMatch(/.+-a$/);
  });
});
