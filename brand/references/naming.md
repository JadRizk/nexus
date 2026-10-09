# Naming

The name was settled before this document; its written forms were not. Five
spellings were in use on 2026-10-09: `Nexus Cyberdeck`, `NEXUS`,
`@nexus-cyberdeck`, `nexus` and `nx-`. This file decides which ones are forms
and which are abbreviations.

## Pronunciation

_NEK-sus SY-ber-deck._ Said once here and once in `BRAND.md`.

## The written forms

Two, and no third.

| Form           | Spelling          | Surfaces                                                   |
| -------------- | ----------------- | ---------------------------------------------------------- |
| **Wordmark**   | `Nexus Cyberdeck` | Titles, prose, README heading, social card, `og:site_name` |
| **Identifier** | `nexus-cyberdeck` | npm scope, handles, a future domain                        |

The wordmark form's uppercase is how the stencil wordmark renders it:
`NEXUS CYBERDECK`, or `NEXUS` alone in tight chrome beside the mark. That is
the same form set in capitals, not a third form.

Two abbreviations of the identifier already exist and stay, because renaming
them is a breaking change with no reader benefit:

- `nexus`: the GitHub repository slug, and so the Pages path `/nexus/`.
- `nx`: the CSS custom-property and class prefix, `--nx-…` and `.nx-…`.

**Refused:**

- `Nexus` alone in prose. It collides with Sonatype Nexus, GraphQL Nexus and
  Google Nexus; see the sweep below.
- `Nexus CyberDeck`, `NexusCyberdeck`, `Nexus-Cyberdeck`. Title Case and
  CamelCase are the third forms nobody decided on.
- `Cyberdeck` alone. It is a generic word and a registered mark in other
  classes.
- `Nexus DS`. The showcase chrome says `DS v1.0` next to the wordmark; that is
  a version label, not a name.

## Collision sweep

All checks run 2026-10-09.

| Check                  | Where                                                              | Result                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm, bare              | `npm view nexus`                                                   | **Taken**: GraphQL Nexus, v1.3.0                                                                                                                                                                                                                                  |
| npm, bare              | `npm view cyberdeck`                                               | **Taken**: v0.0.10                                                                                                                                                                                                                                                |
| npm, bare              | `npm view nexus-cyberdeck`                                         | Free (404)                                                                                                                                                                                                                                                        |
| npm, scope             | `npm view @nexus-cyberdeck/{tokens,react,graph}`                   | Free (404). Nothing published yet                                                                                                                                                                                                                                 |
| npm, scope ownership   | `npmjs.com/org/nexus-cyberdeck`                                    | **Not verified.** The page returns 403 to an anonymous client. Confirm the org exists under the maintainer's account before the first publish                                                                                                                     |
| GitHub                 | `github.com/nexus-cyberdeck`, `github.com/nexuscyberdeck`          | Free (404)                                                                                                                                                                                                                                                        |
| GitHub                 | `github.com/JadRizk/nexus`                                         | The repository                                                                                                                                                                                                                                                    |
| Domain                 | `nexuscyberdeck.com`, `.dev`, `.io`; `nexus-cyberdeck.com`, `.dev` | No DNS delegation. Probably unregistered; WHOIS not checked. Nothing registered                                                                                                                                                                                   |
| Domain                 | `cyberdeck.dev`                                                    | **Taken**, served through Cloudflare                                                                                                                                                                                                                              |
| Handles                | Any platform                                                       | Not checked. No posting account is planned                                                                                                                                                                                                                        |
| Trademark, preliminary | Web search of USPTO aggregators                                    | No `NEXUS CYBERDECK` mark found. `CYBERDECK` is registered (US 6599244, 2021, keyboard and display interconnects) and applied for in class 28 (games, 2023). Many `NEXUS` marks exist, including software. Not a TESS, EUIPO or WIPO search, and not legal advice |
| Language               | Search with quotes                                                 | `cyberdeck` is Gibson's coinage and now a generic term. No unwanted reading found                                                                                                                                                                                 |
| Confusability          | The category's popular names                                       | `Nexus` alone is close to Sonatype Nexus Repository and GraphQL Nexus. The compound is distinct. This is why `Nexus` alone is refused                                                                                                                             |

## The name and the thesis

The name is the metaphor: a cyberdeck is the console an operator works from,
and a nexus is the point where the graph's links meet. The mark does not
illustrate either. It is the name's own initial in the stencil face, so it
carries the name rather than a picture of it.
