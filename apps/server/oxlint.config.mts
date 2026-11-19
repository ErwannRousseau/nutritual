import { defineConfig } from "oxlint";
import { antiSlopPlugin, antiSlopRules, landminesConfig } from "@nutritual/oxlint-config";

export default defineConfig({
  extends: [landminesConfig],
  jsPlugins: [antiSlopPlugin],
  rules: antiSlopRules,
});
