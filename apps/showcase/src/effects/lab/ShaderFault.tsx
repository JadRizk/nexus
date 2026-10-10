/** What the lab shows instead when the engine cannot start. */
export function ShaderFault({ message }: { readonly message: string }) {
  return (
    <div
      style={{
        background: "var(--nx-bg-canvas)",
        color: "var(--nx-fg-critical)",
        height: "100%",
        padding: "var(--nx-space-8)",
        fontFamily: "var(--nx-font-mono)",
        fontSize: "var(--nx-text-sm)",
        lineHeight: 1.8,
      }}
    >
      <div style={{ letterSpacing: "var(--nx-track-wider)", marginBottom: "var(--nx-space-4)" }}>
        ▚ SHADER FAULT
      </div>
      <div style={{ color: "var(--nx-fg-subtle)" }}>{message}</div>
    </div>
  );
}
