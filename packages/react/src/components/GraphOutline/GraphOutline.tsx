import { forwardRef, useId, useRef } from "react";
import type { CSSProperties } from "react";

// describeGraph()'s output, declared by shape so this package needn't depend on @nexus-cyberdeck/graph.

export interface GraphOutlineConnection {
  /** As read from the node it is listed under, e.g. "cited by". */
  relation: string;
  id: string | number;
  label: string;
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
  /** Accessible name. Default "Graph as a list". */
  label?: string;
  selectedId?: string | number | null;
  /** When given, each node offers a "Select in graph" button. */
  onSelect?: (id: string | number) => void;
  /** Level of the category headings. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5;
  style?: CSSProperties;
  className?: string;
}

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
  const baseId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const Heading = `h${headingLevel}` as const;
  // Encoded, so a space in a node id can't split one idref into two.
  const keyOf = (id: string | number) => `${baseId}-n-${encodeURIComponent(String(id))}`;

  // A button, not a #link: hash routers treat any # change as navigation.
  const jumpTo = (id: string | number) => {
    const entry = rootRef.current?.querySelector<HTMLDetailsElement>(`[id="${keyOf(id)}"]`);
    if (!entry) return;
    entry.open = true;
    entry.querySelector("summary")?.focus();
  };

  return (
    <section
      ref={(el) => {
        rootRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      aria-label={label}
      className={["nx-graph-outline", className].filter(Boolean).join(" ")}
      style={style}
    >
      <p className="nx-graph-outline__summary">{data.summary}</p>
      {data.groups.map((group) => {
        const headingId = `${baseId}-g-${encodeURIComponent(group.categoryId)}`;
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
                const isSelected = node.id === selectedId;
                return (
                  <li key={String(node.id)}>
                    <details
                      id={keyOf(node.id)}
                      className="nx-graph-outline__node"
                      data-selected={isSelected || undefined}
                      open={isSelected || undefined}
                    >
                      <summary
                        aria-label={isSelected ? `${node.description}, selected` : node.description}
                      >
                        <span className="nx-graph-outline__label">{node.label}</span>
                        <span className="nx-graph-outline__meta">
                          {node.connections.length}{" "}
                          {node.connections.length === 1 ? "connection" : "connections"}
                          {isSelected ? " · selected" : ""}
                        </span>
                      </summary>
                      {/* Once selected the button becomes a note, so focus moves to the entry first. */}
                      {onSelect &&
                        (isSelected ? (
                          <p className="nx-graph-outline__selected">Selected in graph</p>
                        ) : (
                          <button
                            type="button"
                            className="nx-graph-outline__select"
                            onClick={(event) => {
                              event.currentTarget
                                .closest("details")
                                ?.querySelector("summary")
                                ?.focus();
                              onSelect(node.id);
                            }}
                          >
                            Select in graph
                          </button>
                        ))}
                      {node.connections.length > 0 && (
                        <ul
                          className="nx-graph-outline__connections"
                          aria-label={`Connections of ${node.label}`}
                        >
                          {node.connections.map((connection, i) => (
                            <li key={`${String(connection.id)}-${i}`}>
                              <span className="nx-graph-outline__relation">
                                {connection.relation}
                              </span>{" "}
                              <button
                                type="button"
                                className="nx-graph-outline__jump"
                                onClick={() => jumpTo(connection.id)}
                              >
                                {connection.label}
                              </button>{" "}
                              <span className="nx-graph-outline__kind">{connection.kind}</span>
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
