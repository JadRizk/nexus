import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button, SectionHeading, useNexus } from "@nexus-cyberdeck/react";
import { WCAG } from "@nexus-cyberdeck/tokens";
import type { NexusTheme } from "@nexus-cyberdeck/tokens";
import { COMPONENT_GROUPS } from "../site.js";
import { COMPONENT_LAYER } from "./componentCss.js";
import { accessorOf, contrastOf, THEMES } from "./model.js";
import type { Token } from "./model.js";

/* ============================================================================
   showcase — TokenTable
   One table per token group. Every cell is read from the token model; the
   only thing a page supplies is how a token of that kind is previewed.
   ========================================================================== */

/** "hud-aa" → "AA", "hud" → "HUD": the labels the header's theme switch uses. */
export const themeLabel = (t: NexusTheme) => (t === "hud-aa" ? "AA" : "HUD");

const small: CSSProperties = { fontSize: "var(--nx-text-2xs)", lineHeight: 1.7 };
const dim: CSSProperties = { ...small, color: "var(--nx-fg-tertiary)" };
const code: CSSProperties = { fontFamily: "var(--nx-font-mono)", color: "var(--nx-fg-default)" };
const link: CSSProperties = { color: "var(--nx-fg-accent)" };

/** Component name → its page, for "read by" links. */
export function componentHref(name: string): string | undefined {
  const page = COMPONENT_GROUPS.flatMap((g) => g.pages).find((p) => p.title === name);
  return page ? `#/${page.path}` : undefined;
}

export function ComponentLinks({ names }: { names: readonly string[] }) {
  return (
    <>
      {names.map((name, i) => {
        const href = componentHref(name);
        return (
          <span key={name}>
            {i > 0 && ", "}
            {href ? (
              <a href={href} style={link}>
                {name}
              </a>
            ) : (
              name
            )}
          </span>
        );
      })}
    </>
  );
}

type Kind = "text" | "non-text";

/** A contrast grade in words as well as colour, so the pass/fail is never colour alone. */
function Grade({ ratio, kind }: { ratio: number; kind: Kind }) {
  const [label, pass] =
    kind === "non-text"
      ? ratio >= WCAG.AA_NON_TEXT
        ? ["meets 3:1", true]
        : ["below 3:1", false]
      : ratio >= WCAG.AAA_TEXT
        ? ["AAA", true]
        : ratio >= WCAG.AA_TEXT
          ? ["AA", true]
          : ratio >= WCAG.AA_LARGE_TEXT
            ? ["AA large only", false]
            : ["below AA", false];
  return (
    <span style={{ color: pass ? "var(--nx-fg-accent)" : "var(--nx-fg-critical)" }}>
      {ratio.toFixed(2)}:1 {label}
    </span>
  );
}

/** Splits a description into its first sentence and the rest. */
function splitDescription(text: string): [string, string] {
  const m = text.match(/^(.+?[.!?])\s+(?=[A-Z])/);
  return m ? [m[1]!, text.slice(m[0].length)] : [text, ""];
}

function ValueCell({ token, kind, theme }: { token: Token; kind?: Kind; theme: NexusTheme }) {
  const perTheme = token.themed;
  const ratios = kind ? THEMES.map((t) => [t, contrastOf(token, t)] as const) : [];
  const hasRatio = ratios.some(([, r]) => r !== undefined);

  const line = (t: NexusTheme | null, body: ReactNode) => (
    <div
      key={t ?? "all"}
      style={{
        ...small,
        color: !t || t === theme ? "var(--nx-fg-default)" : "var(--nx-fg-tertiary)",
      }}
    >
      {t && <span style={{ display: "inline-block", width: 34 }}>{themeLabel(t)}</span>}
      {body}
    </div>
  );

  return (
    <>
      {token.alias && (
        <div style={dim}>
          → <code style={code}>{token.alias}</code>
        </div>
      )}
      {perTheme
        ? THEMES.map((t) =>
            line(
              t,
              <>
                {token.values[t]}
                {token.px && ` · ${+token.px[t].toFixed(2)}px`}
              </>,
            ),
          )
        : line(null, token.values[theme])}
      {token.decorative && <div style={dim}>Decorative — exempt from the 3:1 floor</div>}
      {hasRatio &&
        !token.decorative &&
        (perTheme ? (
          ratios.map(([t, r]) =>
            r === undefined ? null : line(t, <Grade ratio={r} kind={kind!} />),
          )
        ) : (
          <div style={small}>
            <Grade ratio={ratios[0]![1]!} kind={kind!} />
          </div>
        ))}
    </>
  );
}

