import { forwardRef, useId, useRef } from "react";
import type { CSSProperties } from "react";

/* The shapes `describeGraph()` in @nexus-cyberdeck/graph returns. Declared
   here by shape rather than imported, so this package doesn't depend on the
   graph's: anything with this shape renders, and the showcase, which uses
   both, type-checks that the two stay the same. */

export interface GraphOutlineConnection {
  /** The relation as read from the node it is listed under, e.g. "cited by". */
  relation: string;
  id: string | number;
  label: string;
  /** The other node's kind, e.g. "source". */
  kind: string;
}

export interface GraphOutlineNode {
  id: string | number;
  label: string;
  description: string;
  connections: readonly GraphOutlineConnection[];
}

export interface GraphOutlineGroup {
  categoryId: string;
  label: string;
  nodes: readonly GraphOutlineNode[];
}

export interface GraphOutlineData {
  summary: string;
  groups: readonly GraphOutlineGroup[];
}

export interface GraphOutlineProps {
  data: GraphOutlineData;
  /** Accessible name for the outline as a whole. Default "Graph as a list". */
  label?: string;
  /** The selected node, shown open and marked as selected. */
  selectedId?: string | number | null;
  /** Offers a "Select in graph" button on each node when given. */
  onSelect?: (id: string | number) => void;
  /** Level for the category headings, so the outline slots into the page's outline. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5;
  style?: CSSProperties;
  className?: string;
}

/**
 * The graph as a list: a summary, then each category under a heading, then
 * each node as a disclosure holding its connections. The text alternative to
 * the canvas, and the better tool when the question is "what do these two
 * have in common". Every connection's far node is a button that opens and
 * focuses that node's own entry, so the list can be travelled like the graph.
 */
export const GraphOutline = forwardRef<HTMLElement, GraphOutlineProps>(function GraphOutline(
  {
    data,
    label = "Graph as a list",
    selectedId = null,
    onSelect,
    headingLevel = 3,
    style,
    className,
  },
  ref,
) {
  const base = useId();
  const root = useRef<HTMLElement | null>(null);
  const Heading = `h${headingLevel}` as const;
  // Ids must be valid and unique per outline, and node and category ids can
  // be anything. Encoded, a space can't split one id into two idrefs.
  const keyOf = (id: string | number) => `${base}-n-${encodeURIComponent(String(id))}`;

  // A plain button rather than a #link: hash routers treat any # change as
  // navigation, and the entry has to open as well as come into view.
  const jumpTo = (id: string | number) => {
    const entry = root.current?.querySelector<HTMLDetailsElement>(`[id="${keyOf(id)}"]`);
    if (!entry) return;
    entry.open = true;
    entry.querySelector("summary")?.focus();
  };

  return (
    <section
      ref={(el) => {
        root.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      aria-label={label}
      className={["nx-graph-outline", className].filter(Boolean).join(" ")}
      style={style}
    >
      <p className="nx-graph-outline__summary">{data.summary}</p>
      {data.groups.map((group) => {
        const headingId = `${base}-g-${encodeURIComponent(group.categoryId)}`;
        return (
          <section
            key={group.categoryId}
            aria-labelledby={headingId}
            className="nx-graph-outline__group"
          >
            <Heading id={headingId} className="nx-graph-outline__heading">
              {group.label} <span className="nx-graph-outline__count">({group.nodes.length})</span>
            </Heading>
            <ul className="nx-graph-outline__nodes">
              {group.nodes.map((node) => {
                const selected = node.id === selectedId;
                return (
                  <li key={String(node.id)}>
                    <details
                      id={keyOf(node.id)}
                      className="nx-graph-outline__node"
                      data-selected={selected || undefined}
                      open={selected || undefined}
                    >
                      <summary
                        aria-label={selected ? `${node.description}, selected` : node.description}
                      >
                        <span className="nx-graph-outline__label">{node.label}</span>
                        <span className="nx-graph-outline__meta">
                          {node.connections.length}{" "}
                          {node.connections.length === 1 ? "connection" : "connections"}
                          {selected ? " · selected" : ""}
                        </span>
                      </summary>
                      {onSelect && (
                        <button
                          type="button"
                          className="nx-graph-outline__select"
                          aria-pressed={selected}
                          onClick={() => onSelect(node.id)}
                        >
                          {selected ? "Selected in graph" : "Select in graph"}
                        </button>
                      )}
                      {node.connections.length > 0 && (
                        <ul
                          className="nx-graph-outline__connections"
                          aria-label={`Connections of ${node.label}`}
                        >
                          {node.connections.map((c, i) => (
                            <li key={`${String(c.id)}-${i}`}>
                              <span className="nx-graph-outline__relation">{c.relation}</span>{" "}
                              <button
                                type="button"
                                className="nx-graph-outline__jump"
                                onClick={() => jumpTo(c.id)}
                              >
                                {c.label}
                              </button>{" "}
                              <span className="nx-graph-outline__kind">{c.kind}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
});

GraphOutline.displayName = "GraphOutline";
