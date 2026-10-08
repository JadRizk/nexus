import { parseComponentCss } from "./model.js";

/* Each component's stylesheet, as text, read at build time. The component
   token layer has no JSON source — it lives in these files as
   var(--nx-x, fallback) hooks — so this is its source of truth. */
const files = import.meta.glob<string>("../../../../packages/react/src/components/*/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const COMPONENT_LAYER = parseComponentCss(files);
