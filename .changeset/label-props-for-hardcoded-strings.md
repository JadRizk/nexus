---
"@nexus-cyberdeck/react": minor
---

`Drawer`, `CommandPalette` and `TabStrip` exposed a few accessible names as
hardcoded English strings, so an app localising its UI had no way to change
them. Three new props cover the gap, all defaulting to the previous copy so
existing output — including snapshots — is unchanged unless a consumer opts
in:

- `Drawer` takes `closeLabel` for the close button's accessible name.
  Default: `"Close details"`.
- `CommandPalette` takes `label` for the dialog's own accessible name,
  independent of `placeholder` (which continues to name the input). Default:
  `placeholder`, so the dialog's name is unchanged unless `label` is set
  explicitly.
- `CommandPalette` takes `resultsLabel` for the live-region announcement made
  as results change — a string is announced verbatim, a function receives
  the result count and formats its own text. Default:
  `` `${count} result${count === 1 ? "" : "s"}` ``.
- `TabStrip` already took a `label` prop (default `"View"`) for the tablist's
  accessible name; it now has test coverage confirming the accessible name
  actually changes when it is set.
