# Combine MCP and device relay in one process

Use TypeScript, Bun, Hono, and the official MCP SDK for the backend. Keep MCP
and the phone's authenticated WebSocket connection in the same process on one
instance, avoiding a separate relay service and coordination between instances.

Start with one MCP tool, `create_intake_routine`, combining the product and its
daily schedule in one operation. The phone validates the command, saves the
routine locally, schedules its notification, and returns the actual outcome. It
remembers operation identifiers to prevent duplicate creations when a command is
retried after a lost acknowledgment. A restart can interrupt an exchange, and
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
