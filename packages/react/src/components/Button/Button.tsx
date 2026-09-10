import type { ButtonHTMLAttributes } from "react";
import { mergeClassName } from "../../className.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Button({ active = false, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={mergeClassName("nx-btn", className)}
      data-active={active ? "1" : "0"}
      {...rest}
    >
      {children}
    </button>
  );
}
