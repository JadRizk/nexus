import type { HTMLAttributes, ReactNode } from "react";

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
    <div className={`nx-heading ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
