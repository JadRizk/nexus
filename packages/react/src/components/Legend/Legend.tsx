import type { CSSProperties } from "react";
import { SectionHeading } from "../SectionHeading/index.js";
import type { LegendGroup } from "../../types.js";

export interface LegendProps {
  groups: readonly LegendGroup[];
  style?: CSSProperties;
}

/** Grouped filter legend. Each group is a fieldset so the heading is bound. */
export function Legend({ groups, style }: LegendProps) {
  return (
    <div className="nx-legend" style={style}>
      {groups.map((group) => (
        <fieldset key={group.title} className="nx-legend__group">
          <legend className="nx-legend__title">
            <SectionHeading>/// {group.title}</SectionHeading>
          </legend>
          {group.rows}
        </fieldset>
      ))}
    </div>
  );
}
