---
"@nexus-cyberdeck/react": minor
---

New **`<GraphOutline>`** component: a graph shown as a list, the text alternative to a node-link canvas. A named region holds the summary, one headed section per category, and a native `<details>` per node listing its connections. Each connection's far node is a button that opens and focuses that node's entry, so the list can be travelled the way the graph can. Pass `onSelect` to add a "Select in graph" button, `selectedId` to open and mark the selected node, and `headingLevel` to fit the page's heading outline. It takes the shape `describeGraph()` from `@nexus-cyberdeck/graph` returns, without depending on that package.
