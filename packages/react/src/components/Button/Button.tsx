import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { mergeClassName } from "../../className.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Pressed state of a toggle button. Drives `data-active` for styling and
   * `aria-pressed` for assistive tech, so the state a sighted user reads off
   * the accent border is the state a screen reader announces.
   *
   * Omit it for a plain button. `aria-pressed` is emitted only when the prop
   * is actually passed: on a button that is not a toggle, `aria-pressed="false"`
   * announces "toggle button, not pressed", which is worse than silence.
   */
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ active, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={mergeClassName("nx-btn", className)}
        data-active={active ? "1" : "0"}
        aria-pressed={active}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
