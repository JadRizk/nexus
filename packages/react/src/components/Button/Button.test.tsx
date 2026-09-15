import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Button } from "./Button.js";

describe("Button", () => {
  it("forwards a ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Isolate</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it('defaults to type="button" so it never submits a surrounding form by accident', () => {
    render(<Button>Isolate</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("exposes its active state to CSS", () => {
    const { rerender } = render(<Button>Isolate</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-active", "0");
    rerender(<Button active>Isolate</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-active", "1");
  });

  it("exposes its active state to assistive tech as aria-pressed", () => {
    const { rerender } = render(<Button active>Isolate</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    rerender(<Button active={false}>Isolate</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("stays a plain button when active is not passed", () => {
    // aria-pressed="false" on a button that is not a toggle announces "toggle
    // button, not pressed" — a control the user can look for and never find.
    // Only a button that was given the prop is a toggle.
    render(<Button>Isolate</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  it("forwards native button props, including disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Isolate</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Isolate</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("merges a caller className with nx-btn instead of replacing it", () => {
    render(<Button className="x">Isolate</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("nx-btn");
    expect(button).toHaveClass("x");
  });
});
