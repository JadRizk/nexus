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

export function GraphLegend({ nodeOn, linkOn, onNodeToggle, onLinkToggle }: GraphLegendProps) {
  return (
    <Panel style={{ flexShrink: 0 }}>
      <SectionHeading>/// entity class</SectionHeading>
      {NODE_CATEGORY_IDS.map((categoryId) => {
        const category = nodeCategory(categoryId);
        return (
          <ToggleRow
            key={categoryId}
            checked={!!nodeOn[categoryId]}
            onChange={(isOn) => onNodeToggle(categoryId, isOn)}
            icon={
              <Glyph
                shape={GLYPH_SHAPES[category.shape]}
                colour={category.color}
                muted={!nodeOn[categoryId]}
              />
            }
            label={category.label}
            meta={category.tier === 0 ? "ALWAYS" : `z${TIER_ZOOM[category.tier].toFixed(1)}`}
          />
        );
      })}
      <div style={{ height: "var(--nx-space-3)" }} />
      <SectionHeading>/// relation</SectionHeading>
      {LINK_CATEGORY_IDS.map((categoryId) => {
        const category = linkCategory(categoryId);
        return (
          <ToggleRow
            key={categoryId}
            checked={!!linkOn[categoryId]}
            onChange={(isOn) => onLinkToggle(categoryId, isOn)}
            icon={
              <LinkGlyph
                colour={category.color}
                dashed={!!category.dash}
                // The canvas draws direction as a bracket; LinkGlyph only offers an arrowhead.
                arrow={category.directed !== false}
                width={category.width * 1.05}
                muted={!linkOn[categoryId]}
              />
            }
            label={category.label}
          />
        );
      })}
    </Panel>
  );
}
