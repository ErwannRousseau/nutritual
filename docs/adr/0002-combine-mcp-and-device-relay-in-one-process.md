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

Validate the complete workflow locally before evaluating hosting. Run the
backend on the developer's Mac and the real Expo app on the iPhone, connected
over the local network. Connect ChatGPT to the local MCP server through a
development tunnel. ChatGPT remains an online service, and tunnel access must
be verified for the user's account. Local validation includes authentication,
pairing, routine creation, and an observed reminder.

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
