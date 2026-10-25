import { defineConfig } from "oxlint";
import { antiSlopPlugin, antiSlopRules } from "@nutritual/oxlint-config";

export default defineConfig({
  jsPlugins: [antiSlopPlugin],
  rules: {
    ...antiSlopRules,
    // Runtime shape guards are the protocol's external-data parsing boundary.
    "anti-slop/no-runtime-typeof": "off",
    "anti-slop/no-unsafe-dictionary-type": "off",
  },
});
