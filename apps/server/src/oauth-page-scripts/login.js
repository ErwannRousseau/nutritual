const authBase = document.currentScript.dataset.authBaseUrl;
const mobileClient = document.currentScript.dataset.mobileClientId;
const query = location.search.slice(1);
const params = new URLSearchParams(query);
const isMobileClient = mobileClient && params.get("client_id") === mobileClient;
const status = document.querySelector("#status");
const title = document.querySelector("#title");
const description = document.querySelector("#description");
const password = document.querySelector("#password");
const submit = document.querySelector("#submit");
const toggle = document.querySelector("#toggle");
const formElement = document.querySelector("#form");
let creatingAccount = false;

function setMode(signUp) {
  creatingAccount = signUp;
  title.textContent = signUp ? "Créer un compte Nutritual" : "Se connecter à Nutritual";
  description.textContent = signUp
    ? "Choisissez l’adresse e-mail et le mot de passe de votre compte Nutritual."
    : "Utilisez le compte Nutritual associé à votre téléphone.";
  password.autocomplete = signUp ? "new-password" : "current-password";
  submit.textContent = signUp ? "Créer mon compte" : "Continuer";
  toggle.textContent = signUp ? "Déjà un compte ? Se connecter" : "Créer un compte";
  status.textContent = "";
}

async function continueOAuth() {
  const response = await fetch(`${authBase}/oauth2/continue`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selected: true, oauth_query: query }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.url)
    throw new Error(data.message || "La demande OAuth ne peut pas continuer.");
  location.assign(data.url);
}

async function getSession() {
  const response = await fetch(`${authBase}/get-session`, { credentials: "include" });

  return response.ok ? response.json().catch(() => null) : null;
}

async function getBrowserSessionJwt() {
  const response = await fetch(`${authBase}/get-session`, { credentials: "include" });
  const token = response.headers.get("set-auth-jwt");

  if (!response.ok || !token)
    throw new Error("Session navigateur Neon introuvable. Reconnectez-vous puis réessayez.");

  return token;
}

async function createBrowserChallenge() {
  const sessionJwt = await getBrowserSessionJwt();

  const response = await fetch("/pairing/challenges", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": sessionJwt },
    body: JSON.stringify({ oauthQuery: query }),
  });

  if (!response.ok) throw new Error("Création du code impossible.");

  return response.json();
}

async function confirmPairing() {
  const challenge = await createBrowserChallenge();
  const pair = document.querySelector("#pair");

  title.textContent = "Confirmer la connexion à Nutritual";
  description.textContent = "Scannez ce code avec Nutritual pour confirmer la connexion.";
  formElement.hidden = true;
  toggle.hidden = true;
  pair.hidden = false;
  document.querySelector("#qr").src = challenge.qrUrl;
  document.querySelector("#code").textContent = challenge.code;
  document.querySelector("#requestDetails").textContent = [
    `Client : ${params.get("client_id") || "inconnu"}`,
    `Ressource : ${params.get("resource") || "non précisée"}`,
    `Autorisations : ${params.get("scope") || "non précisées"}`,
  ].join("\n");
  const deadline = Date.parse(challenge.expiresAt);

  while (Date.now() < deadline) {
    status.textContent = "En attente de confirmation sur le téléphone…";
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const sessionJwt = await getBrowserSessionJwt();

    const response = await fetch("/pairing/challenges/status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-neon-session-jwt": sessionJwt },
      body: JSON.stringify({
        code: challenge.code,
        pollToken: challenge.pollToken,
        oauthQuery: query,
      }),
    });

    if (!response.ok) throw new Error("Vérification du téléphone impossible.");
    const result = await response.json();

    if (result.status === "approved") {
      status.textContent = "Connexion confirmée. Finalisation de l’autorisation…";
      sessionStorage.setItem("nutritual-paired-oauth-query", query);

      return true;
    }

    if (result.status === "declined") {
      status.textContent = "Connexion refusée depuis le téléphone.";

      return false;
    }

    if (result.status === "mismatch") {
      status.textContent =
        "Le compte du navigateur et celui du téléphone ne correspondent pas. Recommencez avec le même compte.";

      return false;
    }

    if (result.status === "expired") break;
  }

  status.textContent = "Le code a expiré. Relancez la connexion.";

  return false;
}

getSession().then((data) => {
  if (data?.user && isMobileClient)
    continueOAuth().catch((error) => (status.textContent = error.message));
  else if (data?.user) status.textContent = "Reconnectez-vous pour confirmer la connexion.";
});

toggle.addEventListener("click", () => setMode(!creatingAccount));

document.querySelector("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = creatingAccount ? "Création du compte…" : "Connexion…";
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email"));
  const userPassword = String(form.get("password"));

  try {
    const response = await fetch(
      `${authBase}${creatingAccount ? "/sign-up/email" : "/sign-in/email"}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          creatingAccount
            ? { email, password: userPassword, name: email.split("@")[0] || "Nutritual" }
            : { email, password: userPassword, oauth_query: query },
        ),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok)
      throw new Error(
        data.message ||
          (creatingAccount
            ? "La création du compte a échoué."
            : "Vérifiez votre adresse e-mail et votre mot de passe."),
      );

    if (creatingAccount) {
      const session = await getSession();

      if (!session?.user) {
        setMode(false);
        status.textContent =
          "Compte créé. Si Neon demande une vérification, consultez votre e-mail, puis reconnectez-vous.";

        return;
      }

      if (!isMobileClient && !(await confirmPairing())) return;

      await continueOAuth();

      return;
    }

    if (!data.url) throw new Error("La demande OAuth ne peut pas continuer.");

    if (!isMobileClient && !(await confirmPairing())) return;
    location.assign(data.url);
  } catch (error) {
    status.textContent = error.message || "Connexion impossible.";
  }
});
