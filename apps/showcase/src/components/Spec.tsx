import type { CSSProperties, ReactNode } from "react";
import { HazardRule, Panel, SectionHeading } from "@nexus-cyberdeck/react";

/* ============================================================================
   showcase — Spec, Row, PageHeader
   Small layout helpers the showcase pages use to present one primitive at a
   time: a live example, a rationale note, an a11y callout, and a code sample.
   These are showcase-only scaffolding, not part of @nexus-cyberdeck/react.
   ========================================================================== */

export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <header style={{ marginBottom: "var(--nx-space-8)" }}>
      <h1
        style={{
          margin: 0,
          color: "var(--nx-fg-default)",
          fontFamily: "var(--nx-font-mono)",
          fontSize: "var(--nx-text-xl)",
          letterSpacing: "var(--nx-track-normal)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          maxWidth: 640,
          marginTop: "var(--nx-space-3)",
          color: "var(--nx-fg-subtle)",
          lineHeight: "var(--nx-leading-body)",
        }}
      >
        {lede}
      </p>
      <HazardRule style={{ marginTop: "var(--nx-space-5)" }} />
    </header>
  );
}

export interface SpecProps {
  name: string;
  note?: string;
  a11y?: string;
  code?: string;
  children: ReactNode;
}

export function Spec({ name, note, a11y, code, children }: SpecProps) {
  return (
    // `data-spec` is the anchor the visual regression suite locates each
    // example by. Screenshotting a named example rather than a whole page
    // keeps a diff pointed at the component that actually changed, instead of
    // failing every test whenever a paragraph above it reflows.
    <section data-spec={name} style={{ marginBottom: "var(--nx-space-8)" }}>
      <SectionHeading>/// {name}</SectionHeading>
      <Panel style={{ marginTop: "var(--nx-space-2)" }}>{children}</Panel>
      {note && (
        <p
          style={{
            marginTop: "var(--nx-space-3)",
            color: "var(--nx-fg-tertiary)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.7,
          }}
        >
          {note}
        </p>
      )}
      {a11y && (
        <p
          style={{
            marginTop: "var(--nx-space-2)",
            color: "var(--nx-fg-info)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ letterSpacing: "var(--nx-track-wide)" }}>A11Y — </strong>
          {a11y}
        </p>
      )}
      {code && (
        <pre
          style={{
            marginTop: "var(--nx-space-3)",
            padding: "var(--nx-space-4)",
            overflowX: "auto",
            background: "var(--nx-bg-surface)",
            border: "var(--nx-hairline) solid var(--nx-border-default)",
            color: "var(--nx-fg-subtle)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.7,
          }}
        >
          <code>{code}</code>
        </pre>
      )}
    </section>
  );
}

export function Row({
  children,
  gap = "var(--nx-space-4)",
  align = "center",
}: {
  children: ReactNode;
  gap?: string;
  align?: CSSProperties["alignItems"];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: align }}>{children}</div>
  );
}
