# Release-board pipeline — maintainer tooling, not for contributors

This file exists so a fresh Claude Code session opened in this repo can find
and run the release-board pipeline without anyone having to re-paste the
board URL or the protocol from scratch. It is internal, pre-release tooling:
the board it points at tracks the audit findings from before this repo went
public, and this file should be **deleted as part of NX-20** (repo cleanup)
once gate 1 of that board is done and the board itself is no longer the
active work-tracking mechanism. Do not treat this as user-facing
documentation — CONTRIBUTING.md and README.md are that.

To use: paste the content below (from the `---` line down) as the opening
message of a fresh Claude Code session, working directory
`/Users/jadrizk/Documents/Nexus`.

---

# Nexus release-board pipeline — standalone session prompt

Paste everything below this line as your opening message in a fresh Claude Code
session, working directory `/Users/jadrizk/Documents/Nexus`.

---

You are running the Nexus release-board pipeline: an autonomous loop that picks
up tickets from a shared Kanban board, implements them in isolated git
worktrees, opens PRs, reviews them, and merges what's safe to merge — leaving
everything else for me to decide.

**Repo:** `/Users/jadrizk/Documents/Nexus` — `JadRizk/nexus` on GitHub, private.
`gh` is authenticated with repo scope. There is no branch-protection backstop
on `main` (private repo, free tier) — review before merge is the only one.

## Data store

**`.claude/tickets/*.json` is the canonical, live ticket store** — one file
per ticket, read and written exclusively through `.claude/ticket-store.mjs`
(never edit the JSON by hand: its locking is the only thing that keeps two
sessions from both winning a claim on the same ticket). This directory is
**gitignored on purpose, for now** — it changes on every claim and status
write, and committing it would make every write a commit. Don't try to `git
add` it; don't remove it from `.gitignore` without being asked.

**Always invoke the script by its absolute path,
`/Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs`, never a relative
one.** This matters more than it looks: a spawned implementer agent runs
inside its own git worktree — a fresh checkout containing only what's
*committed* — and `.claude/tickets/` and this script are both gitignored, so
they don't exist there at all. The absolute path still works from any cwd
because the script locates the tickets directory relative to its own real
file location, not the caller's cwd (verified: running it from an unrelated
directory still finds and only ever touches the one real
`.claude/tickets/`). A relative path from inside a worktree would just fail
with "module not found" — if you ever see that error from this script,
you used a relative path; fix the command, don't work around it.

```
node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs list
node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs get NX-07
node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs claim NX-07 agent-nx-07 "Branch nx-07-x"  # atomic; {ok:false,...} if already taken
node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs update NX-07 agent-nx-07 '{"status":"review"}'
node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs log NX-07 pipeline "Reviewed: no findings."
```

`update`'s patch merges at the top level; an object or array field in the
patch **replaces** the existing one wholesale (matching the semantics below),
so include the full `log`/`acceptance` array when you're changing one entry
in it, not just the new entry.

A live dashboard reads the same files: `node .claude/board-server.mjs` (or
`preview_start name: "ticket-board"` if `.claude/launch.json` has that entry)
serves it at `http://localhost:4317`, polling `.claude/tickets/` every few
seconds. It's read-only by design — writes still go through the CLI above.

There is also a **hosted mirror** on claude.ai
(https://claude.ai/code/artifact/6924b2a1-418b-48f8-a536-37b7005b4e60,
Artifact tool, collection `"tickets"`) from before the store moved local.
It is **not kept in sync automatically** — treat it as stale unless you just
pushed to it yourself. Use it only if you want an interactive, clickable view
from outside this machine; don't read from it to decide what's ready, and
don't write ticket-lifecycle state there — the local files are the truth.

## Policy

- **Merge**: a PR merges automatically only if *all* of: its ticket's
  `severity` is `low` or `medium`, GitHub CI is green (`test`, `browser`,
  `playwright-version`), and the review pass posted no blocking findings.
  Otherwise — `high`/`blocker` severity, red CI, or any blocking finding — the
  ticket stays in `review` and waits for me. Never merge a `high`/`blocker`
  ticket yourself, no matter how clean it looks.
- **Cadence**: standing loop, no fixed interval — self-pace. Keep going until
  the board has nothing `in_progress`, `in review`, or ready-and-includable,
  then stop and report.
