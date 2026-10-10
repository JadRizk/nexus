import { useCallback, useState } from "react";
import { DEFAULT_CONFIG, toOptics, toPhysics } from "./controls.js";
import type { SetDeckConfig } from "./controls.js";

/** The console's slider values, and the physics and optics the canvas reads from them. */
export function useDeckConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const setConfigValue = useCallback<SetDeckConfig>(
    (key, value) => setConfig((previous) => ({ ...previous, [key]: value })),
    [],
  );
  // Fresh objects each render, deliberately unmemoised: GraphCanvas reads their fields, so memoising buys nothing.
  return { config, setConfigValue, physics: toPhysics(config), optics: toOptics(config) };
}
