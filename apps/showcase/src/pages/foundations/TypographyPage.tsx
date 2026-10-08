import { BlinkCursor, SectionHeading, Wordmark } from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";

export function TypographyPage() {
  return (
    <Spec
      name="Typography"
      note="Six sizes and four tracking values, down from eleven and thirteen in the prototype.
            Sizes are in rem so browser zoom and user font-size preferences work — WCAG 1.4.4."
      code={`<Wordmark>NEXUS</Wordmark>\n<SectionHeading>/// section</SectionHeading>`}
    >
      <Row gap="var(--nx-space-7)" align="flex-end">
        <Wordmark>NEXUS</Wordmark>
        <div>
          <SectionHeading>/// section heading</SectionHeading>
          <div style={{ color: "var(--nx-fg-default)" }}>
            default body text <BlinkCursor />
          </div>
        </div>
      </Row>
      <div style={{ marginTop: "var(--nx-space-5)" }}>
        {(["default", "muted", "subtle", "tertiary", "disabled"] as const).map((t) => (
          <div
            key={t}
            style={{
              color: `var(--nx-fg-${t})`,
              letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase",
              padding: "1px 0",
            }}
          >
            {t} — the quick brown fox jumps over the lazy dog
          </div>
        ))}
      </div>
    </Spec>
  );
}
