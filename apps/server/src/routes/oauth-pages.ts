import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { renderOAuthConsentPage, renderOAuthLoginPage } from "../oauth-page-content.tsx";
import { config } from "../neon-auth.ts";

const loginScript = new URL("../oauth-page-scripts/login.js", import.meta.url);
const consentScript = new URL("../oauth-page-scripts/consent.js", import.meta.url);
const scriptHeaders = { "Content-Type": "text/javascript; charset=utf-8" };

export function registerOAuthPages(app: Hono<McpAuthVariables>): void {
  app.get("/oauth/scripts/login.js", (c) => c.body(Bun.file(loginScript), 200, scriptHeaders));
  app.get("/oauth/scripts/consent.js", (c) => c.body(Bun.file(consentScript), 200, scriptHeaders));
  app.get("/oauth/login", (c) =>
    c.html(renderOAuthLoginPage(config.authBaseUrl, config.mobileClientId)),
  );
  app.get("/oauth/consent", (c) =>
    c.html(renderOAuthConsentPage(config.authBaseUrl, config.mobileClientId)),
  );
  app.get("/oauth/mobile/callback", (c) => {
    const native = new URL("com.erwannrousseau.nutritual:/oauth/callback");
    const originalQuery = new URL(c.req.url).search;

    return c.redirect(`${native.toString()}${originalQuery}`, 302);
  });
}
