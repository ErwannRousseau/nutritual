import { html } from "hono/html";
import type { Child, PropsWithChildren } from "hono/jsx";

const pageStyle = `
body {
  font: 16px system-ui, sans-serif;
  background: #f5f3ed;
  color: #1d302b;
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
}
main {
  background: white;
  border-radius: 20px;
  padding: 32px;
  width: min(420px, calc(100% - 48px));
  box-shadow: 0 12px 40px #16372a18;
}
h1 { font-size: 25px; }
p { line-height: 1.5; color: #53645d; }
input, button {
  box-sizing: border-box;
  width: 100%;
  padding: 13px;
  margin: 7px 0;
  border-radius: 10px;
  border: 1px solid #ccd5cf;
  font: inherit;
}
button { background: #183f31; color: white; border: 0; font-weight: 650; }
button.secondary { background: transparent; color: #183f31; }
small { color: #53645d; }
img { display: block; width: 220px; height: 220px; margin: 18px auto; }
code { font-size: 20px; letter-spacing: 3px; }
#status { min-height: 24px; }
`;

function OAuthPage({ children, script }: PropsWithChildren<{ script: Child }>) {
  return (
    <>
      {html`<!doctype html>`}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Nutritual</title>
          <style>{pageStyle}</style>
        </head>
        <body>
          <main>{children}</main>
          {script}
        </body>
      </html>
    </>
  );
}

export function renderOAuthLoginPage(authBaseUrl: string, mobileClientId: string) {
  return (
    <OAuthPage
      script={
        <script
          src="/oauth/scripts/login.js"
          data-auth-base-url={authBaseUrl}
          data-mobile-client-id={mobileClientId}
        />
      }
    >
      <h1 id="title">Sign in to Nutritual</h1>
      <p id="description">Use the Nutritual account associated with your phone.</p>
      <form id="form">
        <input
          name="email"
          type="email"
          autocomplete="username"
          placeholder="Email address"
          required
        />
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="Password"
          required
        />
        <button id="submit">Continue</button>
      </form>
      <button id="toggle" class="secondary" type="button">
        Create an account
      </button>
      <section id="pair" hidden>
        <img id="qr" alt="Pairing QR code" />
        <p>Scan this code with Nutritual to confirm the connection.</p>
        <p>
          Code: <code id="code" />
        </p>
        <p id="requestDetails" />
        <small>The code expires in five minutes.</small>
      </section>
      <p id="status" role="status" />
    </OAuthPage>
  );
}

export function renderOAuthConsentPage(authBaseUrl: string, mobileClientId: string) {
  return (
    <OAuthPage
      script={
        <script
          src="/oauth/scripts/consent.js"
          data-auth-base-url={authBaseUrl}
          data-mobile-client-id={mobileClientId}
        />
      }
    >
      <h1>Connect to Nutritual</h1>
      <p id="explanation">Preparing request…</p>
      <section id="mobile" hidden>
        <p>This app is requesting the following permissions:</p>
        <pre id="details" />
        <button id="allow">Allow</button>
        <button id="deny">Deny</button>
      </section>
      <p id="status" role="status" />
    </OAuthPage>
  );
}
