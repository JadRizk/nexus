import { createContext, useContext, useMemo, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import type { NexusTheme } from "@nexus-cyberdeck/tokens";
import { mergeClassName } from "../../className.js";

export interface NexusContextValue {
  theme: NexusTheme;
  crt: boolean;
  setTheme: (t: NexusTheme) => void;
  setCrt: (c: boolean) => void;
}

const Ctx = createContext<NexusContextValue>({
  theme: "hud-aa", crt: true, setTheme: () => {}, setCrt: () => {},
});

export const useNexus = (): NexusContextValue => useContext(Ctx);

export interface NexusProviderProps extends HTMLAttributes<HTMLDivElement> {
  theme?: NexusTheme;
  crt?: boolean;
  children: ReactNode;
}

/**
 * Root. Owns theme + CRT state and projects them as data attributes.
 *
 * `theme` and `crt` are **initial values only**: they seed state on mount
 * and are not re-read afterward, so changing either prop on a live
 * `NexusProvider` has no effect. After mount, `useNexus().setTheme` and
 * `useNexus().setCrt` are the only way to change them. This provider is
 * uncontrolled by design — it is not also driven by its props — so it
 * never needs an `onThemeChange` callback to stay in sync with a parent.
 */
export function NexusProvider({
  theme = "hud-aa", crt = true, children, className = "", ...rest
}: NexusProviderProps) {
  const [t, setTheme] = useState<NexusTheme>(theme);
  const [c, setCrt] = useState<boolean>(crt);
  const value = useMemo(
    () => ({ theme: t, crt: c, setTheme, setCrt }),
    [t, c],
  );

  return (
    <Ctx.Provider value={value}>
      <div className={mergeClassName("nx-root", className)} data-nx-theme={t} data-nx-crt={c ? "on" : "off"} {...rest}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
