# Screen-reader pass: `@nexus-cyberdeck/graph` 2.0

A release gate from the migration spec (§7 phase 9, §10). Automated tests cover
the DOM, the key map and axe. They can't tell you what a real screen reader
says, or whether browse mode fights the keys. That needs a person, on each
reader below, before 2.0 ships. The research behind the model is small-sample
(8–13 participants), so this pass is also where the key map gets its first
real-world check.

Record results in the release PR, using the table at the end.

## Setup

- Build and serve the showcase from this branch: `npm run dev -w apps/showcase`,
  then open `/#/labs/graph`.
- Readers, each with its usual browser:
  - **NVDA** (latest) with Firefox on Windows
  - **JAWS** (latest) with Chrome on Windows
  - **VoiceOver** with Safari on macOS
  - optional: VoiceOver with Safari on iOS. Expect touch to be weaker: the model
    is built for a keyboard.
- Start each run with the reader in its default mode (browse/virtual cursor
  on), at default verbosity.

## Script

Each step lists what should happen. "Heard" is the live-region text, and
readers may add their own role or state words around it.

1. **Reach the graph.** From the top of the page, Tab (or use the reader's
   landmark/heading navigation) to the graph.
   - Focus lands on one element inside a group named "Knowledge graph of
     Nexus Cyberdeck sample data", announced as a graph (the role description).
   - Heard: "Graph, 200 nodes, 621 connections in 5 kinds." then the node,
     e.g. "LEDGER//ATLAS, atlas, 29 connections".
   - On screen: a ring on that node, and the key hint along the bottom.
   - **Check:** the reader switched to focus/forms mode by itself, or stays
     in it after one press of its usual toggle (NVDA Insert+Space, JAWS
     Enter). Note which.
2. **Browse.** Press → three times, then ←.
   - Heard each time: relation, far node, kind, position, e.g. "links to
     brittle_vector, node. 1 of 29, strongest".
   - The node itself doesn't change; the browsed edge stays bright on screen.
   - **Check:** the arrows aren't swallowed by browse mode.
3. **Direction.** Press ↓, ↓, ↓.
   - Heard: "Outgoing, n connections", "Incoming, n connections", "All
     connections, n connections".
4. **Follow and back.** Browse to a connection, press Enter, then Backspace.
   - Enter: heard the new node. The camera pans if it was off screen.
   - Backspace: heard "Back to <the first node>…".
   - **Check:** Backspace doesn't navigate the browser back.
5. **Describe and help.** Press D, then ?.
   - D: kind, connections by relation, selected or not.
   - ?: the key list.
6. **Select.** Press Space.
   - The details drawer opens on the right. Focus stays on the graph, and the
     node is announced as pressed/selected.
   - Heard: "Selected".
7. **Step out.** Press Escape three times.
   - First: "Deselected", and the drawer closes.
   - Second: nothing (or the tooltip closes, if the pointer was over a node).
   - Third: focus leaves to the graph group itself, not to the page body.
8. **Tab out.** From the graph, press Tab once.
   - Focus goes to the console's first control. There's no second node to tab
     through.
9. **Filtered away.** Focus a node, then use the reader to toggle that node's
   entity class off in the legend, and Tab back into the graph.
   - Heard: a different node, and no silence or "blank".
10. **List view.** Press "View as list" in the console.
    - A region named "Sample graph as a list" with a summary and one heading
      per class. Headings are reachable by the reader's heading navigation.
    - Expanding a node lists "cites ARCHIVE-343 source" and similar. Activating a
      connection's node opens and focuses that node's entry.
    - "Select in graph" opens the drawer for that node.
11. **Reduced motion** (one reader is enough). Turn on the OS reduced-motion
    setting and reload. Nothing moves except what you move. Direction is still
    readable from the end pads.

## Things to note even when a step passes

- Anything announced twice, or not at all.
- How long announcements take to start after a key press (they should be
  immediate).
- Wording that is unclear out loud. That goes back into `describe.ts` or the
  showcase's `verb`/`inverseVerb`.

## Results

| Step | NVDA + Firefox | JAWS + Chrome | VoiceOver + Safari | Notes |
| ---- | -------------- | ------------- | ------------------ | ----- |
| 1    |                |               |                    |       |
| 2    |                |               |                    |       |
| 3    |                |               |                    |       |
| 4    |                |               |                    |       |
| 5    |                |               |                    |       |
| 6    |                |               |                    |       |
| 7    |                |               |                    |       |
| 8    |                |               |                    |       |
| 9    |                |               |                    |       |
| 10   |                |               |                    |       |
| 11   |                |               |                    |       |
