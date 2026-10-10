import { Button, Panel, SectionHeading, Stat } from "@nexus-cyberdeck/react";
import { Spec } from "../components/Spec.js";

const GUIDE = "https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md";

export function GetStartedPage() {
  return (
    <>
      <Spec
        name="Install"
        note="Not on npm yet. Until it is, install from npm pack output as the full guide
              describes."
        code={`npm install @nexus-cyberdeck/react @nexus-cyberdeck/tokens`}
      >
        <div style={{ color: "var(--nx-fg-subtle)" }}>
          Two packages: the tokens (plain CSS, usable without React) and the components, which
          depend only on the tokens. React 18.3 or 19.
        </div>
      </Spec>

      <Spec
        name="First panel"
        note="Import the two stylesheets once, wrap the app in NexusProvider, and compose. This is
              the snippet from the README, rendered."
        code={`import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/react/styles.css";
import { NexusProvider, Panel, SectionHeading, Stat, Button } from "@nexus-cyberdeck/react";

export default function App() {
  return (
    <NexusProvider theme="hud-aa">
      <Panel corners={["tl", "br"]} raised style={{ width: 280 }}>
        <SectionHeading>/// subject</SectionHeading>
        <Stat label="Class" value="NODE" tone="info" />
        <Button active>Isolate</Button>
      </Panel>
    </NexusProvider>
  );
}`}
      >
        {/* The snippet's panel, capped so a 320px phone does not push it
            past the edge. */}
        <Panel corners={["tl", "br"]} raised style={{ width: 280, maxWidth: "100%" }}>
          <SectionHeading>/// subject</SectionHeading>
          <Stat label="Class" value="NODE" tone="info" />
          <Button active>Isolate</Button>
        </Panel>
      </Spec>

      <p style={{ color: "var(--nx-fg-subtle)" }}>
        The{" "}
        <a href={GUIDE} style={{ color: "var(--nx-fg-accent)" }}>
          getting-started guide
        </a>{" "}
        goes from here to a command palette and a graph in about ten minutes.
      </p>
    </>
  );
}
