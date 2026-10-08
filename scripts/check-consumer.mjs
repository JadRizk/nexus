#!/usr/bin/env node
// Installs the three BUILT packages, exactly as `npm pack` would publish them,
// into clean scratch projects on React 18 and on React 19, and checks that a
// consumer can actually use them: ESM import, CJS require, server rendering,
// and a strict TypeScript compile of code written the way the README says to
// write it.
//
// Why this exists alongside the workspace typecheck and test-react.mjs: those
// read the packages' SOURCE, from inside the repository. A
// consumer reads the shipped `dist/*.d.ts` and `exports` map under whichever
// @types/react they have, and several defects only exist from that side.
// useFocusTrap returned `RefObject<T | null>`, which compiled everywhere in
// this repo and failed for any @types/react 18 consumer who passed it to a
// `<div ref>`, because 18 rejects that alias by variance even though the shape
// is identical. Nothing here could see it, because nothing here was a
// consumer. This is that consumer.
//
// Needs the packages built (`npm run build`); CI runs it right after.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packages = ["tokens", "react", "graph"];

for (const name of packages) {
  if (!existsSync(join(root, "packages", name, "dist"))) {
    console.error(`packages/${name}/dist is missing — run \`npm run build\` first.`);
    process.exit(1);
  }
}

// Pinned, not resolved: a scratch install has no lockfile, so a moving target
// could turn an unrelated pull request red on a day nobody touched React. The
// compiler and three come from the repository's own lockfile; the two React
// majors are literals, bumped deliberately (the same policy as the sibling
// scripts). The React 19 types are the lockfile's, because that is the 19 the
// repository builds against; the React 18 ones are literals too, since the
// lockfile no longer holds an 18 — the same pins scripts/test-react.mjs uses.
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages;
const locked = (name) => {
  const version = lock[`node_modules/${name}`]?.version;
  if (!version) {
    console.error(`${name} is not in package-lock.json — run npm install.`);
    process.exit(1);
  }
  return `${name}@${version}`;
};

const MAJORS = [
  {
    label: "React 18",
    deps: ["react@18.3.1", "react-dom@18.3.1", "@types/react@18.3.31", "@types/react-dom@18.3.7"],
  },
  {
    label: "React 19",
    deps: ["react@19.3.0", "react-dom@19.3.0", locked("@types/react"), locked("@types/react-dom")],
  },
];

const ESM = `
import React from "react";
import { renderToString } from "react-dom/server";
import { NexusProvider, Panel, Button, Stat, useHotkey } from "@nexus-cyberdeck/react";
import * as tokens from "@nexus-cyberdeck/tokens";
import * as graph from "@nexus-cyberdeck/graph";

const html = renderToString(
  React.createElement(
    NexusProvider,
    null,
    React.createElement(
      Panel,
      null,
      React.createElement(Button, { className: "mine" }, "GO"),
      React.createElement(Stat, { label: "A", value: "1" }),
    ),
  ),
);
// A caller's className is merged onto the built-in one, not substituted for it.
if (!/class="[^"]*\\bnx-btn\\b[^"]*\\bmine\\b/.test(html)) throw new Error("Button lost nx-btn or className: " + html);
if (typeof useHotkey !== "function") throw new Error("useHotkey missing");
if (!Object.keys(tokens).length || !Object.keys(graph).length) throw new Error("empty entry point");
console.log("  ESM + server render ok");
`;

const CJS = `
const { renderToString } = require("react-dom/server");
const React = require("react");
const r = require("@nexus-cyberdeck/react");
const t = require("@nexus-cyberdeck/tokens");
const g = require("@nexus-cyberdeck/graph");
renderToString(React.createElement(r.NexusProvider, null, React.createElement(r.Panel, null, "x")));
if (!Object.keys(t).length || !Object.keys(g).length) throw new Error("empty entry point");
console.log("  CJS ok");
`;

