import { defineConfig } from "oxlint";
import { antiSlopPlugin, antiSlopRules } from "@nutritual/oxlint-config";

export default defineConfig({
  jsPlugins: [antiSlopPlugin],
  rules: antiSlopRules,
});
