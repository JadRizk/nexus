/* ============================================================================
   Nexus — stylelint configuration

   Same intent as the ESLint config: enforce the rules this design system
   actually has, and stay out of the way of the house style it already uses
   consistently. Every rule switched off below is switched off because the
   codebase makes a deliberate, uniform choice that differs from the standard
   config's default — not because it was easier than fixing the CSS.
   ========================================================================== */

export default {
  extends: "stylelint-config-standard",
  rules: {
    // Tokens are prefixed. The two-letter exceptions are the corner-tick
    // locals in Panel (--tl/--tr/--bl/--br), which are scoped to one rule and
    // are deliberately not part of the token surface.
    "custom-property-pattern": "^(nx-[a-z0-9-]+|[tb][lr])$",
    // `nx-block` and `nx-block__element`. Component tokens made the element
    // form load-bearing: a part that CSS styles needs a name CSS can select.
    "selector-class-pattern": "^nx-[a-z0-9-]+(__[a-z0-9-]+)?$",

    // The rule this file exists for: a component stylesheet may reference the
    // semantic layer only. Overridden below for the files that define the
    // primitives in the first place.
    "declaration-property-value-disallowed-list": {
      "/.*/": [
        "/var\\(\\s*--nx-(void|panel|raised|acid|data|lime|sodium|violet|phosphor|alarm|grey-[1-6]00)\\s*\\)/",
      ],
    },

    // House style: dense, single-line declaration blocks for small rules, and
    // tight comment banners without a blank line above.
    "declaration-block-single-line-max-declarations": null,
    "comment-empty-line-before": null,

    // Required, not stylistic: ::-webkit-slider-thumb and ::-moz-range-thumb
    // are the only way to style a native range input's handle, and keeping the
    // native input is a deliberate accessibility decision.
    "property-no-vendor-prefix": null,
    "selector-pseudo-element-no-unknown": [
      true,
      { ignorePseudoElements: ["-webkit-slider-thumb", "-moz-range-thumb", "-moz-range-track"] },
    ],

    // rgba() is used uniformly across both stylesheets for alpha colours.
    "color-function-alias-notation": null,
    "alpha-value-notation": null,
    "color-function-notation": null,

    // --fix would otherwise strip the blank lines that group the token blocks
    // inside :root, which is the only thing making a 200-line variable list
    // readable.
    "custom-property-empty-line-before": null,

    // --fix lowercased "Menlo", "Impact" and "Haettenschweiler" in the font
    // stacks, treating family names as CSS keywords. Unquoted family names are
    // matched case-insensitively so nothing broke, but rewriting a typeface's
    // name is not a formatting decision this tool gets to make.
    "value-keyword-case": null,

    "declaration-block-no-redundant-longhand-properties": null,
    "no-descending-specificity": null,
  },
  ignoreFiles: [
    // Assembled from the per-component stylesheets, which are linted
    // individually. Linting the aggregate as well reports every problem twice
    // and points at a generated line number.
    "packages/react/src/styles.css",
  ],

  overrides: [
    {
      files: ["packages/tokens/src/*.css"],
      rules: { "declaration-property-value-disallowed-list": null },
    },
  ],
};