// Written the way the READMEs write it, compiled strictly, with the packages'
// own declaration files checked too (no skipLibCheck).
const CONSUMER = `
import { useState } from "react";
import {
  Button, CommandPalette, Drawer, Panel, Stat, TabStrip, Tooltip,
  useFocusTrap, useHotkey,
} from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import { tone } from "@nexus-cyberdeck/tokens";

// The hook's ref goes straight onto a DOM node, on either @types/react, with
// no cast; and it is honestly nullable.
export function Modal() {
  const ref = useFocusTrap<HTMLDivElement>(true, () => {});
  const el: HTMLDivElement | null = ref.current;
  return <div ref={ref} data-has-node={el !== null} />;
}
export function ButtonTrap() {
  const ref = useFocusTrap<HTMLButtonElement>(true);
  return <button ref={ref} />;
}

export function Page() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"a" | "b">("a");
  const items: PaletteItem[] = [{ id: 1, label: "one" }];
  useHotkey("mod+k", () => setOpen((v) => !v));
  return (
    <Panel>
      <Button onClick={() => setOpen(true)}>open</Button>
      <TabStrip tabs={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} value={tab} onChange={setTab} />
      <Stat label="x" value="1" style={{ marginTop: 4 }} />
      <Tooltip x={0} y={0}>hi</Tooltip>
      <Drawer open={open} onClose={() => setOpen(false)} title="t" />
      <CommandPalette open={open} onClose={() => setOpen(false)} items={items} onSelect={() => {}} />
    </Panel>
  );
}

// Closed prop interfaces are a documented claim: a prop that is not listed is a
// compile error for a consumer, not silently dropped.
// @ts-expect-error Stat takes label, value and style; it has no className.
export const closed = <Stat label="x" value="1" className="nope" />;

export const g = GraphCanvas;
export const t = tone;
`;

const TSCONFIG = {
  compilerOptions: {
    strict: true,
    jsx: "react-jsx",
    module: "nodenext",
    moduleResolution: "nodenext",
    target: "es2022",
    noEmit: true,
    skipLibCheck: false,
    types: [],
  },
  include: ["consumer.tsx"],
};

const run = (cmd, args, cwd, extra = {}) =>
  execFileSync(cmd, args, { cwd, stdio: ["ignore", "inherit", "inherit"], ...extra });

const work = mkdtempSync(join(tmpdir(), "nx-consumer-"));

try {
  const tarballs = join(work, "tarballs");
  mkdirSync(tarballs);
  const files = packages.map((name) => {
    const out = execFileSync("npm", ["pack", "--silent", "--pack-destination", tarballs], {
      cwd: join(root, "packages", name),
      encoding: "utf8",
    });
    return join(tarballs, out.trim().split("\n").pop());
  });

  for (const { label, deps } of MAJORS) {
    console.log(`${label}:`);
    const dir = join(work, label.replace(/\s/g, "-").toLowerCase());
    mkdirSync(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "consumer", private: true }));
    writeFileSync(join(dir, "esm.mjs"), ESM);
    writeFileSync(join(dir, "cjs.cjs"), CJS);
    writeFileSync(join(dir, "consumer.tsx"), CONSUMER);
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(TSCONFIG));

    // All three tarballs in one install: @nexus-cyberdeck/react depends on an
    // exact @nexus-cyberdeck/tokens version that is not on the registry yet,
    // and npm resolves it from the tarball given alongside.
    run(
      "npm",
      [
        "install",
        "--silent",
        "--no-audit",
        "--no-fund",
        ...deps,
        locked("three"),
        locked("typescript"),
        ...files,
      ],
      dir,
    );
    run("node", ["esm.mjs"], dir);
    run("node", ["cjs.cjs"], dir);
    run("npx", ["tsc", "-p", "."], dir);
    console.log("  strict consumer compile ok");
  }
  console.log("OK — the built packages work for a consumer on React 18 and React 19.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
