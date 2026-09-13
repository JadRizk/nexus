import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { mergeClassName } from "../../className.js";
import type { Corner } from "../../types.js";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Which corner ticks render. Two arms read as a bracket; four as a box. */
  corners?: Corner[] | "none";
  padded?: boolean;
  raised?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  function Panel(
    { corners = ["tl", "br"], padded = true, raised = false, className = "", children, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={mergeClassName("nx-panel", className)}
        data-nx-corners={corners === "none" ? "none" : corners.join(" ")}
        data-nx-padded={padded ? "1" : "0"}
        data-nx-raised={raised ? "1" : "0"}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

Panel.displayName = "Panel";
