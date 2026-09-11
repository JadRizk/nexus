import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { mergeClassName } from "../../className.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ active = false, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={mergeClassName("nx-btn", className)}
        data-active={active ? "1" : "0"}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
