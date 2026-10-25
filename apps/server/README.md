# Nutritual development relay

This Bun server relays routine creation requests from a development client to
the one connected phone. It keeps no queue or routine data. Run it only on a
trusted development network. It has no authentication and is not suitable for
production or an untrusted LAN.

## Run on the development LAN

1. Start the server from the repository root with `bun run --filter server dev`.
   It listens on `0.0.0.0:3000` by default. Set `PORT` to change the port.
2. Find the development computer's LAN IP address and verify that the phone can
   reach `http://<computer-lan-ip>:3000/health` on the same network.
3. Put this in `apps/mobile/.env.local`, replacing the example IP:

   ```dotenv
   EXPO_PUBLIC_SERVER_URL=http://192.168.1.20:3000
   ```

4. Restart Expo so it reads the environment variable, then open the app on the
   phone. Keep the app active while creating a routine. The phone connects to
   `ws://<computer-lan-ip>:3000/device` and receives requests only while
   connected.

The server returns `503 unavailable` immediately when no phone is connected.
It never stores requests for later delivery. An acknowledgment must arrive
within 10 seconds. A disconnect or missing acknowledgment returns `504
unconfirmed`; retry with the same `operationId` so the phone can safely
deduplicate a request that may already have completed.

## HTTP results

- `200 created`: the phone created the routine. `reminder` reports `scheduled`,
  `denied`, `failed`, `none`, or `unconfirmed` for reminder setup.
- `200 already_processed`: this `operationId` was already handled. The response
  includes the original `routineId` and reminder outcome.
- `400 invalid`: the request is malformed or fails routine validation.
- `409 conflict`: the phone has already associated this `operationId` with
  different routine input.
- `502 failed`: the phone definitively failed to create the routine.
- `503 unavailable`: no phone was connected when the request arrived. Nothing
  was delivered.
- `504 unconfirmed`: delivery or completion could not be confirmed, including
  a phone disconnect or an acknowledgment timeout. The routine may have been
  created, so retry with the same `operationId`.

## Retry an operation

Use a stable UUID for one user action and reuse that UUID unchanged for retries.
Only generate a new UUID for a new routine action.

```sh
SERVER_URL=http://127.0.0.1:3000
curl --fail-with-body -i "$SERVER_URL/intake-routines" \
  -H 'content-type: application/json' \
  -d '{"operationId":"6aa886cc-0c3d-4e16-b667-183d238a2f01","productName":"Magnesium","frequency":{"kind":"weekdays","days":[1,2,3,4,5]},"time":"08:30"}'
```

Repeat that exact command after `504 unconfirmed`. The server correlates every
HTTP request to a fresh WebSocket `requestId`; the phone uses the stable
`operationId` for idempotency.
