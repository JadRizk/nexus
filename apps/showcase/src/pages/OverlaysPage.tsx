import { useState } from "react";
import {
  Button, CommandPalette, Drawer, Glyph, MeterRow, SectionHeading, useHotkey,
} from "@nexus/react";
import type { PaletteItem } from "@nexus/react";
import { PageHeader, Spec, Row } from "../components/Spec.js";
import { ITEMS } from "../data.js";

export function OverlaysPage() {
  const [drawer, setDrawer] = useState(true);
  const [pal, setPal] = useState(false);
  const [picked, setPicked] = useState<PaletteItem>(ITEMS[3]!);

  useHotkey("mod+k", () => setPal((v) => { const next = !v; if (next) setDrawer(false); return next; }));
  useHotkey("/", () => { setPal(true); setDrawer(false); });

  const hex = (((Number(picked.id) * 2654435761) >>> 0) % 65536)
    .toString(16).toUpperCase().padStart(4, "0");

  return (
    <>
      <PageHeader
        title="Overlays"
        lede="Drawer and CommandPalette are where design systems fail accessibility audits —
              focus trapping, focus restoration, escape dismissal, roving focus and live
              announcements all have to be right at once. Both share one focus-trap
              implementation rather than each growing its own."
      />

      <Spec
        name="Drawer"
        note="Slides rather than mounting and unmounting, so the motion reads as one object
              moving instead of two objects swapping. 220ms on a spring curve — long enough to
              read the direction of travel, short enough not to be in the way."
        a11y="role=dialog with aria-modal. Focus is trapped while open and restored to whatever
              opened it on close. Escape dismisses. When closed the subtree is aria-hidden, so a
              screen reader never wanders into offscreen content."
        code={`<Drawer open={open} onClose={close} title="tidal_aperture"\n  subtitle="0x493B · NDE" tone="info"\n  footer={<Button active>Isolate</Button>}>…</Drawer>`}
      >
        <Row>
          <Button active={drawer} onClick={() => setDrawer((d) => !d)}>
            {drawer ? "Close drawer" : "Open drawer"}
          </Button>
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>
            Tab into it, then press Escape — focus returns to this button.
          </span>
        </Row>
      </Spec>

      <Spec
        name="CommandPalette"
        note="Ranking is deliberately not fuzzy: exact, then prefix, then word-start, then
              contains, then class code. In a structured corpus you usually know the beginning
              of what you want, and fuzzy matching mostly produces confident nonsense. An empty
              query returns the highest-weight items, so it doubles as a table of contents."
        a11y="The ARIA combobox pattern. The input never loses focus and owns
              aria-activedescendant; results are a real listbox with role=option; a visually
              hidden live region announces the result count so the update is not silent."
        code={`<CommandPalette open={open} onClose={close} items={ITEMS}\n  onSelect={(item) => { select(item); close(); }} />`}
      >
        <Row>
          <Button onClick={() => setPal(true)}>Open palette</Button>
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>
            ⌘K / Ctrl+K anywhere · try “tid”, “#”, “atl”, or leave it empty
          </span>
        </Row>
        <div style={{ marginTop: "var(--nx-space-4)", color: "var(--nx-fg-subtle)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.8 }}>
          <div>selected → <span style={{ color: picked.colour }}>{picked.label}</span> · 0x{hex}</div>
        </div>
      </Spec>

      <Spec
        name="MeterRow"
        note="A proportional bar with a real role=meter, not a decorative div. Used inside the
              drawer to show relation distribution at a glance."
        a11y="aria-valuenow / valuemin / valuemax with a composed aria-label, so the value is
              announced as '5 of 7' rather than read as an unlabelled graphic."
        code={`<MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />`}
      >
        <div style={{ maxWidth: 320 }}>
          <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
          <MeterRow label="CITE" value={2} total={7} tone="warning" />
          <MeterRow label="CONFLICT" value={1} total={7} tone="critical" />
        </div>
      </Spec>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={picked.label}
        subtitle={`0x${hex} · ${picked.code}`}
        colour={picked.colour}
        icon={<Glyph shape={picked.shape} colour={picked.colour} />}
        footer={<><Button style={{ flex: 1 }}>Focus</Button><Button style={{ flex: 1 }} active>Isolate</Button></>}
      >
        <SectionHeading>/// relation profile</SectionHeading>
        <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
        <MeterRow label="CITE" value={2} total={7} tone="warning" />
        <div style={{ height: "var(--nx-space-5)" }} />
        <SectionHeading>/// adjacency [7]</SectionHeading>
        {ITEMS.slice(3, 10).map((it) => (
          <button
            key={it.id}
            type="button"
            className="nx-row"
            onClick={() => setPicked(it)}
            style={{ width: "100%", background: "none", border: 0, textAlign: "left", paddingLeft: 0 }}
          >
            <span aria-hidden="true" style={{ color: it.colour, width: 8 }}>▸</span>
            <Glyph shape={it.shape} colour={it.colour} size={10} />
            <span style={{
              flex: 1, color: it.colour, textTransform: "uppercase",
              letterSpacing: "var(--nx-track-normal)", overflow: "hidden", textOverflow: "ellipsis",
            }}>{it.label}</span>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{it.code}</span>
          </button>
        ))}
      </Drawer>

      <CommandPalette
        open={pal}
        onClose={() => setPal(false)}
        items={ITEMS}
        onSelect={(it) => { setPicked(it); setDrawer(true); setPal(false); }}
        renderMeta={(it) => (
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", width: 22, textAlign: "right" }}>
            {it.weight}
          </span>
        )}
      />
    </>
  );
}
