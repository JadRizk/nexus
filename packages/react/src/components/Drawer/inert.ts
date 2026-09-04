/* ============================================================================
   @nexus-cyberdeck/react — the `inert` spelling, per React major

   Internal: not re-exported from Drawer/index.ts, so it is not public API.
   It is its own module purely so both branches can be tested — only one of
   them is reachable under whichever React the test runner happens to install,
   and the branch that is not is the one that broke.
   ========================================================================== */

/**
 * `inert` is a standard DOM boolean attribute, and the two supported React
 * majors want it spelled differently.
 *
 * React 18 does not recognise the name as boolean-valued and warns if given a
 * JS boolean, so it needs the `""` idiom HTML itself uses for boolean
 * attributes, which it renders as-is. React 19 *does* classify `inert` as
 * boolean, and therefore reads `""` as false: it drops the attribute entirely
 * and warns. Passing `""` to both left every React 19 consumer with a closed
 * Drawer that was `aria-hidden` but still in the tab order — offscreen buttons
 * a keyboard user could reach and a screen reader was told did not exist,
 * which is the precise defect `inert` is there to prevent.
 *
 * Anything that is not React 18 gets the standards-correct boolean, so a
 * future major inherits the right behaviour rather than the legacy shim.
 */
export function inertAttr(reactVersion: string): boolean | string {
  return /^18\./.test(reactVersion) ? "" : true;
}
