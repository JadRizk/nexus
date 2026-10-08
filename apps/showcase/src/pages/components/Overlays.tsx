import { useState } from "react";
import {
  Button,
  CommandPalette,
  Drawer,
  Glyph,
  MeterRow,
  SectionHeading,
  useHotkey,
} from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";
import { ITEMS } from "../../data.js";

const hexOf = (item: PaletteItem) =>
  (((Number(item.id) * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

const hint = {
  color: "var(--nx-fg-tertiary)",
  fontSize: "var(--nx-text-2xs)",
  letterSpacing: "var(--nx-track-wide)",
} as const;

export function DrawerPage() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PaletteItem>(ITEMS[3]!);

  return (
    <>
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
          <Button active={open} onClick={() => setOpen((d) => !d)}>
            {open ? "Close drawer" : "Open drawer"}
          </Button>
          <span style={hint}>Tab into it, then press Escape — focus returns to this button.</span>
        </Row>
      </Spec>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={picked.label}
        subtitle={`0x${hexOf(picked)} · ${picked.code}`}
        colour={picked.colour}
        icon={<Glyph shape={picked.shape} colour={picked.colour} />}
        footer={
          <>
            <Button style={{ flex: 1 }}>Focus</Button>
            <Button style={{ flex: 1 }} active>
              Isolate
            </Button>
          </>
        }
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
            style={{
              width: "100%",
              background: "none",
              border: 0,
              textAlign: "left",
              paddingLeft: 0,
            }}
          >
            <span aria-hidden="true" style={{ color: it.colour, width: 8 }}>
              ▸
            </span>
            <Glyph shape={it.shape} colour={it.colour} size={10} />
            <span
              style={{
                flex: 1,
                color: it.colour,
                textTransform: "uppercase",
                letterSpacing: "var(--nx-track-normal)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {it.label}
            </span>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>
              {it.code}
            </span>
          </button>
        ))}
      </Drawer>
    </>
  );
}

export function CommandPalettePage() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PaletteItem>(ITEMS[3]!);

  useHotkey("mod+k", () => setOpen((v) => !v));
  useHotkey("/", () => setOpen(true));

  return (
    <>
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
          <Button onClick={() => setOpen(true)}>Open palette</Button>
          <span style={hint}>⌘K / Ctrl+K or / · try “tid”, “#”, “atl”, or leave it empty</span>
        </Row>
        <div
          style={{
            marginTop: "var(--nx-space-4)",
            color: "var(--nx-fg-subtle)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.8,
          }}
        >
          selected → <span style={{ color: picked.colour }}>{picked.label}</span> · 0x
          {hexOf(picked)}
        </div>
      </Spec>

      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        items={ITEMS}
        onSelect={(it) => {
          setPicked(it);
          setOpen(false);
        }}
        renderMeta={(it) => (
          <span
            style={{
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              width: 22,
              textAlign: "right",
            }}
          >
            {it.weight}
          </span>
        )}
      />
    </>
  );
}
