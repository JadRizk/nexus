import type { CSSProperties } from "react";
import { SectionHeading } from "@nexus-cyberdeck/react";
import { Spec } from "../../components/Spec.js";
import { COMPONENT_LAYER } from "../../tokens/componentCss.js";
import { contrastOf, THEME_META, tokenByName, tokensIn } from "../../tokens/model.js";
import type { NexusTheme } from "@nexus-cyberdeck/tokens";
import {
  BlinkSample,
  BorderSample,
  DurationSample,
  EaseSample,
  FocusSample,
  GlowSample,
  None,
  ShapeSample,
  SpaceSample,
  SplitSample,
  Swatch,
  TextSample,
} from "../../tokens/previews.js";
import { componentHref, CopyName, TokenTable } from "../../tokens/TokenTable.js";

const surface = tokenByName("--nx-bg-surface")!.values["hud-aa"];
const floors = THEME_META["hud-aa"].wcag!;

// The intro's claims about the text roles, computed rather than typed, so the
// sentence cannot disagree with the table under it.
const fgRoles = tokensIn("semantic", "fg");
const ratiosIn = (theme: NexusTheme) =>
  fgRoles.flatMap((t) => {
    const r = contrastOf(t, theme);
    return r === undefined ? [] : [{ name: t.name, r }];
  });
const lowestAA = ratiosIn("hud-aa").reduce((a, b) => (b.r < a.r ? b : a));
const belowInHud = ratiosIn("hud").filter((x) => x.r < floors.text).length;

export function ColourPage() {
  return (
    <>
      <TokenTable
        caption="Text & icon roles"
        intro={
          <>
            What components colour text and glyphs with. Contrast is measured against the panel
            surface ({surface}). In the AA theme the lowest role is <code>{lowestAA.name}</code> at{" "}
            {lowestAA.r.toFixed(2)}:1
            {lowestAA.r >= floors.text ? `, so every role clears ${floors.text}:1` : ""}; in the HUD
            theme {belowInHud} {belowInHud === 1 ? "role falls" : "roles fall"} below it.
          </>
        }
        tokens={fgRoles}
        preview={TextSample}
        contrast="text"
      />
      <TokenTable
        caption="Surfaces"
        intro="Backgrounds, from the page ground up. The hover and active washes are translucent
               acid, so they tint whatever surface they sit on."
        tokens={tokensIn("semantic", "bg")}
        preview={Swatch}
      />
      <TokenTable
        caption="Borders"
        intro={`The hairline is decorative and exempt; a boundary that identifies a control uses
                the strong border, held to ${floors.nonText}:1.`}
        tokens={tokensIn("semantic", "border")}
        preview={BorderSample}
        contrast="non-text"
      />
      <TokenTable
        caption="Focus ring"
        intro="Applied once, globally, to every :focus-visible element. No component can remove it."
        tokens={tokensIn("semantic", "focus")}
        preview={FocusSample}
      />
      <TokenTable
        caption="Palette"
        intro="The raw colours. Components never read these; the roles above point at them."
        tokens={tokensIn("primitive", "colour")}
        preview={Swatch}
        contrast="text"
      />
      <TokenTable
        caption="Muted ramp"
        intro="The one part of the palette that changes between themes. Each AA step was solved
               against an exact contrast target rather than picked by eye."
        tokens={tokensIn("primitive", "ramp")}
        preview={Swatch}
        contrast="text"
      />
    </>
  );
}

export function SpacePage() {
  return (
    <>
      <TokenTable
        caption="Spacing"
        intro="A 2px base step. Padding, gaps and margins all come from this scale."
        tokens={tokensIn("primitive", "space")}
        preview={SpaceSample}
      />
      <TokenTable
        caption="Shape"
        intro="Hairline borders, square corners, and the arm length of a panel's corner ticks."
        tokens={tokensIn("primitive", "shape")}
        preview={ShapeSample}
      />
    </>
  );
}

