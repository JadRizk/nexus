import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button.js";

describe("Button", () => {
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
