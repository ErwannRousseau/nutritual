import recommended from "@interfere/landmines/configs/recommended.json" with { type: "json" };
import type { DummyRuleMap, ExternalPluginEntry, OxlintConfig } from "oxlint";

export const antiSlopPlugin = {
  name: "anti-slop",
  specifier: "@nutritual/oxlint-config/anti-slop",
} satisfies ExternalPluginEntry;

export const landminesConfig = {
  jsPlugins: recommended.jsPlugins.map((plugin) => ({
    ...plugin,
    specifier: import.meta.resolve(plugin.specifier),
  })),
  rules: {
    ...(recommended.rules as DummyRuleMap),
    "landmines-style/no-comments": ["error", { allow: ["WARNING", "SAFETY", "INFO", "DOCS"] }],
  },
  overrides: [
    {
      files: ["**/__tests__/**"],
      rules: { "landmines-structure/test-file-names": "off" },
    },
  ],
} satisfies OxlintConfig;

export const antiSlopRules = {
  "oxc/no-accumulating-spread": "error",
  "anti-slop/no-array-filter-map": "error",
  "anti-slop/no-reduce-accumulator-copy": "error",
  "anti-slop/no-chained-type-assertions": "error",
  "anti-slop/no-conditional-empty-object-spread": "error",
  "anti-slop/no-known-value-widening": "error",
  "anti-slop/no-module-mocking": "error",
  "anti-slop/no-object-parameters": "error",
  "anti-slop/no-reflect-apply": "error",
  "anti-slop/no-reflect-get": "error",
  "anti-slop/no-runtime-typeof": "error",
  "anti-slop/no-shape-in-symbol-names": "error",
  "anti-slop/no-unknown-parameters": "error",
  "anti-slop/no-unknown-returns": "error",
  "anti-slop/no-unknown-type-aliases": "error",
  "anti-slop/no-unsafe-dictionary-type": "error",
  "anti-slop/no-widen-then-assert": "error",
  "anti-slop/require-readable-spacing": "error",
  "anti-slop/require-safety-comment-for-type-assertion": "error",
} satisfies DummyRuleMap;
