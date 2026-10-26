import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { config } from "../neon-auth.ts";

const pageStyle = `body{font:16px system-ui,sans-serif;background:#f5f3ed;color:#1d302b;margin:0;min-height:100vh;display:grid;place-items:center}main{background:white;border-radius:20px;padding:32px;width:min(420px,calc(100% - 48px));box-shadow:0 12px 40px #16372a18}h1{font-size:25px}p{line-height:1.5;color:#53645d}input,button{box-sizing:border-box;width:100%;padding:13px;margin:7px 0;border-radius:10px;border:1px solid #ccd5cf;font:inherit}button{background:#183f31;color:white;border:0;font-weight:650}button.secondary{background:transparent;color:#183f31}small{color:#53645d}img{display:block;width:220px;height:220px;margin:18px auto}code{font-size:20px;letter-spacing:3px}#status{min-height:24px}`;

function html(body: string, scripts: string): string {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nutritual</title><style>${pageStyle}</style><main>${body}</main><script>${scripts}</script></html>`;
}

export function registerOAuthPages(app: Hono<McpAuthVariables>): void {
  app.get("/oauth/login", (c) =>
    c.html(
      html(
        `<h1 id="title">Se connecter à Nutritual</h1><p id="description">Utilisez le compte Nutritual associé à votre téléphone.</p><form id="form"><input name="email" type="email" autocomplete="username" placeholder="Adresse e-mail" required><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Mot de passe" required><button id="submit">Continuer</button></form><button id="toggle" class="secondary" type="button">Créer un compte</button><p id="status" role="status"></p>`,
        `const authBase=${JSON.stringify(config.authBaseUrl)};
const query=location.search.slice(1);
const status=document.querySelector('#status');
const title=document.querySelector('#title');
const description=document.querySelector('#description');
const password=document.querySelector('#password');
const submit=document.querySelector('#submit');
const toggle=document.querySelector('#toggle');
let creatingAccount=false;
function setMode(signUp){
  creatingAccount=signUp;
  title.textContent=signUp?'Créer un compte Nutritual':'Se connecter à Nutritual';
  description.textContent=signUp?'Choisissez l’adresse e-mail et le mot de passe de votre compte Nutritual.':'Utilisez le compte Nutritual associé à votre téléphone.';
  password.autocomplete=signUp?'new-password':'current-password';
  submit.textContent=signUp?'Créer mon compte':'Continuer';
  toggle.textContent=signUp?'Déjà un compte ? Se connecter':'Créer un compte';
  status.textContent='';
}
async function continueOAuth(){
  const response=await fetch(authBase+'/oauth2/continue',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({selected:true,oauth_query:query})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url)throw new Error(data.message||'La demande OAuth ne peut pas continuer.');
  location.assign(data.url);
}
async function getSession(){
  const response=await fetch(authBase+'/get-session',{credentials:'include'});
  return response.ok?response.json().catch(()=>null):null;
}
getSession().then(data=>{
  if(data?.user)continueOAuth().catch(error=>status.textContent=error.message);
});
toggle.addEventListener('click',()=>setMode(!creatingAccount));
document.querySelector('#form').addEventListener('submit',async event=>{
  event.preventDefault();
  status.textContent=creatingAccount?'Création du compte…':'Connexion…';
  const form=new FormData(event.currentTarget);
  const email=String(form.get('email'));
  const userPassword=String(form.get('password'));
  try{
    const response=await fetch(authBase+(creatingAccount?'/sign-up/email':'/sign-in/email'),{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(creatingAccount?{email,password:userPassword,name:email.split('@')[0]||'Nutritual'}:{email,password:userPassword,oauth_query:query})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||(creatingAccount?'La création du compte a échoué.':'Vérifiez votre adresse e-mail et votre mot de passe.'));
    if(creatingAccount){
      const session=await getSession();
      if(!session?.user){
        setMode(false);
        status.textContent='Compte créé. Si Neon demande une vérification, consultez votre e-mail, puis reconnectez-vous.';
        return;
      }
      await continueOAuth();
      return;
    }
    if(!data.url)throw new Error('La demande OAuth ne peut pas continuer.');
    location.assign(data.url);
  }catch(error){status.textContent=error.message||'Connexion impossible.';}
});`,
      ),
    ),
  );

  app.get("/oauth/consent", (c) =>
    c.html(
      html(
        `<h1>Connecter Nutritual</h1><p id="explanation">Préparation de la demande…</p><section id="mobile" hidden><p>Cette application demande l’accès suivant :</p><pre id="details"></pre><button id="allow">Autoriser</button><button id="deny">Refuser</button></section><section id="pair" hidden><img id="qr" alt="QR code d’association"><p>Scannez ce code dans l’application, puis confirmez sur le téléphone.</p><p>Code : <code id="code"></code></p><p id="requestDetails"></p><small>Le code expire dans cinq minutes.</small></section><p id="status" role="status"></p>`,
        `const authBase=${JSON.stringify(config.authBaseUrl)};
const mobileClient=${JSON.stringify(config.mobileClientId)};
const query=location.search.slice(1);
const params=new URLSearchParams(query);
const status=document.querySelector('#status');
const explanation=document.querySelector('#explanation');
async function consent(accept){
  status.textContent=accept?'Connexion accordée…':'Connexion refusée…';
  try{
    const response=await fetch(authBase+'/oauth2/consent',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({accept,oauth_query:query})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||'La demande OAuth n’a pas pu être finalisée.');
    if(data.url)location.assign(data.url);
    else if(data.redirect)location.assign(data.redirect);
    else status.textContent=accept?'Connexion terminée. Vous pouvez fermer cette fenêtre.':'Demande refusée. Vous pouvez fermer cette fenêtre.';
  }catch(error){status.textContent=error.message||'Erreur de connexion.';}
}
async function createBrowserChallenge(){
  const sessionJwt=await getBrowserSessionJwt();
  const response=await fetch('/pairing/challenges',{method:'POST',headers:{'content-type':'application/json','x-neon-session-jwt':sessionJwt},body:JSON.stringify({oauthQuery:query})});
  if(!response.ok)throw new Error('Création du code impossible.');
  return response.json();
}
async function getBrowserSessionJwt(){
  const response=await fetch(authBase+'/get-session',{credentials:'include'});
  const token=response.headers.get('set-auth-jwt');
  if(!response.ok||!token)throw new Error('Session navigateur Neon introuvable. Reconnectez-vous puis réessayez.');
  return token;
}
async function start(){
  if(!query){status.textContent='Paramètres OAuth manquants.';return;}
  if(mobileClient&&params.get('client_id')===mobileClient){
    explanation.textContent='Vérifiez les autorisations demandées avant de continuer.';
    document.querySelector('#mobile').hidden=false;
    document.querySelector('#details').textContent=['Application : '+(params.get('client_id')||'inconnue'),'Ressource : '+(params.get('resource')||'non précisée'),'Autorisations : '+(params.get('scope')||'non précisées')].join('\\n');
    document.querySelector('#allow').addEventListener('click',()=>consent(true));
    document.querySelector('#deny').addEventListener('click',()=>consent(false));
    return;
  }
  explanation.textContent='Scannez le code avec Nutritual pour confirmer la connexion à votre téléphone.';
  try{
    const challenge=await createBrowserChallenge();
    document.querySelector('#pair').hidden=false;
    document.querySelector('#qr').src=challenge.qrUrl;
    document.querySelector('#code').textContent=challenge.code;
    document.querySelector('#requestDetails').textContent=['Client : '+(params.get('client_id')||'inconnu'),'Ressource : '+(params.get('resource')||'non précisée'),'Autorisations : '+(params.get('scope')||'non précisées')].join('\\n');
    const deadline=Date.parse(challenge.expiresAt);
    while(Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,2000));
      const sessionJwt=await getBrowserSessionJwt();
      const response=await fetch('/pairing/challenges/status',{method:'POST',headers:{'content-type':'application/json','x-neon-session-jwt':sessionJwt},body:JSON.stringify({code:challenge.code,pollToken:challenge.pollToken,oauthQuery:query})});
      if(!response.ok)throw new Error('Vérification du téléphone impossible.');
      const result=await response.json();
      if(result.status==='approved'){await consent(true);return;}
      if(result.status==='declined'){await consent(false);return;}
      if(result.status==='mismatch'){status.textContent='Le compte du navigateur et celui du téléphone ne correspondent pas. Recommencez avec le même compte.';return;}
      if(result.status==='expired')break;
    }
    status.textContent='Le code a expiré. Relancez la connexion.';
  }catch(error){status.textContent=error.message||'Une erreur est survenue.';}
}
start();`,
      ),
    ),
  );

  app.get("/oauth/mobile/callback", (c) => {
    const native = new URL("com.erwannrousseau.nutritual:/oauth/callback");
    const originalQuery = new URL(c.req.url).search;

    return c.redirect(`${native.toString()}${originalQuery}`, 302);
  });
}
