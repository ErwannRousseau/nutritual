import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { config } from "../neon-auth.ts";

const pageStyle = `body{font:16px system-ui,sans-serif;background:#f5f3ed;color:#1d302b;margin:0;min-height:100vh;display:grid;place-items:center}main{background:white;border-radius:20px;padding:32px;width:min(420px,calc(100% - 48px));box-shadow:0 12px 40px #16372a18}h1{font-size:25px}p{line-height:1.5;color:#53645d}input,button{box-sizing:border-box;width:100%;padding:13px;margin:7px 0;border-radius:10px;border:1px solid #ccd5cf;font:inherit}button{background:#183f31;color:white;border:0;font-weight:650}button.secondary{background:transparent;color:#183f31}small{color:#53645d}img{display:block;width:220px;height:220px;margin:18px auto}code{font-size:20px;letter-spacing:3px}#status{min-height:24px}`;

function html(body: string, scripts: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nutritual</title><style>${pageStyle}</style><main>${body}</main><script>${scripts}</script></html>`;
}

export function registerOAuthPages(app: Hono<McpAuthVariables>): void {
  app.get("/oauth/login", (c) =>
    c.html(
      html(
        `<h1 id="title">Sign in to Nutritual</h1><p id="description">Use the Nutritual account paired with your phone.</p><form id="form"><input name="email" type="email" autocomplete="username" placeholder="Email address" required><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Password" required><button id="submit">Continue</button></form><button id="toggle" class="secondary" type="button">Create an account</button><p id="status" role="status"></p>`,
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
  title.textContent=signUp?'Create a Nutritual account':'Sign in to Nutritual';
  description.textContent=signUp?'Choose an email address and password for your Nutritual account.':'Use the Nutritual account paired with your phone.';
  password.autocomplete=signUp?'new-password':'current-password';
  submit.textContent=signUp?'Create my account':'Continue';
  toggle.textContent=signUp?'Already have an account? Sign in':'Create an account';
  status.textContent='';
}
async function continueOAuth(){
  const response=await fetch(authBase+'/oauth2/continue',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({selected:true,oauth_query:query})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url)throw new Error(data.message||'The OAuth request cannot continue.');
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
  status.textContent=creatingAccount?'Creating account…':'Signing in…';
  const form=new FormData(event.currentTarget);
  const email=String(form.get('email'));
  const userPassword=String(form.get('password'));
  try{
    const response=await fetch(authBase+(creatingAccount?'/sign-up/email':'/sign-in/email'),{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(creatingAccount?{email,password:userPassword,name:email.split('@')[0]||'Nutritual'}:{email,password:userPassword,oauth_query:query})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||(creatingAccount?'Account creation failed.':'Check your email address and password.'));
    if(creatingAccount){
      const session=await getSession();
      if(!session?.user){
        setMode(false);
        status.textContent='Account created. If Neon asks you to verify your email, check your inbox, then sign in again.';
        return;
      }
      await continueOAuth();
      return;
    }
    if(!data.url)throw new Error('The OAuth request cannot continue.');
    location.assign(data.url);
  }catch(error){status.textContent=error.message||'Unable to sign in.';}
});`,
      ),
    ),
  );

  app.get("/oauth/consent", (c) =>
    c.html(
      html(
        `<h1>Connect to Nutritual</h1><p id="explanation">Preparing request…</p><section id="mobile" hidden><p>This app is requesting access to:</p><pre id="details"></pre><button id="allow">Allow</button><button id="deny">Deny</button></section><section id="pair" hidden><img id="qr" alt="Pairing QR code"><p>Scan this code in the app, then confirm on your phone.</p><p>Code: <code id="code"></code></p><p id="requestDetails"></p><small>The code expires in five minutes.</small></section><p id="status" role="status"></p>`,
        `const authBase=${JSON.stringify(config.authBaseUrl)};
const mobileClient=${JSON.stringify(config.mobileClientId)};
const query=location.search.slice(1);
const params=new URLSearchParams(query);
const status=document.querySelector('#status');
const explanation=document.querySelector('#explanation');
async function consent(accept){
  status.textContent=accept?'Authorization approved…':'Authorization denied…';
  try{
    const response=await fetch(authBase+'/oauth2/consent',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({accept,oauth_query:query})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||'The OAuth request could not be completed.');
    if(data.url)location.assign(data.url);
    else if(data.redirect)location.assign(data.redirect);
    else status.textContent=accept?'Authorization complete. You can close this window.':'Request denied. You can close this window.';
  }catch(error){status.textContent=error.message||'Authorization failed.';}
}
async function createBrowserChallenge(){
  const sessionJwt=await getBrowserSessionJwt();
  const response=await fetch('/pairing/challenges',{method:'POST',headers:{'content-type':'application/json','x-neon-session-jwt':sessionJwt},body:JSON.stringify({oauthQuery:query})});
  if(!response.ok)throw new Error('Unable to create a code.');
  return response.json();
}
async function getBrowserSessionJwt(){
  const response=await fetch(authBase+'/get-session',{credentials:'include'});
  const token=response.headers.get('set-auth-jwt');
  if(!response.ok||!token)throw new Error('Neon browser session not found. Sign in again and retry.');
  return token;
}
async function start(){
  if(!query){status.textContent='Missing OAuth parameters.';return;}
  if(mobileClient&&params.get('client_id')===mobileClient){
    explanation.textContent='Review the requested permissions before continuing.';
    document.querySelector('#mobile').hidden=false;
    document.querySelector('#details').textContent=['App: '+(params.get('client_id')||'unknown'),'Resource: '+(params.get('resource')||'not specified'),'Permissions: '+(params.get('scope')||'not specified')].join('\\n');
    document.querySelector('#allow').addEventListener('click',()=>consent(true));
    document.querySelector('#deny').addEventListener('click',()=>consent(false));
    return;
  }
  explanation.textContent='Scan the code with Nutritual to confirm the connection on your phone.';
  try{
    const challenge=await createBrowserChallenge();
    document.querySelector('#pair').hidden=false;
    document.querySelector('#qr').src=challenge.qrUrl;
    document.querySelector('#code').textContent=challenge.code;
    document.querySelector('#requestDetails').textContent=['Client: '+(params.get('client_id')||'unknown'),'Resource: '+(params.get('resource')||'not specified'),'Permissions: '+(params.get('scope')||'not specified')].join('\\n');
    const deadline=Date.parse(challenge.expiresAt);
    while(Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,2000));
      const sessionJwt=await getBrowserSessionJwt();
      const response=await fetch('/pairing/challenges/status',{method:'POST',headers:{'content-type':'application/json','x-neon-session-jwt':sessionJwt},body:JSON.stringify({code:challenge.code,pollToken:challenge.pollToken,oauthQuery:query})});
      if(!response.ok)throw new Error('Unable to verify your phone.');
      const result=await response.json();
      if(result.status==='approved'){await consent(true);return;}
      if(result.status==='declined'){await consent(false);return;}
      if(result.status==='mismatch'){status.textContent='The browser and phone accounts do not match. Restart with the same account on both.';return;}
      if(result.status==='expired')break;
    }
    status.textContent='The code has expired. Start sign-in again.';
  }catch(error){status.textContent=error.message||'An error occurred.';}
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
