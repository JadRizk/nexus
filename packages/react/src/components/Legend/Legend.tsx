import { forwardRef } from "react";
import type { CSSProperties } from "react";
import { SectionHeading } from "../SectionHeading/index.js";
import type { LegendGroup } from "../../types.js";

export interface LegendProps {
  groups: readonly LegendGroup[];
  style?: CSSProperties;
}

/** Grouped filter legend. Each group is a fieldset so the heading is bound. */
export const Legend = forwardRef<HTMLDivElement, LegendProps>(
  function Legend({ groups, style }, ref) {
    return (
      <div ref={ref} className="nx-legend" style={style}>
        {groups.map((group) => (
          <fieldset key={group.title} className="nx-legend__group">
            {/* `as="span"`: <legend> takes phrasing content only, and a <div>
                inside one is invalid HTML — browsers differ on whether they
                keep it there. */}
            <legend className="nx-legend__title">
              <SectionHeading as="span">/// {group.title}</SectionHeading>
            </legend>
            {group.rows}
          </fieldset>
        ))}
      </div>
    );
  },
);

Legend.displayName = "Legend";
