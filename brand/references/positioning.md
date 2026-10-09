# Positioning

Decided 2026-10-09, before the card was drawn.

## Category and shelf

A design system and component library for React, for dark operator
interfaces: consoles, dashboards, graph and data tools.

It sits on the npm search for "react design system", the GitHub topics
`design-system`, `react`, `hud`, `sci-fi-ui` and `cyberpunk`, and beside the
sci-fi UI kits people find through them.

## What a user would pick instead

| Alternative                                                           | What it does that this does not                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Arwes**                                                             | Animation and sound as first-class features. Its own docs call it alpha, with no strict mode, and it sets no contrast floor.          |
| **augmented-ui**                                                      | Clipped-corner frames in plain CSS, with no framework. It is a styling layer, not a component set, and takes no position on contrast. |
| **A general library, re-skinned** (shadcn/ui, Radix Themes, MUI dark) | Mature accessibility and a large component set. The HUD has to be forced in against its radius, elevation and palette.                |
| **A hand-rolled HUD on Tailwind**                                     | What most dashboards actually do. The look arrives in an afternoon; the contrast floor never does.                                    |
| **A game UI kit** (Figma or Unity assets)                             | Polished art. Images, not components, and no keyboard or screen-reader story.                                                         |

## Onliness statement

> Nexus Cyberdeck is the only HUD design system for React whose accessible
> mode is the default and is enforced by its own build.

Tested against each alternative:

- **Arwes** cannot say it: it has no AA mode and no build-time check.
- **augmented-ui** cannot say it: it is not a design system and has no theme.
- **A re-skinned general library** cannot say it: it is not a HUD until someone
  re-skins it, and the re-skin is where contrast is lost.
- **A hand-rolled HUD** cannot say it: nothing enforces anything.
- **A game UI kit** cannot say it: it ships no code.

What it refuses that the category treats as normal: shipping the immersive look
as the default and leaving contrast to the consumer.

## One-liner

> A HUD design system for React, with WCAG AA enforced at build.

Twelve words. It is the GitHub repository description, `og:description` and
the manifest `description`. The packages keep their own, longer descriptions,
and the README keeps its longer opening paragraph.

The meta description extends it to 50–160 characters:

> A HUD design system for React: acid on near-black, zero radius, monospace,
> WCAG AA enforced at build, and a WebGL graph canvas.

## Tagline

> **The HUD that passes the audit.**

- **Delete test.** Strike the name and it still points at one product. No
  other HUD kit on the shelf can claim it.
- **Register test.** Sentence case and a full stop, as `BRAND.md` asks of
  prose. On the card it is set in the mono face, not the stencil.
- **Surface test.** Six words, no punctuation a crawler strips, and it reads at
  card size inside the centre 66%.

Refused on the record:

- _"Enforced, not promised."_ Lifted from the README, and it fails the delete
  test: it could sit under a linter or a policy engine.
- _"Neon that clears 4.5:1."_ True and specific, but it compresses one claim,
  text contrast, rather than the thesis, and the ratio reads as jargon on a card.

## Where each string lives

| String                                                     | Surfaces                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Nexus Cyberdeck** (wordmark form)                        | Lockup, `<title>`, `og:site_name`, `og:title`, README heading, social card                             |
| **NEXUS CYBERDECK** / **NEXUS** (wordmark form, uppercase) | The stencil wordmark. `NEXUS` alone only in tight chrome next to the mark, such as the showcase header |
| **nexus-cyberdeck** (identifier)                           | npm scope `@nexus-cyberdeck/*`, handles, any future domain                                             |
| One-liner                                                  | Repo description, `og:description`, manifest `description`                                             |
| Meta description                                           | `<meta name="description">`, `twitter:description`                                                     |
| Tagline                                                    | Social card, README header, `og:title` after the name, the showcase Home hero                          |
| Onliness statement                                         | This file and `BRAND.md` only. It is a test, not copy.                                                 |