export function MotionPage() {
  const tokens = tokensIn("primitive", "motion");
  return (
    <TokenTable
      caption="Motion"
      intro="Three durations and one curve. Press Play to see a duration on the shared ease.
             Under prefers-reduced-motion every transition collapses to an instant."
      tokens={tokens}
      preview={(t) =>
        t.name === "--nx-ease"
          ? EaseSample(t)
          : t.name === "--nx-blink"
            ? BlinkSample()
            : DurationSample(t)
      }
    />
  );
}

export function DepthPage() {
  return (
    <>
      <TokenTable
        caption="Elevation"
        intro="Depth is glow, not shadow: an inset wash on every panel and a wider halo on a raised one."
        tokens={tokensIn("primitive", "effect")}
        preview={(t) => (t.type === "shadow" ? GlowSample(t) : Swatch(t))}
      />
      <TokenTable
        caption="Stacking"
        intro="The order of the fixed overlays, relative only to one another."
        tokens={tokensIn("primitive", "z")}
        preview={None}
      />
      <TokenTable
        caption="Chromatic split"
        intro="The red and cyan fringe on display type such as the Wordmark."
        tokens={tokensIn("semantic", "split")}
        preview={SplitSample}
      />
      <TokenTable
        caption="CRT layer"
        intro="Read only by the opt-in crt.css overlay, which the header's CRT switch toggles."
        tokens={tokensIn("primitive", "crt")}
        preview={(t) => (t.type === "color" ? Swatch(t) : None())}
      />
    </>
  );
}

const cell: CSSProperties = {
  padding: "var(--nx-space-3) var(--nx-space-4)",
  verticalAlign: "top",
  borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
  overflowWrap: "anywhere",
  fontSize: "var(--nx-text-2xs)",
  lineHeight: 1.7,
};

export function ComponentTokensPage() {
  return (
    <>
      <Spec
        name="Restyling a component"
        note="Every hook has a default, shown below, so setting none of them changes nothing.
              Set one on any ancestor and every instance below it follows. In Button, for one,
              the hover and active states read the same names rather than restating the
              property, so a retheme cannot leave a state behind."
        code={`.my-console {\n  --nx-btn-border: var(--nx-border-strong);\n  --nx-panel-padding: var(--nx-space-6);\n}`}
      >
        <div style={{ color: "var(--nx-fg-subtle)", lineHeight: "var(--nx-leading-body)" }}>
          Read from each component's stylesheet: {COMPONENT_LAYER.hooks.size} components expose{" "}
          {[...COMPONENT_LAYER.hooks.values()].reduce((n, h) => n + h.length, 0)} hooks.
        </div>
      </Spec>

      {[...COMPONENT_LAYER.hooks].map(([component, hooks]) => {
        const href = componentHref(component);
        return (
          <section
            key={component}
            data-spec={`${component} tokens`}
            style={{ marginBottom: "var(--nx-space-8)" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <caption style={{ textAlign: "left" }}>
                <SectionHeading as="span">
                  ///{" "}
                  {href ? (
                    <a href={href} style={{ color: "inherit" }}>
                      {component}
                    </a>
                  ) : (
                    component
                  )}
                </SectionHeading>
              </caption>
              <colgroup>
                <col style={{ width: "45%" }} />
                <col />
              </colgroup>
              <thead>
                <tr style={{ color: "var(--nx-fg-tertiary)", textAlign: "left" }}>
                  <th scope="col" style={cell}>
                    TOKEN
                  </th>
                  <th scope="col" style={cell}>
                    DEFAULT
                  </th>
                </tr>
              </thead>
              <tbody>
                {hooks.map((h) => (
                  <tr key={h.name}>
                    <th scope="row" style={{ ...cell, textAlign: "left", fontWeight: "normal" }}>
                      <code style={{ color: "var(--nx-fg-default)" }}>{h.name}</code>
                      <CopyName name={h.name} />
                    </th>
                    <td style={{ ...cell, color: "var(--nx-fg-subtle)" }}>
                      <code>{h.fallback}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}
