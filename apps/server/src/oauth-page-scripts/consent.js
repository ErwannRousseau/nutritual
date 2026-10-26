const script = document.currentScript;
const authBase = script.dataset.authBaseUrl;
const mobileClient = script.dataset.mobileClientId;
const query = location.search.slice(1);
const params = new URLSearchParams(query);
const status = document.querySelector("#status");
const explanation = document.querySelector("#explanation");

async function consent(accept) {
  status.textContent = accept ? "Connexion accordée…" : "Connexion refusée…";

  try {
    const response = await fetch(`${authBase}/oauth2/consent`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: query }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok)
      throw new Error(data.message || "La demande OAuth n’a pas pu être finalisée.");

    if (data.url) location.assign(data.url);
    else if (data.redirect) location.assign(data.redirect);
    else
      status.textContent = accept
        ? "Connexion terminée. Vous pouvez fermer cette fenêtre."
        : "Demande refusée. Vous pouvez fermer cette fenêtre.";
  } catch (error) {
    status.textContent = error.message || "Erreur de connexion.";
  }
}

async function start() {
  if (!query) {
    status.textContent = "Paramètres OAuth manquants.";

    return;
  }

  if (mobileClient && params.get("client_id") === mobileClient) {
    explanation.textContent = "Vérifiez les autorisations demandées avant de continuer.";
    document.querySelector("#mobile").hidden = false;
    document.querySelector("#details").textContent = [
      `Application : ${params.get("client_id") || "inconnue"}`,
      `Ressource : ${params.get("resource") || "non précisée"}`,
      `Autorisations : ${params.get("scope") || "non précisées"}`,
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
  explanation.textContent = "Connexion confirmée dans Nutritual. Finalisation de l’autorisation…";
  await consent(true);
}

start();
