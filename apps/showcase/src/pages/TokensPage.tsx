import { useNexus } from "@nexus/react";
import { contrast, themeMeetsAA, WCAG } from "@nexus/tokens";
import { PageHeader, Row, Spec } from "../components/Spec.js";

const SIGNATURE = [
  ["acid", "--nx-fg-accent"],
  ["data", "--nx-fg-info"],
  ["lime", "unassigned"],
  ["sodium", "--nx-fg-warning"],
  ["violet", "unassigned"],
  ["alarm", "--nx-fg-critical"],
  ["phosphor", "--nx-fg-default"],
] as const;

const RAMP = ["grey-100", "grey-200", "grey-300", "grey-400", "grey-500", "grey-600"] as const;

export function TokensPage() {
  const { theme } = useNexus();
  const c = contrast[theme];
  const meetsAA = themeMeetsAA(theme);

  return (
    <>
      <PageHeader
        title="Tokens"
        lede={`Three layers — primitive, semantic, component. Components may reference only the
              semantic layer, so switching theme (currently "${theme}") never touches component
              code. Every figure below is read live from @nexus/tokens, not hand-copied.`}
      />

      <Spec
        name="Signature colours"
        note="Identical in both themes — acid, data, lime, sodium, violet, alarm and phosphor
              all already clear AA, which is why the accessible theme needed no redesign. Only
              the muted ramp had to move."
        code={`import { contrast } from "@nexus/tokens";\ncontrast["${theme}"].acid // ${c.acid}`}
      >
        <Row gap="var(--nx-space-6)">
          {SIGNATURE.map(([key, alias]) => (
            <div key={key} style={{ width: 108 }}>
              <div
                style={{
                  height: 40,
                  background: `var(--nx-${key})`,
                  boxShadow: `0 0 12px var(--nx-${key})`,
                }}
              />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-default)", fontSize: "var(--nx-text-2xs)" }}>
                {key}
              </div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>
                {c[key as keyof typeof c]}:1
              </div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{alias}</div>
            </div>
          ))}
        </Row>
      </Spec>

      <Spec
        name="Muted ramp"
        note={
          theme === "hud-aa"
            ? "Lifted, AA-compliant. Hue 100°, saturation 13%, binary-searched per step against exact contrast targets."
            : "The prototype's original ramp. Ships only where an operator opts into an immersive, non-AA surface."
        }
      >
        <Row gap="var(--nx-space-6)">
          {RAMP.map((step) => (
            <div key={step} style={{ width: 96 }}>
              <div style={{ height: 40, background: `var(--nx-${step})` }} />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-default)", fontSize: "var(--nx-text-2xs)" }}>
                {step}
              </div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{c[step]}:1</div>
            </div>
          ))}
        </Row>
      </Spec>

      <Spec
        name="AA compliance"
        note={`themeMeetsAA() checks disabled text against ${WCAG.AA_TEXT}:1 and UI boundaries against ${WCAG.AA_NON_TEXT}:1.`}
        code={`import { themeMeetsAA } from "@nexus/tokens";\nthemeMeetsAA("${theme}") // ${meetsAA}`}
      >
        <div style={{ color: meetsAA ? "var(--nx-fg-accent)" : "var(--nx-fg-critical)" }}>
          "{theme}" {meetsAA ? "meets" : "does not meet"} AA body contrast.
        </div>
      </Spec>
    </>
  );
}
