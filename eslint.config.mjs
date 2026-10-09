import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import sonarjs from "eslint-plugin-sonarjs";

/* ============================================================================
   Nexus — lint configuration

   The general rules are ordinary. The one that earns this file is
   `no-primitive-tokens` below: it mechanises the rule the README states and
   nothing previously enforced — a component may reference the semantic layer
   and only the semantic layer.
   ========================================================================== */

/** Primitive custom properties. Named here so the rule fails loudly when one
 *  is added to tokens.css without a semantic alias to reach it through. */
const PRIMITIVES = [
  "void",
  "panel",
  "raised",
  "acid",
  "data",
  "lime",
  "sodium",
  "violet",
  "phosphor",
  "alarm",
  "grey-100",
  "grey-200",
  "grey-300",
  "grey-400",
  "grey-500",
  "grey-600",
];

const PRIMITIVE_RE = `var\\(\\s*--nx-(${PRIMITIVES.join("|")})\\b`;

const PRIMITIVE_MESSAGE =
  "Primitive token used directly. Components may reference only the semantic " +
  "layer (--nx-fg-*, --nx-bg-*, --nx-border-*). --nx-alarm in particular is " +
  "reachable only through --nx-fg-critical — that restraint is the whole " +
  "reason the magenta still reads as a warning.";

const noPrimitiveTokens = {
  "no-restricted-syntax": [
    "error",
    {
      selector: `Literal[value=/${PRIMITIVE_RE}/]`,
      message: PRIMITIVE_MESSAGE,
    },
    {
      selector: `TemplateElement[value.raw=/${PRIMITIVE_RE}/]`,
      message: PRIMITIVE_MESSAGE,
    },
  ],
};

/** Not yet held to the code-style rules (docs/code-style.md): graph is still
 *  being merged from its fork, and .design-sync is tooling output. */
const NOT_YET_STYLED = ["packages/graph/**", ".design-sync/**"];

const TEST_FILES = ["**/*.test.{ts,tsx,js,jsx,mjs}", "**/*.spec.ts"];

/** What `strict` and `stylistic` add beyond `recommended`, at warn. Rules
 *  `recommended` already sets keep their severity and options. */
const recommendedRules = Object.assign(
  {},
  ...tseslint.configs.recommended.map((config) => config.rules),
);
const stricterRules = Object.fromEntries(
  [...tseslint.configs.strict, ...tseslint.configs.stylistic]
    .flatMap((config) => Object.entries(config.rules ?? {}))
    .filter(([rule]) => !(rule in recommendedRules))
    .map(([rule, setting]) => {
      // Core rules the TS versions replace stay off.
      if (setting === "off") return [rule, setting];
      const options = Array.isArray(setting) ? setting.slice(1) : [];
      return [rule, ["warn", ...options]];
    }),
);

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "ds-bundle/**",
      "**/coverage/**",
      "browser/.results/**",
      "playwright-report/**",
      ".ds-sync/**",
      // Generated from packages/react/src by scripts/build-preview.mjs; the
      // CI drift check is what guards this file, not the linter.
      "reference/preview.jsx",
      // Generated from tokens.json by packages/tokens/build-tokens.mjs; the CI
      // drift check guards these, not the linter.
      "packages/tokens/src/contrast.gen.ts",
      "packages/tokens/src/tokens.css",
      "packages/react/src/styles.css",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...noPrimitiveTokens,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Warn, not error. Every current hit is a real prop-mirroring bug that
      // needs a deliberate API decision to unpick — NexusProvider's theme prop
      // is both controlled and uncontrolled, and making it one or the other
      // changes the contract the showcase's theme switcher relies on. Tracked
      // as its own piece of work rather than silenced here.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Build scripts and config run in Node, not the browser.
  {
    files: ["scripts/**", "**/*.mjs", "**/*.config.{ts,mjs}"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },

  // The token packages are where primitives are *defined*, so the rule that
  // bans referencing them cannot apply to the definitions themselves.
  {
    files: ["packages/tokens/src/**"],
    rules: { "no-restricted-syntax": "off" },
  },

  // @nexus-cyberdeck/graph binds colours to the GPU (Three.js parses real hex, not
  // custom properties), so it holds documented fallback literals by necessity.
  {
    files: ["packages/graph/src/**"],
    rules: { "no-restricted-syntax": "off" },
  },

  {
    files: ["**/*.test.{ts,tsx}", "**/vitest.setup.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // Code style, all at warn until a package reaches zero (the ratchet in
  // docs/code-style.md).
  {
    ignores: NOT_YET_STYLED,
    rules: stricterRules,
  },

  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    ignores: NOT_YET_STYLED,
    plugins: { sonarjs },
    rules: {
      "sonarjs/cognitive-complexity": ["warn", 12],
      "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 3],
      "max-params": ["warn", 4],
    },
  },

  // Type-aware, so only where a tsconfig covers the file. Properties are
  // left alone so public props keep their names.
  {
    files: ["{packages/react,packages/tokens,apps/showcase}/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: ["variable", "parameter"],
          types: ["boolean"],
          format: null,
          leadingUnderscore: "allow",
          prefix: ["is", "has", "can", "should", "did"],
        },
        {
          selector: ["variable", "parameter"],
          modifiers: ["destructured"],
          types: ["boolean"],
          format: null,
        },
        {
          selector: "parameter",
          filter: { regex: "^.$", match: true },
          types: ["boolean"],
          format: null,
        },
        {
          selector: "parameter",
          modifiers: ["unused"],
          types: ["boolean"],
          format: null,
        },
      ],
    },
  },

  // Promotions go above this point; exemptions stay last so a promotion can't re-enable them.

  // The extension is the closest stand-in for "React component", and
  // cognitive complexity already catches the components that need splitting.
  {
    files: ["**/*.{tsx,jsx}", ...TEST_FILES],
    ignores: NOT_YET_STYLED,
    rules: { "max-lines-per-function": "off" },
  },

  {
    files: TEST_FILES,
    ignores: NOT_YET_STYLED,
    rules: { "@typescript-eslint/no-empty-function": "off" },
  },

  prettier,
);
