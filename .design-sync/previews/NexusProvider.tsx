import { NexusProvider, Panel, Wordmark } from "@nexus/react";

/** The root wrapper — owns theme state and paints the dark canvas + phosphor
 *  foreground every other component's styling assumes via the `.nx-root` class. */
export function ThemedRoot() {
  return (
    <NexusProvider theme="hud-aa">
      <div style={{ padding: 20 }}>
        <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
        <Panel corners={["tl", "br"]} style={{ marginTop: 12, width: 220 }}>
          hud-aa · default, WCAG AA
        </Panel>
      </div>
    </NexusProvider>
  );
}

export function OriginalTheme() {
  return (
    <NexusProvider theme="hud">
      <div style={{ padding: 20 }}>
        <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
        <Panel corners={["tl", "br"]} style={{ marginTop: 12, width: 220 }}>
          hud · the original PoC aesthetic
        </Panel>
      </div>
    </NexusProvider>
  );
}
