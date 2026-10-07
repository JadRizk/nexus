import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { mergeClassName } from "../../className.js";

export interface SectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * Element to render. `"span"` for the places that only accept phrasing
   * content — `<legend>` is the one in this library — where a `<div>` is
   * invalid HTML and gets reparented by the parser. Appearance is unchanged:
   * `.nx-heading` sets `display: block` so either tag lays out the same.
   */
  as?: "div" | "span";
}

/**
 * A dense panel label. Deliberately not a heading element — these are chrome,
 * not document structure, and a screen reader's heading list should not fill
 * up with them.
 */
export const SectionHeading = forwardRef<HTMLDivElement, SectionHeadingProps>(
  function SectionHeading({ as: Tag = "div", children, className = "", ...rest }, ref) {
    return (
      <Tag ref={ref} className={mergeClassName("nx-heading", className)} {...rest}>
        {children}
      </Tag>
    );
  },
);

SectionHeading.displayName = "SectionHeading";
