import { TIER_ZOOM } from "@nexus-cyberdeck/graph";
import {
  GLYPH_SHAPES,
  Glyph,
  LinkGlyph,
  Panel,
  SectionHeading,
  ToggleRow,
} from "@nexus-cyberdeck/react";
import { LINK_CATEGORY_IDS, NODE_CATEGORY_IDS, linkCategory, nodeCategory } from "./taxonomy.js";

export interface GraphLegendProps {
  nodeOn: Record<string, boolean>;
  linkOn: Record<string, boolean>;
  onNodeToggle: (categoryId: string, isOn: boolean) => void;
  onLinkToggle: (categoryId: string, isOn: boolean) => void;
}

/** The legend, which doubles as the category filter. */
export function GraphLegend({ nodeOn, linkOn, onNodeToggle, onLinkToggle }: GraphLegendProps) {
  return (
    <Panel style={{ flexShrink: 0 }}>
      <SectionHeading>/// entity class</SectionHeading>
      {NODE_CATEGORY_IDS.map((k) => {
        const category = nodeCategory(k);
        return (
          <ToggleRow
            key={k}
            checked={!!nodeOn[k]}
            onChange={(v) => onNodeToggle(k, v)}
            icon={
              <Glyph
                shape={GLYPH_SHAPES[category.shape]}
                colour={category.color}
                muted={!nodeOn[k]}
              />
            }
            label={category.label}
            meta={category.tier === 0 ? "ALWAYS" : `z${TIER_ZOOM[category.tier].toFixed(1)}`}
          />
        );
      })}
      <div style={{ height: "var(--nx-space-3)" }} />
      <SectionHeading>/// relation</SectionHeading>
      {LINK_CATEGORY_IDS.map((k) => {
        const category = linkCategory(k);
        return (
          <ToggleRow
            key={k}
            checked={!!linkOn[k]}
            onChange={(v) => onLinkToggle(k, v)}
            icon={
              <LinkGlyph
                colour={category.color}
                dashed={!!category.dash}
                // LinkGlyph still draws direction as an arrowhead; the canvas
                // draws it as a bracket at the target end.
                arrow={category.directed !== false}
                width={category.width * 1.05}
                muted={!linkOn[k]}
              />
            }
            label={category.label}
          />
        );
      })}
    </Panel>
  );
}
