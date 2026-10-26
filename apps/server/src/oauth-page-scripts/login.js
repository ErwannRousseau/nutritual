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
  title.textContent = signUp ? "Create a Nutritual account" : "Sign in to Nutritual";
  description.textContent = signUp
    ? "Choose an email address and password for your Nutritual account."
    : "Use the Nutritual account associated with your phone.";
  password.autocomplete = signUp ? "new-password" : "current-password";
  submit.textContent = signUp ? "Create my account" : "Continue";
  toggle.textContent = signUp ? "Already have an account? Sign in" : "Create an account";
  status.textContent = "";
}

function completeLogin(url) {
  const next = new URL(url, location.href);

  if (!isMobileClient && next.origin === location.origin && next.pathname === "/oauth/consent")
    sessionStorage.setItem("nutritual-paired-oauth-query", next.search.slice(1));

  location.assign(url);
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
    throw new Error(data.message || "The OAuth request cannot continue.");
  completeLogin(data.url);
}

async function getSession() {
  const response = await fetch(`${authBase}/get-session`, { credentials: "include" });

  return response.ok ? response.json().catch(() => null) : null;
}

async function getBrowserSessionJwt() {
  const response = await fetch(`${authBase}/get-session`, { credentials: "include" });
  const token = response.headers.get("set-auth-jwt");

  if (!response.ok || !token)
    throw new Error("Neon browser session not found. Sign in again and retry.");

  return token;
}

async function createBrowserChallenge() {
  const sessionJwt = await getBrowserSessionJwt();

  const response = await fetch("/pairing/challenges", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": sessionJwt },
    body: JSON.stringify({ oauthQuery: query }),
  });

  if (!response.ok) throw new Error("Unable to create a code.");

  return response.json();
}

async function confirmPairing() {
  const challenge = await createBrowserChallenge();
  const pair = document.querySelector("#pair");

  title.textContent = "Confirm your connection to Nutritual";
  description.textContent = "Scan this code with Nutritual to confirm the connection.";
  formElement.hidden = true;
  toggle.hidden = true;
  pair.hidden = false;
  document.querySelector("#qr").src = challenge.qrUrl;
  document.querySelector("#code").textContent = challenge.code;
  document.querySelector("#requestDetails").textContent = [
    `Client: ${params.get("client_id") || "unknown"}`,
    `Resource: ${params.get("resource") || "not specified"}`,
    `Permissions: ${params.get("scope") || "not specified"}`,
  ].join("\n");
  const deadline = Date.parse(challenge.expiresAt);

  while (Date.now() < deadline) {
    status.textContent = "Waiting for confirmation on your phone…";
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

    if (!response.ok) throw new Error("Unable to verify your phone.");
    const result = await response.json();

    if (result.status === "approved") {
      status.textContent = "Connection confirmed. Finalizing authorization…";

      return true;
    }

    if (result.status === "declined") {
      status.textContent = "Connection declined on your phone.";

      const response = await fetch(`${authBase}/oauth2/consent`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept: false, oauth_query: query }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url)
        throw new Error(data.message || "The refusal could not be sent.");
      location.assign(data.url);

      return false;
    }

    if (result.status === "mismatch") {
      status.textContent =
        "The browser and phone accounts do not match. Start again with the same account.";

      return false;
    }

    if (result.status === "expired") break;
  }

  status.textContent = "The code has expired. Start sign-in again.";

  return false;
}

getSession().then((data) => {
  if (data?.user && isMobileClient)
    continueOAuth().catch((error) => (status.textContent = error.message));
  else if (data?.user) status.textContent = "Sign in again to confirm the connection.";
});

toggle.addEventListener("click", () => setMode(!creatingAccount));

document.querySelector("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = creatingAccount ? "Creating account…" : "Signing in…";
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
          (creatingAccount ? "Account creation failed." : "Check your email address and password."),
      );

    if (creatingAccount) {
      const session = await getSession();

      if (!session?.user) {
        setMode(false);
        status.textContent =
          "Account created. If Neon asks you to verify your email, check your inbox, then sign in again.";

        return;
      }

      if (!isMobileClient && !(await confirmPairing())) return;

      await continueOAuth();

      return;
    }

    if (!data.url) throw new Error("The OAuth request cannot continue.");

    if (!isMobileClient && !(await confirmPairing())) return;
    completeLogin(data.url);
  } catch (error) {
    status.textContent = error.message || "Unable to sign in.";
  }
});
