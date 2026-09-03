import type { HTMLAttributes, ReactNode } from "react";
import { mergeClassName } from "../../className.js";

export interface SectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * A dense panel label. Deliberately not a heading element — these are chrome,
 * not document structure, and a screen reader's heading list should not fill
 * up with them.
 */
export function SectionHeading({ children, className = "", ...rest }: SectionHeadingProps) {
  return (
    <div className={mergeClassName("nx-heading", className)} {...rest}>
      {children}
    </div>
  );
}
