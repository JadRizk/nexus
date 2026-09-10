import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { GraphCanvas, TIER_ZOOM } from "@nexus-cyberdeck/graph";
import type {
  GraphController,
  GraphNodeSnapshot,
  GraphStats,
  OpticsConfig,
  PhysicsConfig,
} from "@nexus-cyberdeck/graph";
import {
  Panel,
  Button,
  TabStrip,
  Slider,
  ToggleRow,
  SectionHeading,
  HazardRule,
  Wordmark,
  BlinkCursor,
  KeyValue,
  Stat,
  MeterRow,
  Glyph,
  LinkGlyph,
  GLYPH_SHAPES,
  useFocusTrap,
} from "@nexus-cyberdeck/react";
import {
  generateSampleGraph,
  LINK_CATEGORIES,
  LINK_CATEGORY_IDS,
  NODE_CATEGORIES,
  NODE_CATEGORY_IDS,
} from "./sampleData.js";

/* ============================================================================
   NEXUS // CYBERDECK  —  typed knowledge graph on a CRT

   The console chrome here is unchanged from the earlier @nexus-cyberdeck/react
   migration. What changed in this pass: the physics/shaders/render loop —
   previously ~700 lines inline in this file's own mount effect — now live
   in @nexus-cyberdeck/graph's <GraphCanvas>, generic over any node/edge taxonomy. This
   file owns exactly what a consumer of that package is expected to own: the
   ATLAS/TAG/etc. sample data (sampleData.ts), the physics/optics slider
   state, and the chrome around the canvas.
   ========================================================================== */

const DEFAULT_CFG = {
  repulsion: 900,
  linkDistance: 78,
  cursorForce: 0,
  settle: 0,
  flowSpeed: 0.24,
  glow: 0.8,
  trails: 0.16,
  edgeOpacity: 0.5,
  edgeWidth: 2.4,
  scan: 0.55,
  aberr: 1.0,
  curve: 0.55,
  grain: 0.45,
  bloom: 0.85,
  glitch: 0.5,
};

const DEFAULT_STATS: GraphStats = {
  fps: 0,
  nodes: 0,
  edges: 0,
  drawnEdges: 0,
  frameMs: 0,
  settled: false,
  vertexAttribs: 0,
  webglVersion: 2,
};

