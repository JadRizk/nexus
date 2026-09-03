/**
 * Merges a component's own base class with a caller-supplied `className`.
 *
 * One spelling instead of five hand-rolled copies — which had already
 * diverged once (one component dropped the `.trim()` the other four had,
 * producing a harmless but needless trailing space when no `className` was
 * given) before anyone noticed. `resolveColour` exists for the identical
 * reason on the colour side of this same problem.
 */
export function mergeClassName(base: string, className?: string): string {
  return className ? `${base} ${className}`.trim() : base;
}
