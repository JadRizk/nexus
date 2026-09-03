import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Button({ active = false, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className="nx-btn" data-active={active ? "1" : "0"} {...rest}>
      {children}
    </button>
  );
}
