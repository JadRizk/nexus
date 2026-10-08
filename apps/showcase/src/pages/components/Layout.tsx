import { BlinkCursor, HazardRule, Panel, SectionHeading, Wordmark } from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";

export function PanelPage() {
  return (
    <Spec
      name="Panel"
      note="The signature surface: hairline border, zero radius, inset acid glow, and corner
            ticks drawn as pseudo-elements. Two arms read as a bracket; four read as a box —
            a meaningfully different signal, so the corners are configurable."
      code={`<Panel corners={["tl", "br"]} raised>…</Panel>`}
    >
      <Row align="stretch">
        <Panel corners={["tl", "br"]} style={{ width: 150 }}>
          tl · br
        </Panel>
        <Panel corners={["tl", "tr", "bl", "br"]} style={{ width: 150 }}>
          all four
        </Panel>
        <Panel corners="none" style={{ width: 150 }}>
          none
        </Panel>
        <Panel corners={["tl", "br"]} raised style={{ width: 150 }}>
          raised
        </Panel>
      </Row>
    </Spec>
  );
}

export function HazardRulePage() {
  return (
    <Spec
      name="HazardRule"
      note="A decorative divider, hidden from assistive tech. It separates chrome from content;
            it never carries meaning on its own."
      code={`<HazardRule />\n<HazardRule height={8} opacity={0.5} />`}
    >
      <HazardRule />
      <HazardRule height={8} opacity={0.5} style={{ marginTop: "var(--nx-space-5)" }} />
    </Spec>
  );
}

export function SectionHeadingPage() {
  return (
    <Spec
      name="SectionHeading"
      note="A dense panel label. Deliberately not a heading element — these are chrome, not
            document structure, and a screen reader's heading list should not fill up with them."
      a11y='Inside a <legend>, pass as="span": a legend takes phrasing content only.'
      code={`<SectionHeading>/// relation profile</SectionHeading>`}
    >
      <SectionHeading>/// relation profile</SectionHeading>
      <SectionHeading>/// adjacency [7]</SectionHeading>
    </Spec>
  );
}

export function WordmarkPage() {
  return (
    <Spec
      name="Wordmark"
      note="Stencil display type with a chromatic split and a forward skew. Reserved for the
            product name; it is not a heading style."
      code={`<Wordmark>NEXUS</Wordmark>\n<Wordmark size="var(--nx-text-xl)" skew={0}>NEXUS</Wordmark>`}
    >
      <Row gap="var(--nx-space-7)" align="flex-end">
        <Wordmark>NEXUS</Wordmark>
        <Wordmark size="var(--nx-text-xl)" skew={0}>
          NEXUS
        </Wordmark>
      </Row>
    </Spec>
  );
}

export function BlinkCursorPage() {
  return (
    <Spec
      name="BlinkCursor"
      note="Blinks at ~0.94Hz. The rate is capped by the --nx-blink token rather than the
            component, so no consumer can turn it into a flash."
      a11y="WCAG 2.3.1 (Level A) prohibits flashing above 3Hz; the prototype blinked at 9Hz.
            Under prefers-reduced-motion the animation stops."
      code={`<span>awaiting input <BlinkCursor /></span>`}
    >
      <div style={{ color: "var(--nx-fg-default)" }}>
        awaiting input <BlinkCursor />
      </div>
    </Spec>
  );
}