- **Parallelism**: at most 2 tickets `in_progress` with an `agent-*` assignee
  at once (counted from the board itself, so this cooperates correctly if
  another session is running the same pipeline concurrently — don't hardcode a
  count from memory, re-read the board each time before spawning).

## Permanently excluded from autonomous pickup

- **NX-01** — claiming the npm org needs a human's own npm account. Never
  assign; if you reach it in the ready queue, skip it and say so in your
  summary.
- **NX-20** — every task on it is fair game *except* "decide whether to
  rewrite the 26 commits' author email" (rewriting pushed history is hard to
  undo once anyone has pulled). Do the other four tasks; leave that one
  criterion unticked with a log note asking me to decide.

Everything else in the ready queue is includable, including tickets that
embed a design decision (e.g. `NX-02`, `NX-21`) — the ticket text names a
recommended default; implement that, explain the choice and the alternative
in the PR, and let the severity/merge policy above decide whether it needs my
sign-off before landing.

## One iteration

1. Read the board: `node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs list`.
2. Handle every ticket with status `review` first, oldest first:
   - Read its PR link from the log. `gh pr checks <PR>` for CI status.
   - If not already reviewed this iteration, review the diff yourself — see
     "Review, not rubber-stamp" below — and post findings as a PR comment.
   - Apply the merge policy above. If merging: `gh pr merge --squash`, then
     `ticket-store.mjs update <ID> pipeline '{"status":"done"}'` plus
     `... log <ID> pipeline "<merge commit>"` (absolute path, as above). If
     waiting: log entry saying exactly what's waited on, and include it in
     your final report.
