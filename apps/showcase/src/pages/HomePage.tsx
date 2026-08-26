import { useState } from "react";
import {
  Button, CommandPalette, Drawer, Glyph, HazardRule, KeyValue, LinkGlyph, MeterRow,
  Panel, SectionHeading, Slider, TabStrip, ToggleRow, Wordmark, BlinkCursor,
  useHotkey, useNexus,
} from "@nexus/react";
import type { NexusTheme, PaletteItem } from "@nexus/react";
import { CLASSES, ITEMS, RELATIONS } from "../home-data.js";

/* ============================================================================
   Home — the landing-page console
   Three docked panels (console · legend · theme), a docked Drawer and a
   command palette, all driven by the shared NexusProvider theme/CRT state so
   the site-wide header toggles and this page's own theme panel stay in sync.
   ========================================================================== */

type OpticsTab = "optics" | "solver";

export function HomePage() {
  const { theme, setTheme, crt, setCrt } = useNexus();
  const [tab, setTab] = useState<OpticsTab>("optics");
  const [drawer, setDrawer] = useState(true);
  const [pal, setPal] = useState(false);
  const [scan, setScan] = useState(0.55);
  const [bloom, setBloom] = useState(0.85);
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CLASSES.map((c) => [c.key, true])),
  );
  const [rel, setRel] = useState<Record<string, boolean>>(
    Object.fromEntries(RELATIONS.map((r) => [r.key, true])),
  );
  const [picked, setPicked] = useState<PaletteItem>(ITEMS[2]!);

  useHotkey("mod+k", () => setPal((v) => { const next = !v; if (next) setDrawer(false); return next; }));
  useHotkey("/", () => { setPal(true); setDrawer(false); });

  const hex = (((Number(picked.id) * 2654435761) >>> 0) % 65536)
    .toString(16).toUpperCase().padStart(4, "0");

  return (
    <div style={{ height: "100%", overflow: "auto", position: "relative" }}>
      <div style={{
        display: "flex", gap: "var(--nx-space-5)", padding: "var(--nx-space-5)",
        alignItems: "flex-start", flexWrap: "wrap", maxWidth: 760,
      }}>
        {/* ------------------------------------------------------ console */}
        <Panel padded={false} style={{ width: 218, flexShrink: 0 }}>
          <div style={{ padding: "var(--nx-space-5)", borderBottom: "var(--nx-hairline) solid var(--nx-border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <Wordmark>NEXUS</Wordmark>
              <span style={{
                fontFamily: "var(--nx-font-stencil)", fontSize: "var(--nx-text-xl)",
                lineHeight: 0.8, color: "var(--nx-fg-accent)",
              }}>60</span>
            </div>
            <div style={{
              marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)",
            }}>
              DESIGN SYSTEM v1.0 <BlinkCursor />
            </div>
          </div>

          <HazardRule />

          <div style={{
            padding: "var(--nx-space-4) var(--nx-space-5) 0",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px var(--nx-space-4)",
          }}>
            <KeyValue label="TOKENS" value="78" />
            <KeyValue label="THEMES" value="2" />
            <KeyValue label="COMPS" value="16" />
            <KeyValue label="DEPS" value="0" />
          </div>

          <div style={{ padding: "var(--nx-space-4) var(--nx-space-5)" }}>
            <TabStrip
              value={tab}
              onChange={setTab}
              tabs={[{ value: "optics", label: "Optics" }, { value: "solver", label: "Solver" }] as const}
            />
          </div>

          <div style={{ padding: "0 var(--nx-space-5)" }}>
            {tab === "optics" ? (
              <>
                <Slider label="scanlines" value={scan} min={0} max={1} step={0.02}
                  onChange={setScan} format={(v) => v.toFixed(2)} />
                <Slider label="bloom" value={bloom} min={0} max={2.5} step={0.05}
                  onChange={setBloom} format={(v) => v.toFixed(2)} />
              </>
            ) : (
              <>
                <Slider label="repulsion" value={900} min={100} max={2200} step={20} onChange={() => {}} />
                <Slider label="link length" value={78} min={20} max={200} step={2} onChange={() => {}} />
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--nx-space-2)", padding: "var(--nx-space-4) var(--nx-space-5)" }}>
            <Button style={{ flex: 1 }} onClick={() => setPal(true)}>Search</Button>
            <Button style={{ flex: 1 }} onClick={() => setDrawer((d) => !d)}>Drawer</Button>
          </div>
        </Panel>

        {/* ------------------------------------------------------- legend */}
        <Panel style={{ width: 190, flexShrink: 0 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ padding: 0 }}><SectionHeading>/// entity class</SectionHeading></legend>
            {CLASSES.map((c) => (
              <ToggleRow key={c.key} checked={!!on[c.key]}
                onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
                icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />}
                label={c.label} meta={c.code} />
            ))}
          </fieldset>
          <div style={{ height: "var(--nx-space-4)" }} />
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ padding: 0 }}><SectionHeading>/// relation</SectionHeading></legend>
            {RELATIONS.map((r) => (
              <ToggleRow key={r.key} checked={!!rel[r.key]}
                onChange={(v) => setRel((p) => ({ ...p, [r.key]: v }))}
                icon={<LinkGlyph colour={r.colour} muted={!rel[r.key]} dashed={r.dashed} arrow={r.arrow} width={r.width} />}
                label={r.label} />
            ))}
          </fieldset>
        </Panel>

        {/* --------------------------------------------------- theme switch */}
        <Panel style={{ width: 190, flexShrink: 0 }}>
          <SectionHeading>/// theme</SectionHeading>
          <div style={{ display: "flex", gap: "var(--nx-space-2)", marginBottom: "var(--nx-space-5)" }}>
            {(["hud-aa", "hud"] as NexusTheme[]).map((t) => (
              <Button key={t} style={{ flex: 1 }} active={theme === t} onClick={() => setTheme(t)}>
                {t === "hud-aa" ? "AA" : "HUD"}
              </Button>
            ))}
          </div>
          <SectionHeading>/// crt layer</SectionHeading>
          <div style={{ display: "flex", gap: "var(--nx-space-2)", marginBottom: "var(--nx-space-5)" }}>
            <Button style={{ flex: 1 }} active={crt} onClick={() => setCrt(true)}>On</Button>
            <Button style={{ flex: 1 }} active={!crt} onClick={() => setCrt(false)}>Off</Button>
          </div>
          <SectionHeading>/// muted ramp</SectionHeading>
          {(["default", "muted", "subtle", "tertiary", "disabled"] as const).map((t) => (
            <div key={t} style={{
              color: `var(--nx-fg-${t})`, letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase", padding: "1px 0",
            }}>{t} — the quick brown fox</div>
          ))}
        </Panel>
      </div>

      <div style={{
        position: "absolute", bottom: "var(--nx-space-5)", left: "var(--nx-space-5)",
        color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wider)", textTransform: "uppercase",
      }}>
        ⌘K search · tab through everything · toggle HUD to see what AA fixes
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={picked.label}
        subtitle={`0x${hex} · ${picked.code}`}
        colour={picked.colour}
        icon={<Glyph shape={picked.shape} colour={picked.colour} />}
        footer={<><Button style={{ flex: 1 }}>Focus</Button><Button style={{ flex: 1 }} active>Isolate</Button></>}
      >
        <SectionHeading>/// relation profile</SectionHeading>
        <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
        <MeterRow label="CITE" value={2} total={7} tone="warning" />
        <div style={{ height: "var(--nx-space-5)" }} />
        <SectionHeading>/// adjacency [7]</SectionHeading>
        {ITEMS.slice(2, 8).map((it) => (
          <button
            key={it.id}
            type="button"
            className="nx-row"
            onClick={() => setPicked(it)}
            style={{ width: "100%", background: "none", border: 0, textAlign: "left", paddingLeft: 0 }}
          >
            <span aria-hidden="true" style={{ color: it.colour, width: 8 }}>▸</span>
            <Glyph shape={it.shape} colour={it.colour} size={10} />
            <span style={{
              flex: 1, color: it.colour, textTransform: "uppercase",
              letterSpacing: "var(--nx-track-normal)", overflow: "hidden", textOverflow: "ellipsis",
            }}>{it.label}</span>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{it.code}</span>
          </button>
        ))}
      </Drawer>

      <CommandPalette
        open={pal}
        onClose={() => setPal(false)}
        items={ITEMS}
        onSelect={(it) => { setPicked(it); setDrawer(true); setPal(false); }}
      />
    </div>
  );
}
