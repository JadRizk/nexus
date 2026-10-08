import layer from "virtual:nx-component-layer";

/* The component token layer, parsed at build time by
   scripts/component-layer.mjs (see the nx-component-layer plugin in
   vite.config.ts). The component layer has no JSON source: it lives in each
   component's stylesheet as var(--nx-x, fallback) hooks. */

export interface ComponentToken {
  name: string;
  /** The fallback the component uses when nothing sets the token. */
  fallback: string;
}

export const COMPONENT_LAYER = {
  /** Component → the --nx-* hooks it reads with a fallback. */
  hooks: new Map<string, ComponentToken[]>(layer.hooks),
  /** Global token → the components whose stylesheet references it. */
  usedBy: new Map<string, string[]>(layer.usedBy),
};
