import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NexusProvider, useNexus } from "./NexusProvider.js";

function Probe() {
  const { theme, crt, setTheme, setCrt } = useNexus();
  return (
    <>
      <span data-testid="state">{`${theme}/${crt ? "on" : "off"}`}</span>
      <button onClick={() => setTheme("hud")}>to hud</button>
      <button onClick={() => setCrt(true)}>crt on</button>
      <button onClick={() => setCrt(false)}>crt off</button>
    </>
  );
}

describe("NexusProvider", () => {
  it("projects theme and CRT as data attributes for CSS to key off", () => {
    const { container } = render(
      <NexusProvider theme="hud" crt={false}>
        <span>child</span>
      </NexusProvider>,
    );
    const root = container.querySelector(".nx-root")!;
    expect(root).toHaveAttribute("data-nx-theme", "hud");
    expect(root).toHaveAttribute("data-nx-crt", "off");
  });

  it("defaults to the accessible theme with CRT on", () => {
    const { container } = render(<NexusProvider><span>child</span></NexusProvider>);
    const root = container.querySelector(".nx-root")!;
    expect(root).toHaveAttribute("data-nx-theme", "hud-aa");
    expect(root).toHaveAttribute("data-nx-crt", "on");
  });

  it("merges a caller's className rather than replacing nx-root", () => {
    const { container } = render(
      <NexusProvider className="app-shell"><span>child</span></NexusProvider>,
    );
    expect(container.querySelector(".nx-root")).toHaveClass("app-shell");
  });

  it("exposes the current theme and setters through context", () => {
    render(
      <NexusProvider>
        <Probe />
      </NexusProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent("hud-aa/on");

    fireEvent.click(screen.getByText("to hud"));
    expect(screen.getByTestId("state")).toHaveTextContent("hud/on");

    fireEvent.click(screen.getByText("crt off"));
    expect(screen.getByTestId("state")).toHaveTextContent("hud/off");
  });

  it("treats theme and crt as initial values only: a prop change on a live provider has no effect", () => {
    const { container, rerender } = render(
      <NexusProvider theme="hud-aa" crt={false}><span>child</span></NexusProvider>,
    );
    rerender(<NexusProvider theme="hud" crt><span>child</span></NexusProvider>);
    const root = container.querySelector(".nx-root")!;
    expect(root).toHaveAttribute("data-nx-theme", "hud-aa");
    expect(root).toHaveAttribute("data-nx-crt", "off");
  });

  it("changes the live theme and crt only through useNexus().setTheme/setCrt, never through the props", () => {
    const { container, rerender } = render(
      <NexusProvider theme="hud-aa" crt={false}>
        <Probe />
      </NexusProvider>,
    );
    const root = container.querySelector(".nx-root")!;
    expect(root).toHaveAttribute("data-nx-theme", "hud-aa");
    expect(root).toHaveAttribute("data-nx-crt", "off");

    // Re-rendering with new props does nothing...
    rerender(
      <NexusProvider theme="hud" crt>
        <Probe />
      </NexusProvider>,
    );
    expect(root).toHaveAttribute("data-nx-theme", "hud-aa");
    expect(root).toHaveAttribute("data-nx-crt", "off");

    // ...but the setters from useNexus() do.
    fireEvent.click(screen.getByText("to hud"));
    expect(root).toHaveAttribute("data-nx-theme", "hud");

    fireEvent.click(screen.getByText("crt on"));
    expect(root).toHaveAttribute("data-nx-crt", "on");
  });
});
