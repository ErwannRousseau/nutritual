import { defineConfig } from "oxlint";
import { antiSlopPlugin, antiSlopRules, landminesConfig } from "@nutritual/oxlint-config";

export default defineConfig({
  extends: [landminesConfig],
  jsPlugins: [antiSlopPlugin],
  rules: {
    ...antiSlopRules,
    // INFO: Protocol guards parse untrusted external data at runtime.
    "anti-slop/no-runtime-typeof": "off",
    "anti-slop/no-unsafe-dictionary-type": "off",
  },
});
