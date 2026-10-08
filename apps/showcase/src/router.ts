import { useSyncExternalStore } from "react";

/* ============================================================================
   showcase — hash router
   Every page has a URL, so a page can be linked, bookmarked, reloaded and
   opened in a new tab. Hash rather than history routing because the showcase
   is served from GitHub Pages under /nexus/, which has no rewrite to send a
   deep path back to index.html; a hash never reaches the server at all.

   The route is the hash split on "/": "#/tokens" is ["tokens"], "#/" and ""
   are []. Pages read whatever depth they need, so nested routes (a page per
   component) need no change here.
   ========================================================================== */

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash() {
  return window.location.hash;
}

export function parseHash(hash: string): string[] {
  return hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
}

/** The current route as path segments, re-rendering on every hash change. */
export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  return parseHash(hash);
}

/** The href for a route, for use on a plain `<a>`. */
export function href(...segments: string[]): string {
  return `#/${segments.map(encodeURIComponent).join("/")}`;
}
