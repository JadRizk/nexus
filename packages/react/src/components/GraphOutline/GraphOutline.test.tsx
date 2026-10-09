import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { GraphOutline } from "./GraphOutline.js";
import type { GraphOutlineData } from "./GraphOutline.js";

const data: GraphOutlineData = {
  summary: "Graph, 3 nodes, 2 connections in 2 kinds.",
  groups: [
    {
      categoryId: "note",
      label: "NOTE",
      nodes: [
        {
          id: "n1",
          label: "alpha",
          description: "alpha, note, 2 connections",
          connections: [
            { relation: "cites", id: "s1", label: "archive-1", kind: "source" },
            { relation: "tagged with", id: "t1", label: "#tag", kind: "tag" },
          ],
        },
      ],
    },
    {
      categoryId: "source",
      label: "SOURCE",
      nodes: [
        {
          id: "s1",
          label: "archive-1",
          description: "archive-1, source, 1 connection",
          connections: [{ relation: "cited by", id: "n1", label: "alpha", kind: "note" }],
        },
      ],
    },
  ],
};

describe("GraphOutline", () => {
  it("forwards a ref to the outline's section", () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(<GraphOutline ref={ref} data={data} />);
    expect(ref.current).toBe(container.firstElementChild);
  });

  it("is a named region with the summary and one headed section per category", () => {
    render(<GraphOutline data={data} label="Sample graph as a list" />);
    const outline = screen.getByRole("region", { name: "Sample graph as a list" });
    expect(within(outline).getByText(data.summary)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "NOTE (1)",
      "SOURCE (1)",
    ]);
    expect(screen.getByRole("region", { name: /NOTE/ })).toBeInTheDocument();
  });

  it("names each node with the sentence a screen reader hears on the canvas", () => {
    render(<GraphOutline data={data} />);
    expect(
      screen.getByText("alpha", { selector: "summary span" }).closest("summary"),
    ).toHaveAccessibleName("alpha, note, 2 connections");
  });

  it("lists connections as relation, far node and kind", () => {
    render(<GraphOutline data={data} />);
    const list = screen.getByRole("list", { name: "Connections of alpha" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["cites archive-1 source", "tagged with #tag tag"]);
  });

  it("opens and focuses the far node's entry when its name is activated", async () => {
    render(<GraphOutline data={data} />);
    const source = screen.getByText("archive-1", { selector: "summary span" }).closest("details")!;
    expect(source.open).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "archive-1" }));
    expect(source.open).toBe(true);
    expect(source.querySelector("summary")).toHaveFocus();
  });

  it("offers selection when onSelect is given, and marks the selected node", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<GraphOutline data={data} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button", { name: "Select in graph" });
    await userEvent.click(buttons[1]!);
    expect(onSelect).toHaveBeenCalledWith("s1");

    rerender(<GraphOutline data={data} onSelect={onSelect} selectedId="s1" />);
    const selected = screen.getByRole("button", { name: "Selected in graph" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected.closest("details")!.open).toBe(true);
    expect(selected.closest("details")!.querySelector("summary")).toHaveAccessibleName(
      "archive-1, source, 1 connection, selected",
    );
  });

  it("offers no select buttons without onSelect", () => {
    render(<GraphOutline data={data} />);
    expect(screen.queryByRole("button", { name: /in graph/ })).toBeNull();
  });

  it("sets the heading level", () => {
    render(<GraphOutline data={data} headingLevel={2} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("keeps ids unique and valid whatever the node ids are", () => {
    const odd: GraphOutlineData = {
      summary: "",
      groups: [
        {
          categoryId: "x",
          label: "X",
          nodes: [
            { id: 'a b"c', label: "spaced", description: "d", connections: [] },
            { id: 7, label: "numeric", description: "d", connections: [] },
          ],
        },
      ],
    };
    const { container } = render(<GraphOutline data={odd} />);
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).not.toMatch(/[\s"]/);
  });
});
