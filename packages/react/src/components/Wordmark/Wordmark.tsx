import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { mergeClassName } from "../../className.js";

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  size?: string;
  /** Degrees of shear. 0 disables the skew. */
  skew?: number;
}

/** Condensed stencil wordmark with an RGB split. Display use only. */
export const Wordmark = forwardRef<HTMLSpanElement, WordmarkProps>(
  function Wordmark({ children, size, skew = -9, className = "", style, ...rest }, ref) {
    return (
      <span
        ref={ref}
        className={mergeClassName("nx-wordmark", className)}
        // Both are per-instance: a wordmark is set at whatever size the layout
        // around it needs, and the shear is turned off for small renderings.
        style={{ "--nx-wordmark-size": size, "--nx-wordmark-skew": `${skew}deg`, ...style } as CSSProperties}
        {...rest}
      >
        {children}
      </span>
    );
  },
);

Wordmark.displayName = "Wordmark";
