import { Button, Drawer, Glyph, MeterRow, SectionHeading } from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";

/* ============================================================================
   showcase — DetailDrawer
   The entity detail drawer the Home console and the Drawer page both open:
   a relation profile and an adjacency list whose rows re-target the drawer.
   Showcase scaffolding, not part of @nexus-cyberdeck/react.
   ========================================================================== */

/** A stable four-digit hex id for an item, for the drawer's subtitle. */
export const hexOf = (item: PaletteItem) =>
  (((Number(item.id) * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  item: PaletteItem;
  /** The adjacency list. */
  related: readonly PaletteItem[];
  onPick: (item: PaletteItem) => void;
}

export function DetailDrawer({ open, onClose, item, related, onPick }: DetailDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item.label}
      subtitle={`0x${hexOf(item)} · ${item.code}`}
      colour={item.colour}
      icon={<Glyph shape={item.shape} colour={item.colour} />}
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
      {related.map((it) => (
        <button
          key={it.id}
          type="button"
          className="nx-row"
          onClick={() => onPick(it)}
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
  );
}