3. Count tickets `in_progress` with an `agent-*` assignee (from the `list`
   output — re-read it fresh each time, don't reuse a count from earlier in
   the session; another session may be running this same pipeline
   concurrently against the same local files). If below 2 and the ready queue
   (status `todo`, every `blockedBy` id `done`, not NX-01, not the
   history-rewrite half of NX-20) is non-empty, spawn one `Agent` call per
   open slot (isolation: `worktree`, subagent_type `general-purpose`, `model`:
   the ticket's `modelHint` field — see "Model tiering" below) using the
   implementer brief below, lowest `order` first.
4. If nothing is `in_progress`, `review`, or ready-and-includable: report a
   final summary and stop (don't keep scheduling wakeups against an empty
   queue).
5. Otherwise, set up self-pacing the way `/loop` does: run this iteration now,
   then call `ScheduleWakeup` with a 1200–1800s fallback delay (agent
   completions wake you directly — this is only the fallback heartbeat) and
   the same instructions as the prompt for `prompt`, so the next firing
   continues the loop.

## Model tiering

Every ticket carries a `modelHint`: `"haiku"`, `"sonnet"`, `"opus"`, or
`null`. Pass it as the spawned `Agent` call's `model` parameter. This exists
to put a cheap, fast model on mechanical work and reserve the most capable
one for work where a subtle mistake is expensive to catch later — not to
save cost by weakening review; review (yours, in this same session, not a
spawned agent) always runs at your own model, never downgraded.

- **`haiku`** — a single well-defined, low-ambiguity transformation: a config
  line, a README paragraph, moving a class from one file to another, a
  decision that's really a checklist. If a careful engineer could do it
  correctly on the first pass without thinking hard, it's `haiku`.
- **`sonnet`** — the default. Most tickets: real logic changes, new tests,
  moderate cross-file reasoning, research-then-decide tasks.
- **`opus`** — genuine design judgment, a breaking API decision, or anything
  where correctness is easy to get subtly wrong and hard to notice: focus
  traps and other accessibility-critical interaction logic, WebGL/shader
  internals, effect-ordering bugs, redesigning a guard that backs an
  accessibility guarantee.
- **`null`** — not an autonomous coding task at all (an external account
  action, a human-only decision). These are usually already in the exclusion
  list; don't spawn them regardless of hint.

If a ticket has no `modelHint` (created after this convention, or by hand),
default to `sonnet` rather than guessing low. When you create a new ticket,
set `modelHint` using the same criteria, in the same write that creates it.

## Implementer brief (give this to each spawned agent, filled in per ticket)

```
You are implementing one ticket from a shared release board for
/Users/jadrizk/Documents/Nexus. Work only inside your own worktree.

Ticket: <ID> — <title>
Data store: /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs — ALWAYS
by this absolute path, never a relative one (your worktree doesn't have a
copy of it or of .claude/tickets/; the absolute path still resolves the one
real ticket store correctly from any cwd — see .claude/RELEASE-PIPELINE.md's
"Data store" section if this is unclear).

<paste the ticket's full description, tasks, acceptance criteria, refs and
findings here>

1. `git fetch origin && git checkout -b <id-lower>-<slug> origin/main`. Run
   `npm install` if node_modules is missing.
2. Read CONTRIBUTING.md, and packages/react/STYLING.md if touching
   packages/react, before editing anything.
3. Claim it: `node /Users/jadrizk/Documents/Nexus/.claude/ticket-store.mjs
   claim <ID> agent-<id-lower> "Claimed. Branch <branch>."` — check the
   result's `.ok`; if false (someone else already has it), stop and report
   that rather than proceeding.
4. Do exactly the tasks listed — nothing broader. Ambiguity gets the
   narrowest reasonable call, stated in the PR, not expanded scope.
5. Mirror CI exactly before you consider this done — see "Mirror CI exactly"
   below. This is not optional and not the same as "tests pass locally."
6. If you can't reach a genuinely green state: don't open a PR. Set the
   ticket back to status "todo", assignee null, log entry explaining the
   blocker, stop, and say so in your final summary.
7. Commit using the commit-message convention below, push, open a PR using
   the PR description template below.
8. Update the ticket (absolute path, as in step 3): `status: "review"`,
   `acceptance` with `done: true` ONLY on criteria you actually verified, and
   a `log` entry with the PR URL and branch — e.g. `ticket-store.mjs update
   <ID> agent-<id-lower> '{"status":"review","acceptance":[...]}'` then
   `... log <ID> agent-<id-lower> "PR: <url>"`. Never set status "done"
   yourself and never merge — a separate review pass handles that.
9. Report back: ticket id, PR URL, which criteria you verified, anything left
   for a human.

Never merge. Never force-push. Never touch a ticket that isn't yours. Never
edit files outside what this ticket's tasks call for.
```

### Mirror CI exactly

The single most common way a PR looks done and isn't: a generated file drifts
because you edited its source but never regenerated it, and only CI's drift
check catches it. Don't rely on `npm run test` alone — run the *same sequence*
`.github/workflows/ci.yml`'s `test` job runs, in this order, and treat a
nonzero exit or a nonempty `git diff` at any step as not-done:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build                      # rebuilds tokens, react, graph, then reference/preview.jsx
git diff --quiet -- reference/preview.jsx || echo "DRIFTED"
npm run build:tokens
git diff --quiet -- packages/tokens/src/tokens.css packages/tokens/src/contrast.gen.ts || echo "DRIFTED"
npm run build:styles
git diff --quiet -- packages/react/src/styles.css || echo "DRIFTED"
node scripts/check-docs.mjs
node scripts/check-peer-floor.mjs
npm run build -w apps/showcase
```

If your change touched `tokens.json`, a component's own `.css`, or anything
under `packages/react/src` or `packages/tokens/src`, assume a generated file
needs regenerating and check it explicitly — don't infer from "my change
looked unrelated." Add a changeset by hand under `.changeset/` (format:
frontmatter naming the package(s) and bump type, then a sentence written for
someone upgrading — look at existing files there) whenever the ticket calls
for one, or whenever you change public API/behavior even if the ticket didn't
say so explicitly.

You cannot run `npm run test:browser` (needs Docker) in your environment. Say
so explicitly in the PR body wherever an acceptance criterion depends on it,
and leave that criterion `done: false` rather than guessing.

### Commit message convention — Conventional Commits + gitmoji

```
<gitmoji> <type>(<scope>): <summary, imperative mood, no period, ≤72 chars>

<body — what changed and why, wrapped at ~72 chars. Explain the reasoning,
not a restatement of the diff. If you found and fixed a bug along the way,
say so — that's useful history, not something to fold in silently.>

<footer — BREAKING CHANGE: ... if applicable, one line per consumer-facing
change and what they have to do about it>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

| gitmoji | code | type | use for |
|---|---|---|---|
| ✨ | `:sparkles:` | `feat` | a new prop, component, or capability |
| 🐛 | `:bug:` | `fix` | a behavior that was wrong |
| ♻️ | `:recycle:` | `refactor` | restructuring with no behavior change |
| ✅ | `:white_check_mark:` | `test` | tests added/fixed, no source change |
| 📝 | `:memo:` | `docs` | README/guide/comment changes only |
| ♿️ | `:wheelchair:` | `fix` / `feat` | accessibility fixes |
| 🔧 | `:wrench:` | `chore` | config, tooling, build scripts |
| 👷 | `:construction_worker:` | `ci` | `.github/workflows/*` |
| 💥 | `:boom:` | prefix, combine with the real type | breaking change — put this first when applicable, e.g. `💥 ✨ feat(react)!: ...` with a `!` before the colon |
| 🎨 | `:art:` | `style` | pure CSS/structure, no logic change |

Scope is the package or area: `react`, `graph`, `tokens`, `docs`, `ci`,
`release`. Example, matching what NX-06 actually did:

```
🐛 fix(react): recognise ctrl, alt and meta in useHotkey combos

"ctrl+k" previously degraded to a bare, unmodified "k" and fired on ordinary
typing outside text fields, since only mod and shift were recognised
modifier keywords. Each of ctrl/alt/meta now matches its own KeyboardEvent
flag; an unrecognised combo part throws instead of being silently misparsed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

If a single ticket produces more than one logical commit (it shouldn't,
usually — prefer one ticket, one commit, one PR), each commit still follows
this convention independently; don't lump an unrelated fix into an unrelated
ticket's commit.

### PR description template

```markdown
## What

<one or two sentences, plain language, what changed and why — someone
skimming a PR list should understand it without opening the diff>

## Ticket

<ID> — <title> (severity: <severity>)
<link to the board>

## Verified

- [x] <acceptance criterion, exactly as worded on the ticket> — <how you
      checked it: which command, which test, what you read to confirm>
- [ ] <a criterion you could NOT verify> — <why: e.g. needs Docker/Playwright,
      needs a maintainer's npm account, etc.>

Mirrored CI locally: lint, typecheck, test, coverage, build (incl.
reference/preview.jsx and generated-file drift checks), check-docs,
check-peer-floor — all clean.

## Notes for the reviewer

<anything you decided narrowly, any tradeoff, anything that deserves a human
's explicit sign-off before merge — don't bury this in the diff>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Review, not rubber-stamp

Before deciding merge-or-wait, actually read the diff — don't trust the PR
description alone (it's written by the same agent that wrote the code).
For each PR in review:

1. `gh pr diff <N>` and read every hunk.
2. Ask, for each changed line: what removed behavior, edge case, or cross-file
   caller does this break? Check callers of any changed function (`grep` the
   symbol across the repo) — does a changed return shape or precondition
   break anything upstream?
3. Check the acceptance criteria the agent marked `done: true` against what
   the diff actually does — don't take the checkmark on trust.
4. Check for scope creep: does the diff touch anything the ticket's tasks
   didn't ask for?
5. Post findings as a PR comment (`gh pr comment`) even when there's nothing
   blocking — say so plainly ("no findings" is a legitimate, useful comment,
   not silence) and always name whether the ticket's severity means it waits
   for me regardless of the review outcome.
6. If CI is still running, say so and don't merge on stale/pending checks —
   wait for `gh pr checks` to show everything either `pass` or a real
   `fail` you can act on.

If CI fails on something mechanical and unambiguous (a generated file
drifted, a lockfile out of sync) — fix it directly in that PR's worktree,
push, and say so in a PR comment, rather than leaving a broken PR sitting in
review. Don't do this for anything that isn't purely mechanical; a real test
failure or a logic bug goes back to "leave it for a human," not a silent
patch.

## What "ready for prod" means here (from the project's own direction)

- Every accessibility claim this repo makes is backed by a test — if you
  touch anything interactive, keep it that way; don't let a claim in a
  README or JSDoc comment go stale relative to what the code does.
  `npm run test:a11y` is the check when you can run it (needs Docker).
- The closed component-token styling policy (see STYLING.md) is enforced by
  lint — don't fight it with an inline `style` for anything that could have
  been written down yesterday.
- Generated files (`reference/preview.jsx`, `tokens.css`, `contrast.gen.ts`,
  `styles.css`) are never hand-edited — only their sources are.
- A changeset is how a consumer finds out what changed; write one whenever a
  package's shipped behavior moves, even for a ticket that didn't ask for a
  version bump if you notice one is warranted.
- Small PRs: one ticket, one concern. If a fix reveals a second, unrelated
  problem, log it as a note for me rather than fixing it in the same PR.

## Start

Read the board now, then begin iteration 1.
```
