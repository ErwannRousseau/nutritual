const script = document.currentScript;
const authBase = script.dataset.authBaseUrl;
const mobileClient = script.dataset.mobileClientId;
const query = location.search.slice(1);
const params = new URLSearchParams(query);
const status = document.querySelector("#status");
const explanation = document.querySelector("#explanation");

async function consent(accept) {
  status.textContent = accept ? "Authorization approved…" : "Authorization denied…";

  try {
    const response = await fetch(`${authBase}/oauth2/consent`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: query }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.message || "The OAuth request could not be completed.");

    if (data.url) location.assign(data.url);
    else if (data.redirect) location.assign(data.redirect);
    else
      status.textContent = accept
        ? "Authorization complete. You can close this window."
        : "Request denied. You can close this window.";
  } catch (error) {
    status.textContent = error.message || "Authorization failed.";
  }
}

async function start() {
  if (!query) {
    status.textContent = "Missing OAuth parameters.";

    return;
  }

  if (mobileClient && params.get("client_id") === mobileClient) {
    explanation.textContent = "Review the requested permissions before continuing.";
    document.querySelector("#mobile").hidden = false;
    document.querySelector("#details").textContent = [
      `App: ${params.get("client_id") || "unknown"}`,
      `Resource: ${params.get("resource") || "not specified"}`,
      `Permissions: ${params.get("scope") || "not specified"}`,
    ].join("\n");
    document.querySelector("#allow").addEventListener("click", () => consent(true));
    document.querySelector("#deny").addEventListener("click", () => consent(false));

    return;
  }

  if (sessionStorage.getItem("nutritual-paired-oauth-query") !== query) {
    location.replace(`/oauth/login?${query}`);

    return;
  }

  sessionStorage.removeItem("nutritual-paired-oauth-query");
  explanation.textContent = "Connection confirmed in Nutritual. Finalizing authorization…";
  await consent(true);
}

start();
