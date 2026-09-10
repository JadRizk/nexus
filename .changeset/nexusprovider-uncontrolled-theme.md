---
"@nexus-cyberdeck/react": major
---

`NexusProvider`'s `theme` and `crt` props are now initial values only —
changing either prop on a live provider no longer does anything. Previously
the provider was both controlled and uncontrolled: `theme`/`crt` seeded
`useState` and were then re-synced from the props on every render through a
pair of `useEffect` calls, with no `onThemeChange` to tell a consumer the
value had moved, and no way to opt out of the prop-sync short of never
changing the prop.

The provider is now uncontrolled by design. `theme` and `crt` seed state on
mount and are not read again; `useNexus().setTheme` and `useNexus().setCrt`
are the only way to change them afterward. The context value is also now
memoised, so a component that only calls `useNexus()` no longer re-renders
every time `NexusProvider` itself re-renders.

**Breaking for any consumer that changes the `theme` or `crt` prop on a
mounted `NexusProvider` and expects the live theme to follow.** That pattern
now does nothing silently. Switch to holding the value yourself and calling
`useNexus().setTheme(...)` / `useNexus().setCrt(...)` instead — see the
"Use" section of the react package README for the updated contract.
