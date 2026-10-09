---
"@nexus-cyberdeck/graph": minor
---

`<GraphCanvas>` remembers where the reader has been, so you can offer a Back button.

- **`controller.back()`** returns to where the reader was before their last move: clicking another node, clearing the selection, or (with keyboard navigation, coming next) following a connection. It restores the selection they had there through `onSelect`, exactly like a click.
- **`controller.canGoBack`** is true when there is somewhere to go back to. Read it after a selection change to enable or disable your button.
- **`LinkCategory.verb` and `inverseVerb`** set how a screen reader reads a relation from each end, e.g. `"cites"` and `"cited by"`. Without them the category's label is used ("cite to", "cite from").
