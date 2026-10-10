import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CommandPalette, useHotkey, useNexus } from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";
import { DOC_GROUPS } from "../site.js";
import type { DocGroup } from "../site.js";
import { useIsPhone } from "../phone.js";

/* ============================================================================
   showcase — SitePalette
   ⌘K / Ctrl+K or "/" on any route: every page of the site, plus the actions
   the header offers (theme, CRT). Showcase scaffolding built on the library's
   CommandPalette, so the site's own search is also its best live demo.

   Each kind of result carries its own glyph silhouette as well as its colour
   and code, so the kind never rests on colour alone. On a phone the labs are
   left out, as they are from the header and Home: they are docked desktop
   consoles with no phone layout.
   ========================================================================== */

interface SiteItem extends PaletteItem {
  run: () => void;
}

const SitePaletteContext = createContext<{ open: () => void }>({ open: () => {} });

/** Opens the site palette from a control of a page's own. */
export const useSitePalette = () => useContext(SitePaletteContext);

// The CommandPalette page demonstrates the same shortcuts on a palette of its
// own; there the site palette stands aside rather than opening a second one.
const OWNS_SHORTCUTS = "components/command-palette";

const go = (path: string) => () => {
  window.location.hash = `#/${path}`;
};

function pages(groups: readonly DocGroup[]): SiteItem[] {
  return groups.flatMap((group) => [
    ...group.pages.map((page): SiteItem => ({
      id: page.path,
      label: page.navLabel ?? page.title,
      ...(page.path.startsWith("components/")
        ? { code: "COMP", shape: "circle", colour: "var(--nx-fg-info)", weight: 1 }
        : page.path.startsWith("hooks/")
          ? { code: "HOOK", shape: "diamond", colour: "var(--nx-fg-cat-lime)", weight: 1 }
          : { code: "DOC", shape: "square", colour: "var(--nx-fg-accent)", weight: 5 }),
      run: go(page.path),
    })),
    ...pages(group.subgroups ?? []),
  ]);
}

const labs: SiteItem[] = [
  {
    id: "labs/graph",
    label: "Graph",
    code: "LAB",
    shape: "ring",
    colour: "var(--nx-fg-cat-violet)",
    weight: 6,
    run: go("labs/graph"),
  },
  {
    id: "labs/glitch",
    label: "Glitch Lab",
    code: "LAB",
    shape: "ring",
    colour: "var(--nx-fg-cat-violet)",
    weight: 6,
    run: go("labs/glitch"),
  },
];

export function SitePalette({ path, children }: { path: string; children: ReactNode }) {
  const { theme, setTheme, crt, setCrt } = useNexus();
  const [open, setOpen] = useState(false);
  const isPhone = useIsPhone();

  useHotkey("mod+k", () => {
    if (path !== OWNS_SHORTCUTS) setOpen((v) => !v);
  });
  useHotkey("/", () => {
    if (path !== OWNS_SHORTCUTS) setOpen(true);
  });

  const items = useMemo((): SiteItem[] => {
    const act = (label: string, run: () => void): SiteItem => ({
      id: `act:${label}`,
      label,
      code: "ACT",
      shape: "triangle",
      colour: "var(--nx-fg-warning)",
      weight: 10,
      run,
    });
    return [
      act(theme === "hud-aa" ? "Switch to the HUD theme" : "Switch to the AA theme", () =>
        setTheme(theme === "hud-aa" ? "hud" : "hud-aa"),
      ),
      act(crt ? "Turn the CRT layer off" : "Turn the CRT layer on", () => setCrt(!crt)),
      {
        id: "home",
        label: "Home",
        code: "SITE",
        shape: "hexagon",
        colour: "var(--nx-fg-accent)",
        weight: 8,
        run: go(""),
      },
      ...pages(DOC_GROUPS),
      ...(isPhone ? [] : labs),
    ];
  }, [theme, setTheme, crt, setCrt, isPhone]);

  const ctx = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <SitePaletteContext.Provider value={ctx}>
      {children}
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        label="Search the site"
        placeholder="Go to a page or run an action…"
        onSelect={(item) => {
          setOpen(false);
          item.run();
        }}
      />
    </SitePaletteContext.Provider>
  );
}
