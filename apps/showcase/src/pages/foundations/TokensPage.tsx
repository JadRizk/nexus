import type { CSSProperties, ReactNode } from "react";
import { Panel, SectionHeading, useNexus } from "@nexus-cyberdeck/react";
import { themeMeetsAA, WCAG } from "@nexus-cyberdeck/tokens";
import { Row, Spec } from "../../components/Spec.js";
import { COMPONENT_LAYER } from "../../tokens/componentCss.js";
import { THEME_META, THEMES, TOKENS } from "../../tokens/model.js";
import { themeLabel } from "../../tokens/TokenTable.js";

const subtle: CSSProperties = {
  color: "var(--nx-fg-subtle)",
  lineHeight: "var(--nx-leading-body)",
};
const code: CSSProperties = { color: "var(--nx-fg-default)" };

const primitives = TOKENS.filter((t) => t.layer === "primitive");
const semantics = TOKENS.filter((t) => t.layer === "semantic");
const hookCount = [...COMPONENT_LAYER.hooks.values()].reduce((n, h) => n + h.length, 0);

// The tokens a theme sets directly, and everything that inherits the change.
const themedRoots = primitives.filter((t) => t.themed && !t.alias && !t.px);
const themedDownstream = TOKENS.filter((t) => t.themed && !themedRoots.includes(t));

function Layer({ name, count, children }: { name: string; count: ReactNode; children: ReactNode }) {
  return (
    <Panel corners={["tl", "br"]} style={{ flex: "1 1 200px" }}>
      <SectionHeading>/// {name}</SectionHeading>
      <div
        style={{
          fontFamily: "var(--nx-font-stencil)",
          fontSize: "var(--nx-text-xl)",
          color: "var(--nx-fg-accent)",
        }}
      >
        {count}
      </div>
      <div style={{ ...subtle, marginTop: "var(--nx-space-3)" }}>{children}</div>
    </Panel>
  );
}

const Arrow = () => (
  <span aria-hidden="true" style={{ color: "var(--nx-fg-tertiary)" }}>
    →
  </span>
);

