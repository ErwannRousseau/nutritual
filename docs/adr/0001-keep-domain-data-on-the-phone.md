# Keep domain data on the phone

Products, intake routines, and intake history are stored only on the phone. The
server may persist the minimum information needed for pairing and
authentication. Commands are transient, with no durable storage or payload
logging. This limits centralized data and rules out a persistent server-side
command queue.

The first milestone serves one user with one paired phone at a time. ChatGPT
runs in a desktop browser, and Nutritual stays open and connected on the phone
during creation. If the phone is unavailable, the server reports that state
without queuing the command. The user reopens the app and retries.

The initial ChatGPT connection includes a QR code to continue authorization in
Nutritual. Authorizing the connection is separate from confirming a routine
creation in ChatGPT.

The initial routine contains a product name and a daily local time, and can be
paused in the app. Dosage is optional. Workout scheduling, HealthKit, Health
Connect, and a scientific recommendation engine are outside this milestone. The
app does not embed an AI model.

Confirmation in ChatGPT authorizes immediate activation without another approval
in Nutritual. The result distinguishes a saved routine from a scheduled
notification, including when notification permission is denied. Scheduling
confirmation means the operating system accepted the request, not that the user
saw the reminder. A missing acknowledgment must be reported as an unconfirmed
outcome rather than a definite failure.

Routine times follow the phone's current time zone. A 9 a.m. routine must remind
the user at 9 a.m. in Paris and then at 9 a.m. in New York when traveling,
rather than preserving an instant tied to the original time zone. Scheduled
reminders must work independently of an open ChatGPT conversation or a live MCP
connection.
