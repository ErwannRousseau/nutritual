# Combine MCP and device relay in one process

Use TypeScript, Bun, Hono, and the official MCP SDK for the backend. Keep MCP
and the phone's authenticated WebSocket connection in the same process on one
instance, avoiding a separate relay service and coordination between instances.

Build and validate the device relay before integrating ChatGPT. In this local
increment, an HTTP request from the developer's terminal triggers creation on
the open phone app. Verify the returned outcome, an unavailable phone, and a
retry without duplicate creation. Authentication, pairing, and the development
tunnel belong to the following ChatGPT integration increment.
The implementation specification is [issue #5](https://github.com/ErwannRousseau/nutritual/issues/5).

The local increment connects one phone to the server over the local network,
using a server address supplied in development configuration, without a new
connection screen.

Creation accepts the app's three frequency modes: selected weekdays, every N
calendar days from a chosen start date, and as needed. Reuse the app's creation
rules. The phone validates the command, saves the routine locally, schedules any
applicable reminder, and returns the actual outcome. It persists operation
identifiers locally so retrying the same operation does not create another
routine, including after an app or server restart. Two intentional creations
use distinct identifiers even when their contents are identical.

An operation identifier is bound to its original creation request. Reusing it
with different contents is rejected. Retrying a processed operation is a no-op
reported as already processed, even if the routine was subsequently edited or
deleted. Keep enough local operation information after deletion to recognize
these retries without recreating a routine or rescheduling reminders.

The following ChatGPT increment exposes the same creation behavior through one
MCP tool, `create_intake_routine`. A restart can interrupt an exchange, and
multiple backend instances would require a different routing strategy.

Use the authorization journey documented by
[HealthSync's ChatGPT connection guide](https://gethealthsync.ai/connect/chatgpt/)
as the pairing reference. After starting OAuth authorization from ChatGPT on the
desktop, show a web page with a QR code and a short code valid for five minutes.
The user scans the QR code with the iPhone camera or enters the short code from
Nutritual's settings. Nutritual displays the permission to create intake routines
on this phone and asks for explicit approval. Approval completes the connection
in ChatGPT. This connection authorization remains separate from confirming each
routine creation. The reference determines the pairing journey, not Nutritual's
sign-in provider.

Validate the complete workflow locally before evaluating hosting. Run the
backend on the developer's Mac and the real Expo app on the iPhone, connected
over the local network. Connect ChatGPT to the local MCP server through a
development tunnel. ChatGPT remains an online service, and tunnel access must
be verified for the user's account. Local validation includes authentication,
pairing, routine creation, and an observed reminder.

Use ngrok's free development HTTPS endpoint for both MCP requests and the
browser-facing QR authorization pages, forwarding to the same local backend.
This keeps one tunnel for the complete cross-device workflow. OpenAI's Secure
MCP Tunnel does not automatically expose browser-facing authorization pages.
The free ngrok browser interstitial is acceptable for development validation.
Verify account setup and plan limits, disable command-payload inspection, and
authenticate the relay and creation endpoints before exposing the backend.
See [ngrok's free plan limits](https://ngrok.com/docs/pricing-limits/free-plan-limits)
and [OpenAI's tunnel documentation](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

After local validation, try Vercel to use the user's existing plan without an
additional hosting subscription. Consider Railway if a Vercel limitation blocks
the workflow. Vercel's execution model does not establish the single-instance
assumption above. Deployment validation must establish routing across requests,
reconnections, and deployments. A successful local run or one successful remote
exchange does not establish reliable routing or effective zero cost on Vercel.

Use React Native, Expo, and TypeScript with a development build, `expo-sqlite`
for local storage, and `expo-notifications` for reminders. Start with one screen
listing routines and allowing them to be paused, without another UI library.
Target the locally available iPhone 13 first. The user's personal iPhone is also
available for development.

The milestone succeeds when a request in ChatGPT creates a visible routine on
the connected phone, the operating system accepts the local reminder, and the
reminder is observed on the phone. Verify pausing, denied notification
permission, offline creation attempts, retries without duplicates, and
local-time behavior when changing time zones.
