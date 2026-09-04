import { createContext, useContext, useEffect, useState } from "react";
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

/** Root. Owns theme + CRT state and projects them as data attributes. */
export function NexusProvider({
  theme = "hud-aa", crt = true, children, className = "", ...rest
}: NexusProviderProps) {
  const [t, setTheme] = useState<NexusTheme>(theme);
  const [c, setCrt] = useState<boolean>(crt);
  useEffect(() => setTheme(theme), [theme]);
  useEffect(() => setCrt(crt), [crt]);

  return (
    <Ctx.Provider value={{ theme: t, crt: c, setTheme, setCrt }}>
      <div className={mergeClassName("nx-root", className)} data-nx-theme={t} data-nx-crt={c ? "on" : "off"} {...rest}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
