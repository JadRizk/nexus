import { useId } from "react";
import type { GraphNodeSnapshot } from "@nexus-cyberdeck/graph";
import {
  Button,
  GLYPH_SHAPES,
  Glyph,
  HazardRule,
  MeterRow,
  Panel,
  SectionHeading,
  Stat,
  useFocusTrap,
} from "@nexus-cyberdeck/react";
import { DRAWER_WIDTH } from "./controls.js";
import { linkCategory, nodeCategory } from "./taxonomy.js";

export interface InspectorDrawerProps {
  selected: GraphNodeSnapshot | null;
  isModal: boolean;
  onClose: () => void;
  isolate: number | null;
  onIsolate: () => void;
  onFocus: () => void;
  onGoTo: (id: number) => void;
}

/** `absolute`, not <Drawer>'s `fixed`: a viewport-fixed drawer would sit partway behind the sticky header. */
export function InspectorDrawer({ selected, isModal, onClose, ...body }: InspectorDrawerProps) {
  // A keyboard selection must leave focus in the graph, so only the others trap it.
  const trapRef = useFocusTrap<HTMLDivElement>(!!selected && isModal, onClose);
  const titleId = useId();
  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal={isModal ? true : undefined}
      aria-labelledby={selected ? titleId : undefined}
      aria-hidden={selected ? undefined : true}
      tabIndex={-1}
      style={{
        position: "absolute",
        top: "var(--nx-space-5)",
        right: "var(--nx-space-5)",
        bottom: "var(--nx-space-5)",
        width: DRAWER_WIDTH,
        display: "flex",
        flexDirection: "column",
        transform: selected ? "translateX(0)" : "translateX(324px)",
        opacity: selected ? 1 : 0,
        pointerEvents: selected ? "auto" : "none",
        transition:
          "transform var(--nx-dur-panel) var(--nx-ease), opacity var(--nx-dur-fade) linear",
      }}
    >
      {selected && <DrawerBody selected={selected} titleId={titleId} onClose={onClose} {...body} />}
    </div>
  );
}

function stateTone(state: string): "warning" | "critical" | "default" {
  if (state === "HOT") return "warning";
  if (state === "ORPHAN") return "critical";
  return "default";
}

function DrawerBody({
  selected,
  titleId,
  onClose,
  isolate,
  onIsolate,
  onFocus,
  onGoTo,
}: Omit<InspectorDrawerProps, "selected" | "isModal"> & {
  selected: GraphNodeSnapshot;
  titleId: string;
}) {
  const category = nodeCategory(selected.categoryId);
  return (
    <Panel
      padded={false}
      raised
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div
        style={{
          padding: "var(--nx-space-5)",
          borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--nx-space-3)" }}>
          <div style={{ paddingTop: 2 }}>
            <Glyph shape={GLYPH_SHAPES[category.shape]} colour={category.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id={titleId}
              style={{
                color: category.color,
                fontFamily: "var(--nx-font-mono)",
                fontSize: "var(--nx-text-md)",
                fontWeight: 700,
                letterSpacing: "var(--nx-track-normal)",
                textTransform: "uppercase",
                wordBreak: "break-all",
              }}
            >
              {selected.label}
            </div>
            <div
              style={{
                color: "var(--nx-fg-tertiary)",
                marginTop: "var(--nx-space-1)",
                letterSpacing: "var(--nx-track-wide)",
              }}
            >
              0x{selected.hex} · {category.code}
            </div>
          </div>
          <Button
            onClick={onClose}
            aria-label="Close details"
            style={{ padding: "3px 6px", lineHeight: 1 }}
          >
            ✕
          </Button>
        </div>
      </div>
      <HazardRule style={{ flexShrink: 0 }} />

      <div
        style={{
          padding: "var(--nx-space-4) var(--nx-space-5)",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--nx-space-3)",
          borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wide)",
              marginBottom: "var(--nx-space-1)",
              textTransform: "uppercase",
            }}
          >
            CLASS
          </div>
          <div
            style={{
              color: category.color,
              fontSize: "var(--nx-text-xs)",
              letterSpacing: "var(--nx-track-normal)",
            }}
          >
            {category.label}
          </div>
        </div>
        <Stat label="STATE" value={selected.state} tone={stateTone(selected.state)} />
        <Stat label="DEGREE" value={String(selected.degree)} />
      </div>

      <div
        style={{
          padding: "var(--nx-space-4) var(--nx-space-5) var(--nx-space-1)",
          flexShrink: 0,
        }}
      >
        <SectionHeading>/// relation profile</SectionHeading>
        {selected.groups.map((group) => (
          <MeterRow
            key={group.categoryId}
            label={linkCategory(group.categoryId).label}
            value={group.rows.length}
            total={selected.degree}
            colour={linkCategory(group.categoryId).color}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "var(--nx-space-2) var(--nx-space-5) var(--nx-space-4)",
        }}
      >
        <SectionHeading>/// adjacency [{selected.degree}]</SectionHeading>
        {selected.groups.map((group) => (
          <div key={group.categoryId} style={{ marginBottom: "var(--nx-space-3)" }}>
            <div
              style={{
                color: linkCategory(group.categoryId).color,
                fontSize: "var(--nx-text-2xs)",
                letterSpacing: "var(--nx-track-wider)",
                opacity: 0.75,
                margin: "var(--nx-space-2) 0",
              }}
            >
              {linkCategory(group.categoryId).label}
            </div>
            {group.rows.map((row) => (
              <button
                key={String(row.id)}
                type="button"
                className="nx-row"
                onClick={() => onGoTo(row.id as number)}
                style={{
                  width: "100%",
                  background: "none",
                  border: 0,
                  textAlign: "left",
                  paddingLeft: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: linkCategory(group.categoryId).color,
                    width: 8,
                    flexShrink: 0,
                  }}
                >
                  {row.out ? "▸" : "◂"}
                </span>
                <Glyph
                  shape={GLYPH_SHAPES[nodeCategory(row.categoryId).shape]}
                  colour={nodeCategory(row.categoryId).color}
                  size={10}
                />
                <span
                  style={{
                    flex: 1,
                    color: nodeCategory(row.categoryId).color,
                    textTransform: "uppercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    letterSpacing: "var(--nx-track-tight)",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    color: "var(--nx-fg-disabled)",
                    fontSize: "var(--nx-text-2xs)",
                    flexShrink: 0,
                  }}
                >
                  {nodeCategory(row.categoryId).code}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--nx-space-2)",
          padding: "var(--nx-space-4) var(--nx-space-5)",
          borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
          flexShrink: 0,
        }}
      >
        <Button style={{ flex: 1 }} onClick={onFocus}>
          Focus
        </Button>
        <Button style={{ flex: 1 }} active={isolate === selected.id} onClick={onIsolate}>
          Isolate
        </Button>
      </div>
    </Panel>
  );
}