export function TokensPage() {
  const { theme } = useNexus();
  const meetsAA = themeMeetsAA(theme);

  return (
    <>
      <Spec
        name="Layers"
        note="Lint enforces the boundary between the first two: a component stylesheet that
              references a primitive fails lint. The third layer has no lint of its own;
              it is a set of names each component promises to read."
      >
        <Row align="stretch" gap="var(--nx-space-5)">
          <Layer name="primitive" count={primitives.length}>
            Raw values — the palette, the grey ramp, sizes, durations. Named for what they are (
            <code style={code}>--nx-acid</code>), never read by a component.
          </Layer>
          <Layer name="semantic" count={semantics.length}>
            Roles — text, surface, border, focus. Named for what they are for (
            <code style={code}>--nx-fg-accent</code>). The only colour names a component may use.
          </Layer>
          <Layer name="component" count={hookCount}>
            Hooks across {COMPONENT_LAYER.hooks.size} components (
            <code style={code}>--nx-btn-border</code>). Set one on any ancestor to restyle that
            component without forking it.
          </Layer>
        </Row>
        <div
          style={{
            marginTop: "var(--nx-space-5)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--nx-space-3)",
            alignItems: "center",
            fontSize: "var(--nx-text-2xs)",
          }}
        >
          <span style={{ color: "var(--nx-fg-tertiary)" }}>A hovered Button's border:</span>
          <code style={code}>--nx-acid</code>
          <Arrow />
          <code style={code}>--nx-fg-accent</code>
          <Arrow />
          <code style={code}>--nx-border-accent</code>
          <Arrow />
          <code style={code}>--nx-btn-border</code>
        </div>
      </Spec>

      <Spec
        name="Themes"
        note={`A theme does not restyle components; it re-points ${themedRoots.length} primitives,
               and ${themedDownstream.length} tokens downstream of them follow through the cascade.
               The palette is identical in both, which is why the accessible theme needed no
               redesign.`}
        code={`<NexusProvider theme="hud-aa">…</NexusProvider>\n<div data-nx-theme="hud">…</div>  /* any element, without React */`}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                color: "var(--nx-fg-tertiary)",
                fontSize: "var(--nx-text-2xs)",
                textAlign: "left",
              }}
            >
              <th
                scope="col"
                style={{ padding: "var(--nx-space-2) var(--nx-space-4) var(--nx-space-2) 0" }}
              >
                THEME
              </th>
              <th scope="col" style={{ padding: "var(--nx-space-2) var(--nx-space-4)" }}>
                CONTRAST FLOORS
              </th>
              <th scope="col" style={{ padding: "var(--nx-space-2) var(--nx-space-4)" }}>
                NOTES
              </th>
            </tr>
          </thead>
          <tbody>
            {THEMES.map((t) => {
              const meta = THEME_META[t];
              return (
                <tr key={t} style={{ verticalAlign: "top" }}>
                  <th
                    scope="row"
                    style={{
                      padding: "var(--nx-space-3) var(--nx-space-4) var(--nx-space-3) 0",
                      textAlign: "left",
                      fontWeight: "normal",
                      color: t === theme ? "var(--nx-fg-accent)" : "var(--nx-fg-default)",
                    }}
                  >
                    {themeLabel(t)} <span style={{ color: "var(--nx-fg-tertiary)" }}>“{t}”</span>
                    {meta.default && <div style={{ color: "var(--nx-fg-tertiary)" }}>default</div>}
                  </th>
                  <td style={{ padding: "var(--nx-space-3) var(--nx-space-4)", ...subtle }}>
                    {meta.wcag
                      ? `text ${meta.wcag.text}:1 · non-text ${meta.wcag.nonText}:1, enforced by the token build`
                      : "none declared"}
                  </td>
                  <td style={{ padding: "var(--nx-space-3) var(--nx-space-4)", ...subtle }}>
                    {meta.label}. {meta.note ?? "The accessible default."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ ...subtle, marginTop: "var(--nx-space-4)", fontSize: "var(--nx-text-2xs)" }}>
          Set by the theme:{" "}
          {themedRoots.map((t, i) => (
            <span key={t.name}>
              {i > 0 && ", "}
              <code style={code}>{t.name}</code>
            </span>
          ))}
          .
        </div>
      </Spec>

      <Spec
        name="Using tokens"
        note="Each foundations page lists its tokens with the CSS name, the typed accessor where
              the package exports one, the value in both themes, and which components read it."
        code={`/* CSS — any framework, or none */
.panel-title { color: var(--nx-fg-accent); padding: var(--nx-space-4); }

/* TypeScript — typed handles, so a misspelt name fails to compile */
import { tone, space } from "@nexus-cyberdeck/tokens";
<div style={{ color: tone("accent"), padding: space(4) }} />

/* Restyle one component, everywhere under an ancestor */
.my-console { --nx-btn-border: var(--nx-border-strong); }`}
      >
        <div style={subtle}>
          Reach for a semantic token first. Use a primitive only for things no role covers, and a
          component token only to restyle a component.
        </div>
      </Spec>

      <Spec
        name="AA compliance"
        note={`themeMeetsAA() checks disabled text against ${WCAG.AA_TEXT}:1 and UI boundaries against ${WCAG.AA_NON_TEXT}:1.`}
        code={`import { themeMeetsAA } from "@nexus-cyberdeck/tokens";\nthemeMeetsAA("${theme}") // ${meetsAA}`}
      >
        <div style={{ color: meetsAA ? "var(--nx-fg-accent)" : "var(--nx-fg-critical)" }}>
          "{theme}" {meetsAA ? "meets" : "does not meet"} AA body contrast.
        </div>
      </Spec>
    </>
  );
}