function NotesCell({ token }: { token: Token }) {
  const [first, rest] = splitDescription(token.description ?? "");
  const readBy = COMPONENT_LAYER.usedBy.get(token.name) ?? [];
  return (
    <>
      {first && <div style={{ ...small, color: "var(--nx-fg-subtle)" }}>{first}</div>}
      {rest && (
        <details style={{ ...small, color: "var(--nx-fg-subtle)" }}>
          {/* 24px tall: the minimum target size, WCAG 2.5.8. */}
          <summary
            style={{ cursor: "pointer", color: "var(--nx-fg-tertiary)", lineHeight: "24px" }}
          >
            More
          </summary>
          {rest}
        </details>
      )}
      {token.referencedBy.length > 0 && (
        <div style={dim}>
          Aliased by{" "}
          {token.referencedBy.map((n, i) => (
            <span key={n}>
              {i > 0 && ", "}
              <code style={code}>{n}</code>
            </span>
          ))}
        </div>
      )}
      {readBy.length > 0 && (
        <div style={dim}>
          {/* Only stylesheets are scanned: a colour a component applies
              through its tone prop, from TypeScript, does not show here. */}
          In the stylesheets of <ComponentLinks names={readBy} />
        </div>
      )}
    </>
  );
}

export function CopyName({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        aria-label={`Copy ${name}`}
        onClick={() => {
          void navigator.clipboard?.writeText(name).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        style={
          {
            "--nx-btn-padding": "0 var(--nx-space-2)",
            marginLeft: "var(--nx-space-3)",
          } as CSSProperties
        }
      >
        {copied ? "Copied" : "Copy"}
      </Button>
      <span className="nx-sr" aria-live="polite">
        {copied ? `Copied ${name}` : ""}
      </span>
    </>
  );
}

export interface TokenTableProps {
  /** The table's caption, and the data-spec anchor the visual suite uses. */
  caption: string;
  intro?: ReactNode;
  tokens: readonly Token[];
  preview: (token: Token) => ReactNode;
  /** Grade colour tokens against the text or the non-text floor. */
  contrast?: Kind;
}

const th: CSSProperties = {
  ...dim,
  textAlign: "left",
  fontWeight: "var(--nx-weight-medium)" as CSSProperties["fontWeight"],
  letterSpacing: "var(--nx-track-wide)",
  textTransform: "uppercase",
  padding: "var(--nx-space-3) var(--nx-space-4)",
  borderBottom: "var(--nx-hairline) solid var(--nx-border-strong)",
};

const td: CSSProperties = {
  padding: "var(--nx-space-4)",
  verticalAlign: "top",
  borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
  overflowWrap: "anywhere",
};

export function TokenTable({ caption, intro, tokens, preview, contrast }: TokenTableProps) {
  const { theme } = useNexus();
  return (
    <section data-spec={caption} style={{ marginBottom: "var(--nx-space-8)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <caption style={{ textAlign: "left", captionSide: "top" }}>
          <SectionHeading as="span">/// {caption}</SectionHeading>
          {intro && (
            <span
              style={{
                display: "block",
                margin: "var(--nx-space-2) 0 var(--nx-space-4)",
                maxWidth: 640,
                color: "var(--nx-fg-subtle)",
                lineHeight: "var(--nx-leading-body)",
              }}
            >
              {intro}
            </span>
          )}
        </caption>
        <colgroup>
          <col style={{ width: 88 }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "27%" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={th}>
              <span className="nx-sr">Preview</span>
            </th>
            <th scope="col" style={th}>
              Token
            </th>
            <th scope="col" style={th}>
              Value
            </th>
            <th scope="col" style={th}>
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => {
            const accessor = accessorOf(t);
            return (
              <tr key={t.name}>
                <td style={td}>{preview(t)}</td>
                <th scope="row" style={{ ...td, textAlign: "left", fontWeight: "normal" }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <code style={{ ...code, ...small }}>{t.name}</code>
                    <CopyName name={t.name} />
                  </div>
                  {accessor && (
                    <div style={dim}>
                      <code>{accessor}</code>
                    </div>
                  )}
                </th>
                <td style={td}>
                  <ValueCell token={t} kind={contrast} theme={theme} />
                </td>
                <td style={td}>
                  <NotesCell token={t} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
