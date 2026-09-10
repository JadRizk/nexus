# @nexus-cyberdeck/tokens

This stylesheet styles `html` and `body` directly because the system expects
to own the viewport, not share the page with other content.

Design tokens for the [Nexus Cyberdeck](https://github.com/JadRizk/nexus#readme)
HUD design system. Plain CSS custom properties with zero runtime dependencies,
plus typed accessors for TypeScript, plus contrast ratios computed at build
time from the token values themselves.

Two themes ship, both dark:

|                        | `hud-aa` (default)        | `hud`                    |
| ---------------------- | ------------------------- | ------------------------ |
| Muted ramp             | lifted, WCAG AA-compliant | the prototype's original |
| Type scale             | ×1.15                     | ×1.0                     |
| Disabled text contrast | 4.82:1                    | 2.14:1                   |
| UI boundary contrast   | 3.19:1                    | 1.21:1                   |

The signature colours are identical in both. Only the muted grey ramp and the
type scale differ, which is why switching themes never touches component code.

Those ratios are measured against the panel surface, `--nx-bg-surface`, as
every ratio in this system is. The floors themselves are enforced against
every opaque background a component can render on, so the ramp is solved
against the lightest of them, `--nx-bg-raised`: the same two steps are 4.54:1
and 3.00:1 there.

## Install

```bash
npm install @nexus-cyberdeck/tokens
```

> Not published yet. Until the first release, install from `npm pack` output —
> see the [getting-started guide](https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md).

## Use

Import the stylesheet once and set `data-nx-theme` on any element. The custom
properties cascade from there.

```ts
import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/tokens/crt.css"; // optional scanline layer
```

```html
<div data-nx-theme="hud-aa" class="nx-root">
  <p style="color: var(--nx-fg-accent)">ACID</p>
</div>
```

`.nx-root` applies the canvas background, phosphor foreground, monospace
family and base type size, and hosts the global focus ring.

### Typed handles

Every accessor returns a `var(--nx-…)` string, so the name cannot be misspelt
and the value follows the active theme:

```ts
import { tone, surface, border, space, text, track, font } from "@nexus-cyberdeck/tokens";

tone("critical"); // "var(--nx-fg-critical)"
space(5); // "var(--nx-space-5)"
text("md"); // "var(--nx-text-md)"
```

### Contrast at runtime

```ts
import { contrast, themeMeetsAA, WCAG } from "@nexus-cyberdeck/tokens";

contrast["hud-aa"]["grey-300"] >= WCAG.AA_TEXT; // true
themeMeetsAA("hud"); // false, by design
```

The ratios are generated from `tokens.json` at build time and the build fails
if a theme misses the floors it declares for itself.

## Token layers

```
primitive   --nx-acid, --nx-grey-300          raw values, never used directly
semantic    --nx-fg-accent, --nx-border-strong roles, the surface you build on
```

| Purpose           | Tokens                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground        | `--nx-fg-default`, `-muted`, `-subtle`, `-tertiary`, `-disabled`, `-accent`, `-info`, `-warning`, `-critical`, `-cat-lime`, `-cat-violet` |
| Background        | `--nx-bg-canvas`, `-surface`, `-raised`, `-hover`, `-active`, `-track`                                                                    |
| Border            | `--nx-border-default`, `-strong`, `-accent`                                                                                               |
| Space (2 px base) | `--nx-space-0` … `--nx-space-8`                                                                                                           |
| Type size         | `--nx-text-2xs` … `--nx-text-xl`                                                                                                          |
| Tracking          | `--nx-track-tight`, `-normal`, `-wide`, `-wider`                                                                                          |
| Family            | `--nx-font-mono`, `--nx-font-stencil`                                                                                                     |
| Motion            | `--nx-dur-micro`, `-fade`, `-panel`, `--nx-ease`, `--nx-blink`                                                                            |
| Focus             | `--nx-focus-ring`, `--nx-focus-width`, `--nx-focus-offset`                                                                                |

Magenta (`--nx-alarm`) is reachable only through `--nx-fg-critical`. That
restraint is what makes it read as a warning.

## Design tools

`tokens.json` is written in [W3C DTCG](https://tr.designtokens.org/format/)
shape (`$value`/`$type`/`$description`), but values are CSS strings (hex
colours, `rem`/`ms` dimensions, `cubic-bezier()`) rather than the newer
structured DTCG value shapes — so treat it as DTCG-flavoured rather than a
strict DTCG document a tool is guaranteed to import unchanged:

```ts
import tokens from "@nexus-cyberdeck/tokens/tokens.json";
```

## Accessibility notes

- Type sizes are `rem` multiplied by a per-theme scale, so browser zoom and
  user font-size preferences keep working (WCAG 1.4.4).
- `--nx-blink` is capped at 0.94 Hz, below the 3 Hz flash threshold (WCAG 2.3.1).
- `crt.css` switches off entirely under `prefers-contrast: more` and
  `data-nx-crt="off"`. Under `prefers-reduced-motion` its one animation — the
  rolling refresh bar — stops and the bar is removed; the static scanlines
  remain, because they are texture rather than motion.

## License

MIT
