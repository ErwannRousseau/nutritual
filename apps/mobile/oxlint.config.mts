import { defineConfig } from "oxlint";
import { antiSlopPlugin, antiSlopRules } from "@nutritual/oxlint-config";

export default defineConfig({
  jsPlugins: [
    "eslint-plugin-expo",
    { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
    antiSlopPlugin,
  ],
  rules: {
    "expo/use-dom-exports": "error",
    "expo/no-env-var-destructuring": "error",
    "expo/no-dynamic-env-var": "error",
    "react-doctor/no-fetch-in-effect": "warn",
    "react-doctor/no-derived-state": "warn",
    ...antiSlopRules,
  },
});
