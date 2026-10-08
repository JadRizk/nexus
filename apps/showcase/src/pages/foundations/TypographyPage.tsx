import { BlinkCursor, SectionHeading, Wordmark } from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";
import { tokenByName, tokensIn } from "../../tokens/model.js";

// Read from the token rather than typed, so the intro moves with the scale.
const scale = tokenByName("--nx-font-scale")!.values;
const scaleUp = Math.round((Number(scale["hud-aa"]) / Number(scale.hud) - 1) * 100);
import {
  FontSample,
  LeadingSample,
  None,
  SizeSample,
  TrackSample,
  WeightSample,
} from "../../tokens/previews.js";
import { TokenTable } from "../../tokens/TokenTable.js";

export function TypographyPage() {
  return (
    <>
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
      <TokenTable
        caption="Type scale"
        intro={`Sizes are rem multiplied by the theme's font scale, so the AA theme sets every size
               ${scaleUp}% larger than HUD, and browser zoom still applies on top.`}
        tokens={tokensIn("primitive", "text")}
        preview={SizeSample}
      />
      <TokenTable caption="Font scale" tokens={tokensIn("primitive", "scale")} preview={None} />
      <TokenTable caption="Families" tokens={tokensIn("primitive", "font")} preview={FontSample} />
      <TokenTable
        caption="Tracking"
        tokens={tokensIn("primitive", "track")}
        preview={TrackSample}
      />
      <TokenTable
        caption="Weights"
        tokens={tokensIn("primitive", "weight")}
        preview={WeightSample}
      />
      <TokenTable
        caption="Leading"
        tokens={tokensIn("primitive", "leading")}
        preview={LeadingSample}
      />
    </>
  );
}
