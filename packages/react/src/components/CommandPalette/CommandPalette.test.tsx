import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { CommandPalette } from "./CommandPalette.js";

const ITEMS = [
  { id: 1, label: "atlas_prime" },
  { id: 2, label: "atlas_relay" },
  { id: 3, label: "vector_null" },
];

/* ============================================================================
   CommandPalette — the ARIA combobox pattern: input owns
   aria-activedescendant, results are a real listbox, count is announced.
   ========================================================================== */

describe("CommandPalette", () => {
  it("clamps cursor to a valid index if results repopulate for the same query", () => {
    // The specific regression this guards: End on an empty result list used
    // to leave the cursor at -1, so if `items` changed to a non-empty set for
    // the same query (an async results update), Enter would silently do
    // nothing until an arrow key was pressed. The cursor is clamped on read
    // now, so it cannot be left out of range however the list changes size.
    const onSelect = vi.fn();
    const { rerender } = render(
      <CommandPalette open onClose={() => {}} items={[]} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "End" });

    rerender(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
  });

  it("wires the input to the listbox and announces the result count", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    const list = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(screen.getByRole("status")).toHaveTextContent("3 results");
  });

  it("defaults the dialog's accessible name to the placeholder", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("SEARCH");
  });

  it("takes label as the dialog's accessible name, independent of placeholder", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        placeholder="FIND NODE"
        label="Node search"
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Node search");
    // The input's own accessible name is still driven by the placeholder,
    // not by `label` — the two are deliberately independent.
    expect(screen.getByRole("combobox")).toHaveAccessibleName("FIND NODE");
  });

  it("takes resultsLabel as a fixed string for the live-region announcement", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        resultsLabel="Matches updated"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Matches updated");
  });

  it("takes resultsLabel as a formatter called with the result count", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        resultsLabel={(count) => `${count} matches found`}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("3 matches found");
  });

  it("moves aria-activedescendant with ArrowDown and selects that option on Enter", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[1]!.id);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("filters as the query changes and announces zero results", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        emptyLabel="NO MATCH"
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("NO MATCH")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 results");
  });

  it("renders nothing while closed", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={() => {}} items={ITEMS} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("forwards a ref to the dialog surface", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CommandPalette ref={ref} open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole("dialog"));
  });

  it("closes when the scrim is pressed, but not when the dialog is", () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={ITEMS} onSelect={() => {}} />);

    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves the active option to the one the pointer enters", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const options = screen.getAllByRole("option");

    fireEvent.mouseEnter(options[2]!);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", options[2]!.id);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("selects an option on mousedown without letting the input lose focus", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);

    // preventDefault on mousedown is what keeps focus on the input; fireEvent
    // returns false when the default was prevented.
    const notPrevented = fireEvent.mouseDown(screen.getAllByRole("option")[1]!);
    expect(notPrevented).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });

  it("clamps ArrowUp at the first option and ArrowDown at the last", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);

    for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[2]!.id);
  });

  it("jumps to the first option on Home and the last on End", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "End" });
    expect(input).toHaveAttribute("aria-activedescendant", options[2]!.id);
    fireEvent.keyDown(input, { key: "Home" });
    expect(input).toHaveAttribute("aria-activedescendant", options[0]!.id);
  });

  it("does nothing on Enter when there are no results", () => {
    const onSelect = vi.fn();
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("returns to the first option whenever the query changes", () => {
    render(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "End" });
    fireEvent.change(input, { target: { value: "atlas" } });
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0]!.id);
  });

  it("clears the query and the cursor each time it reopens", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={() => setOpen((o) => !o)}>toggle</button>
          <CommandPalette open={open} onClose={() => {}} items={ITEMS} onSelect={() => {}} />
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "atlas" } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });

    fireEvent.click(screen.getByText("toggle"));
    fireEvent.click(screen.getByText("toggle"));

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0]!.id);
  });

  it("renders renderMeta, the category code and the glyph on each row", () => {
    const items = [
      { id: 1, label: "atlas_prime", code: "ATL", shape: "hexagon" as const, colour: "#C6F135" },
      { id: 2, label: "vector_null" },
    ];
    const { container } = render(
      <CommandPalette
        open
        onClose={() => {}}
        items={items}
        onSelect={() => {}}
        renderMeta={(it) => <span data-testid="meta">{`#${it.id}`}</span>}
      />,
    );
    expect(screen.getAllByTestId("meta").map((n) => n.textContent)).toEqual(["#1", "#2"]);
    expect(screen.getByText("ATL")).toHaveStyle({ "--nx-palette-code-fg": "#C6F135" });
    // Only the row that declares a shape draws a glyph.
    expect(container.querySelectorAll(".nx-palette__option svg")).toHaveLength(1);
  });

  it("takes width and a custom hint row", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        width={400}
        hint={[["TAB", "NEXT"]]}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveStyle({ "--nx-palette-width": "400px" });
    expect(screen.getByText("TAB NEXT")).toBeInTheDocument();
    expect(screen.queryByText("ESC CLOSE")).not.toBeInTheDocument();
  });
});

describe("CommandPalette when items change while open", () => {
  it("currently leaves no option active after ArrowDown on no results, then items arrive", () => {
    // Pins today's behaviour: ArrowDown on an empty list stores -1. Logged as a bug on #91.
    const { rerender } = render(
      <CommandPalette open onClose={() => {}} items={[]} onSelect={() => {}} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });

    rerender(<CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input).not.toHaveAttribute("aria-activedescendant");
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
  });

  it("keeps the active option on the last result when items shrink under the cursor", () => {
    const { rerender } = render(
      <CommandPalette open onClose={() => {}} items={ITEMS} onSelect={() => {}} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "End" });

    rerender(
      <CommandPalette open onClose={() => {}} items={ITEMS.slice(0, 1)} onSelect={() => {}} />,
    );
    const [onlyOption] = screen.getAllByRole("option");
    expect(onlyOption).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", onlyOption?.id);
  });
});
