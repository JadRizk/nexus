import { BlinkCursor } from "@nexus-cyberdeck/react";

export function InlineWithText() {
  return (
    <div style={{ color: "var(--nx-fg-default)" }}>
      default body text <BlinkCursor />
    </div>
  );
}

export function CustomChar() {
  return (
    <div style={{ color: "var(--nx-fg-accent)" }}>
      awaiting input <BlinkCursor char="_" />
    </div>
  );
}
