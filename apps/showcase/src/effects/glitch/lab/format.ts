/** A knob's slider readout: whole numbers from 10 up, three decimals below. */
export function formatKnob(value: number): string {
  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(3);
}

/** The colour of the frame-rate readout: accent above 50 fps, warning above 28, critical below. */
export function fpsTone(fps: number): string {
  if (fps > 50) return "var(--nx-fg-accent)";
  if (fps > 28) return "var(--nx-fg-warning)";
  return "var(--nx-fg-critical)";
}

/** The integration example under an event, firing `eventId` on a failed request. */
export function integrationSnippet(eventId: string): string {
  return `// on route change
glitch.fire("boot");

// on failed request
glitch.fire("${eventId}");

// on cascading failure
glitch.chain([[0,"dropout"],
  [0.12,"corrupt"],[0.34,"signal"]]);`;
}