export default function NexusCyberdeck() {
  const controllerRef = useRef<GraphController>(null);

  const [total, setTotal] = useState(200);
  const [seed, setSeed] = useState(0);
  const [stats, setStats] = useState<GraphStats>(DEFAULT_STATS);
  const [selected, setSelected] = useState<GraphNodeSnapshot | null>(null);
  const [isolate, setIsolate] = useState<number | null>(null);
  const [running, setRunning] = useState(true);
  const [tab, setTab] = useState<"crt" | "sim">("crt");
  const [labelMode, setLabelMode] = useState<"auto" | "key" | "all" | "off">("auto");

  const [nodeOn, setNodeOn] = useState(() =>
    Object.fromEntries(NODE_CATEGORY_IDS.map((k) => [k, true])),
  );
  const [linkOn, setLinkOn] = useState(() =>
    Object.fromEntries(LINK_CATEGORY_IDS.map((k) => [k, true])),
  );

  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const set = useCallback(
    <K extends keyof typeof DEFAULT_CFG>(k: K, v: (typeof DEFAULT_CFG)[K]) =>
      setCfg((p) => ({ ...p, [k]: v })),
    [],
  );

  const sampleGraph = useMemo(() => generateSampleGraph(total), [total, seed]);

  const hiddenNodeCategories = useMemo(() => NODE_CATEGORY_IDS.filter((k) => !nodeOn[k]), [nodeOn]);
  const hiddenLinkCategories = useMemo(() => LINK_CATEGORY_IDS.filter((k) => !linkOn[k]), [linkOn]);

  const physics: Partial<PhysicsConfig> = {
    repulsion: cfg.repulsion,
    linkDistance: cfg.linkDistance,
    cursorForce: cfg.cursorForce,
    settle: cfg.settle,
  };
  const optics: Partial<OpticsConfig> = {
    glow: cfg.glow,
    trails: cfg.trails,
    edgeOpacity: cfg.edgeOpacity,
    edgeWidth: cfg.edgeWidth,
    flowSpeed: cfg.flowSpeed,
    scan: cfg.scan,
    aberr: cfg.aberr,
    curve: cfg.curve,
    grain: cfg.grain,
    bloom: cfg.bloom,
    glitch: cfg.glitch,
  };

  const goTo = useCallback((id: number) => {
    const d = controllerRef.current?.getNode(id);
    if (!d) return;
    setSelected(d);
    controllerRef.current?.focus(id);
    // walking the graph while isolated should move the isolation with you,
    // otherwise the node you just jumped to is the only thing you can't expand
    setIsolate((v) => (v !== null ? id : v));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setIsolate(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-nx-theme="hud"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--nx-bg-canvas)",
        overflow: "hidden",
      }}
    >
      <GraphCanvas
        ref={controllerRef}
        nodes={sampleGraph.nodes}
        edges={sampleGraph.edges}
        nodeCategories={NODE_CATEGORIES}
        linkCategories={LINK_CATEGORIES}
        physics={physics}
        optics={optics}
        labelMode={labelMode}
        hiddenNodeCategories={hiddenNodeCategories}
        hiddenLinkCategories={hiddenLinkCategories}
        isolateId={isolate}
        selectedId={selected?.id ?? null}
        running={running}
        onSelect={setSelected}
        onStats={setStats}
      />

      {/* -------------------------------------------------- left: console+legend */}
      <div
        style={{
          position: "absolute",
          top: "var(--nx-space-5)",
          left: "var(--nx-space-5)",
          width: 248,
          display: "flex",
          flexDirection: "column",
          gap: "var(--nx-space-3)",
          maxHeight: "calc(100% - var(--nx-space-6))",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        <Panel style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
            <span
              style={{
                fontFamily: "var(--nx-font-stencil)",
                fontSize: "var(--nx-text-xl)",
                lineHeight: 0.8,
                color:
                  stats.fps > 50
                    ? "var(--nx-fg-accent)"
                    : stats.fps > 28
                      ? "var(--nx-fg-warning)"
                      : "var(--nx-fg-critical)",
              }}
            >
              {stats.fps}
            </span>
          </div>
          <div
            style={{
              marginTop: "var(--nx-space-2)",
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wider)",
            }}
          >
            CYBERDECK v2.6 <BlinkCursor />
          </div>
          <HazardRule style={{ margin: "var(--nx-space-3) 0" }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "1px var(--nx-space-2)",
            }}
          >
            <KeyValue style={{ gap: "var(--nx-space-2)" }} label="NODES" value={stats.nodes} />
            <KeyValue style={{ gap: "var(--nx-space-2)" }} label="LINKS" value={stats.edges} />
            <KeyValue style={{ gap: "var(--nx-space-2)" }} label="DRAWN" value={stats.drawnEdges} />
            <KeyValue style={{ gap: "var(--nx-space-2)" }} label="FRAME" value={stats.frameMs} />
            <KeyValue
              style={{ gap: "var(--nx-space-2)" }}
              label="SOLVER"
              value={
                <span
                  style={{ color: stats.settled ? "var(--nx-fg-accent)" : "var(--nx-fg-warning)" }}
                >
                  {stats.settled ? "LOCKED" : "COOLING"}
                </span>
              }
            />
            <KeyValue
              style={{ gap: "var(--nx-space-2)" }}
              label="VTXATTR"
              value={
                <span
                  style={{
                    color:
                      stats.vertexAttribs >= 8 ? "var(--nx-fg-muted)" : "var(--nx-fg-critical)",
                  }}
                >
                  {stats.vertexAttribs}/7
                </span>
              }
            />
          </div>

          <div style={{ margin: "var(--nx-space-4) 0 var(--nx-space-3)" }}>
            <TabStrip
              value={tab}
              onChange={setTab}
              label="Optics or solver controls"
              tabs={[
                { value: "crt", label: "Optics" },
                { value: "sim", label: "Solver" },
              ]}
            />
          </div>

          {tab === "crt" ? (
            <>
              <Slider
                label="scanlines"
                value={cfg.scan}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => set("scan", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="aberration"
                value={cfg.aberr}
                min={0}
                max={3}
                step={0.05}
                onChange={(v) => set("aberr", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="curvature"
                value={cfg.curve}
                min={0}
                max={1.6}
                step={0.02}
                onChange={(v) => set("curve", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="bloom"
                value={cfg.bloom}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(v) => set("bloom", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="grain"
                value={cfg.grain}
                min={0}
                max={1.5}
                step={0.02}
                onChange={(v) => set("grain", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="glitch"
                value={cfg.glitch}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => set("glitch", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="persistence"
                value={cfg.trails}
                min={0}
                max={0.92}
                step={0.01}
                onChange={(v) => set("trails", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="packet rate"
                value={cfg.flowSpeed}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set("flowSpeed", v)}
                format={(x) => x.toFixed(2)}
              />
            </>
          ) : (
            <>
              <Slider
                label="link width"
                value={cfg.edgeWidth}
                min={0.6}
                max={5}
                step={0.1}
                onChange={(v) => set("edgeWidth", v)}
                format={(x) => x.toFixed(1)}
              />
              <Slider
                label="link gain"
                value={cfg.edgeOpacity}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(v) => set("edgeOpacity", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="node glow"
                value={cfg.glow}
                min={0}
                max={2.5}
                step={0.05}
                onChange={(v) => set("glow", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="repulsion"
                value={cfg.repulsion}
                min={100}
                max={2200}
                step={20}
                onChange={(v) => set("repulsion", v)}
              />
              <Slider
                label="link length"
                value={cfg.linkDistance}
                min={20}
                max={200}
                step={2}
                onChange={(v) => set("linkDistance", v)}
              />
              <Slider
                label="cursor field"
                value={cfg.cursorForce}
                min={-1}
                max={1}
                step={0.05}
                onChange={(v) => set("cursorForce", v)}
                format={(x) => x.toFixed(2)}
              />
              <Slider
                label="drift"
                value={cfg.settle}
                min={0}
                max={0.06}
                step={0.002}
                onChange={(v) => set("settle", v)}
                format={(x) => (x === 0 ? "LOCK" : x.toFixed(3))}
              />
              <Slider
                label="corpus size"
                value={total}
                min={60}
                max={600}
                step={20}
                onChange={(v) => {
                  setSelected(null);
                  setIsolate(null);
                  setTotal(v);
                }}
              />
            </>
          )}

          <div
            style={{
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase",
              marginBottom: "var(--nx-space-1)",
            }}
          >
            names
          </div>
          <TabStrip
            value={labelMode}
            onChange={setLabelMode}
            label="Label mode"
            tabs={[
              { value: "auto", label: "Auto" },
              { value: "key", label: "Key" },
              { value: "all", label: "All" },
              { value: "off", label: "Off" },
            ]}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "var(--nx-space-2)",
              marginTop: "var(--nx-space-3)",
            }}
          >
            <Button style={{ minWidth: 0 }} onClick={() => controllerRef.current?.fit()}>
              Fit
            </Button>
            <Button style={{ minWidth: 0 }} onClick={() => controllerRef.current?.reheat()}>
              Reheat
            </Button>
            <Button style={{ minWidth: 0 }} onClick={() => setRunning((r) => !r)}>
              {running ? "Halt" : "Run"}
            </Button>
            <Button
              style={{ minWidth: 0 }}
              onClick={() => {
                setSelected(null);
                setIsolate(null);
                setSeed((s) => s + 1);
              }}
            >
              Reseed
            </Button>
          </div>
        </Panel>

        <Panel style={{ flexShrink: 0 }}>
          <SectionHeading>/// entity class</SectionHeading>
          {NODE_CATEGORY_IDS.map((k) => (
            <ToggleRow
              key={k}
              checked={!!nodeOn[k]}
              onChange={(v) => setNodeOn((p) => ({ ...p, [k]: v }))}
              icon={
                <Glyph
                  shape={GLYPH_SHAPES[NODE_CATEGORIES[k]!.shape]}
                  colour={NODE_CATEGORIES[k]!.color}
                  muted={!nodeOn[k]}
                />
              }
              label={NODE_CATEGORIES[k]!.label}
              meta={
                NODE_CATEGORIES[k]!.tier === 0
                  ? "ALWAYS"
                  : `z${TIER_ZOOM[NODE_CATEGORIES[k]!.tier]!.toFixed(1)}`
              }
            />
          ))}
          <div style={{ height: "var(--nx-space-3)" }} />
          <SectionHeading>/// relation</SectionHeading>
          {LINK_CATEGORY_IDS.map((k) => (
            <ToggleRow
              key={k}
              checked={!!linkOn[k]}
              onChange={(v) => setLinkOn((p) => ({ ...p, [k]: v }))}
              icon={
                <LinkGlyph
                  colour={LINK_CATEGORIES[k]!.color}
                  dashed={!!LINK_CATEGORIES[k]!.dash}
                  arrow={!!LINK_CATEGORIES[k]!.arrow}
                  width={LINK_CATEGORIES[k]!.width * 1.05}
                  muted={!linkOn[k]}
                />
              }
              label={LINK_CATEGORIES[k]!.label}
            />
          ))}
        </Panel>
      </div>

      {/* ------------------------------------------------------------- drawer */}
      <InspectorDrawer
        selected={selected}
        onClose={() => {
          setSelected(null);
          setIsolate(null);
        }}
        isolate={isolate}
        onIsolate={() => {
          if (!selected) return;
          const id = selected.id as number;
          setIsolate((v) => (v === id ? null : id));
        }}
        onFocus={() => {
          if (selected) controllerRef.current?.focus(selected.id);
        }}
        onGoTo={goTo}
      />

      {/* ------------------------------------------------------------ hint bar */}
      <div
        style={{
          position: "absolute",
          bottom: "var(--nx-space-4)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--nx-font-mono)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
          color: "var(--nx-fg-disabled)",
          textTransform: "uppercase",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        click lock · drag pan · scroll zoom · esc clear
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- bits
   The node/edge inspector. Positioned `absolute` within this page's own
   full-bleed root rather than the real <Drawer> component's `fixed`
   viewport anchoring — this console sits below the site's sticky header, so
   a viewport-fixed drawer would render partway behind it. Reuses
   useFocusTrap directly to get the same focus-trap/Escape/restore behaviour
   as <Drawer> without inheriting its positioning. */
function InspectorDrawer({
  selected,
  onClose,
  isolate,
  onIsolate,
  onFocus,
  onGoTo,
}: {
  selected: GraphNodeSnapshot | null;
  onClose: () => void;
  isolate: number | null;
  onIsolate: () => void;
  onFocus: () => void;
  onGoTo: (id: number) => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(!!selected, onClose);
  const titleId = useId();
  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={selected ? titleId : undefined}
      aria-hidden={selected ? undefined : true}
      tabIndex={-1}
      style={{
        position: "absolute",
        top: "var(--nx-space-5)",
        right: "var(--nx-space-5)",
        bottom: "var(--nx-space-5)",
        width: 296,
        display: "flex",
        flexDirection: "column",
        transform: selected ? "translateX(0)" : "translateX(324px)",
        opacity: selected ? 1 : 0,
        pointerEvents: selected ? "auto" : "none",
        transition:
          "transform var(--nx-dur-panel) var(--nx-ease), opacity var(--nx-dur-fade) linear",
      }}
    >
      {selected && (
        <Panel
          padded={false}
          raised
          style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
        >
          <div
            style={{
              padding: "var(--nx-space-5)",
              borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--nx-space-3)" }}>
              <div style={{ paddingTop: 2 }}>
                <Glyph
                  shape={GLYPH_SHAPES[NODE_CATEGORIES[selected.categoryId]!.shape]}
                  colour={NODE_CATEGORIES[selected.categoryId]!.color}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  id={titleId}
                  style={{
                    color: NODE_CATEGORIES[selected.categoryId]!.color,
                    fontFamily: "var(--nx-font-mono)",
                    fontSize: "var(--nx-text-md)",
                    fontWeight: 700,
                    letterSpacing: "var(--nx-track-normal)",
                    textTransform: "uppercase",
                    wordBreak: "break-all",
                  }}
                >
                  {selected.label}
                </div>
                <div
                  style={{
                    color: "var(--nx-fg-tertiary)",
                    marginTop: "var(--nx-space-1)",
                    letterSpacing: "var(--nx-track-wide)",
                  }}
                >
                  0x{selected.hex} · {NODE_CATEGORIES[selected.categoryId]!.code}
                </div>
              </div>
              <Button
                onClick={onClose}
                aria-label="Close details"
                style={{ padding: "3px 6px", lineHeight: 1 }}
              >
                ✕
              </Button>
            </div>
          </div>
          <HazardRule style={{ flexShrink: 0 }} />

          <div
            style={{
              padding: "var(--nx-space-4) var(--nx-space-5)",
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "var(--nx-space-3)",
              borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--nx-fg-tertiary)",
                  fontSize: "var(--nx-text-2xs)",
                  letterSpacing: "var(--nx-track-wide)",
                  marginBottom: "var(--nx-space-1)",
                  textTransform: "uppercase",
                }}
              >
                CLASS
              </div>
              <div
                style={{
                  color: NODE_CATEGORIES[selected.categoryId]!.color,
                  fontSize: "var(--nx-text-xs)",
                  letterSpacing: "var(--nx-track-normal)",
                }}
              >
                {NODE_CATEGORIES[selected.categoryId]!.label}
              </div>
            </div>
            <Stat
              label="STATE"
              value={selected.state}
              tone={
                selected.state === "HOT"
                  ? "warning"
                  : selected.state === "ORPHAN"
                    ? "critical"
                    : "default"
              }
            />
            <Stat label="DEGREE" value={String(selected.degree)} />
          </div>

          <div
            style={{
              padding: "var(--nx-space-4) var(--nx-space-5) var(--nx-space-1)",
              flexShrink: 0,
            }}
          >
            <SectionHeading>/// relation profile</SectionHeading>
            {selected.groups.map((g) => (
              <MeterRow
                key={g.categoryId}
                label={LINK_CATEGORIES[g.categoryId]!.label}
                value={g.rows.length}
                total={selected.degree}
                colour={LINK_CATEGORIES[g.categoryId]!.color}
              />
            ))}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "var(--nx-space-2) var(--nx-space-5) var(--nx-space-4)",
            }}
          >
            <SectionHeading>/// adjacency [{selected.degree}]</SectionHeading>
            {selected.groups.map((g) => (
              <div key={g.categoryId} style={{ marginBottom: "var(--nx-space-3)" }}>
                <div
                  style={{
                    color: LINK_CATEGORIES[g.categoryId]!.color,
                    fontSize: "var(--nx-text-2xs)",
                    letterSpacing: "var(--nx-track-wider)",
                    opacity: 0.75,
                    margin: "var(--nx-space-2) 0",
                  }}
                >
                  {LINK_CATEGORIES[g.categoryId]!.label}
                </div>
                {g.rows.map((r) => (
                  <button
                    key={String(r.id)}
                    type="button"
                    className="nx-row"
                    onClick={() => onGoTo(r.id as number)}
                    style={{
                      width: "100%",
                      background: "none",
                      border: 0,
                      textAlign: "left",
                      paddingLeft: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        color: LINK_CATEGORIES[g.categoryId]!.color,
                        width: 8,
                        flexShrink: 0,
                      }}
                    >
                      {r.out ? "▸" : "◂"}
                    </span>
                    <Glyph
                      shape={GLYPH_SHAPES[NODE_CATEGORIES[r.categoryId]!.shape]}
                      colour={NODE_CATEGORIES[r.categoryId]!.color}
                      size={10}
                    />
                    <span
                      style={{
                        flex: 1,
                        color: NODE_CATEGORIES[r.categoryId]!.color,
                        textTransform: "uppercase",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        letterSpacing: "var(--nx-track-tight)",
                      }}
                    >
                      {r.label}
                    </span>
                    <span
                      style={{
                        color: "var(--nx-fg-disabled)",
                        fontSize: "var(--nx-text-2xs)",
                        flexShrink: 0,
                      }}
                    >
                      {NODE_CATEGORIES[r.categoryId]!.code}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--nx-space-2)",
              padding: "var(--nx-space-4) var(--nx-space-5)",
              borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
              flexShrink: 0,
            }}
          >
            <Button style={{ flex: 1 }} onClick={onFocus}>
              Focus
            </Button>
            <Button style={{ flex: 1 }} active={isolate === selected.id} onClick={onIsolate}>
              {isolate === selected.id ? "Restore" : "Isolate"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
