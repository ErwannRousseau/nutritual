import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");

export const database = new Pool({ connectionString: databaseUrl, max: 5 });

export type ChallengeStatus = "pending" | "approved" | "declined" | "mismatch" | "expired";

let schemaReady: Promise<void> | undefined;

export function ready(): Promise<void> {
  schemaReady ??= database
    .query(`
  CREATE TABLE IF NOT EXISTS app_pairing_challenges (
    code_hash text PRIMARY KEY,
    poll_token_hash text NOT NULL,
    oauth_query_hash text NOT NULL,
    browser_sub text NOT NULL,
    user_sub text,
    client_id text NOT NULL,
    redirect_host text NOT NULL,
    scopes text[] NOT NULL,
    resource text,
    status text NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'mismatch')),
    device_id text,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS app_pairing_challenges_expiry_idx
    ON app_pairing_challenges (expires_at);
  CREATE TABLE IF NOT EXISTS app_paired_devices (
    user_sub text PRIMARY KEY,
    device_id text NOT NULL UNIQUE,
    device_secret_hash text NOT NULL,
    client_id text NOT NULL,
    pairing_id text NOT NULL UNIQUE,
    paired_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS app_device_tickets (
    ticket_hash text PRIMARY KEY,
    user_sub text NOT NULL,
    device_id text NOT NULL,
    pairing_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz
  );
  CREATE TABLE IF NOT EXISTS app_pairing_attempts (
    attempt_key text PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    attempts integer NOT NULL
  );
`)
    .then(() => undefined);

  return schemaReady;
}

export function digest(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

let lastCleanupAt = 0;

export async function rateLimit(key: string): Promise<boolean> {
  await ready();

  if (Date.now() - lastCleanupAt > 60 * 60_000) {
    lastCleanupAt = Date.now();
    await cleanExpired();
  }

  const now = new Date();

  const result = await database.query<{ allowed: boolean }>(
    `INSERT INTO app_pairing_attempts (attempt_key, window_started_at, attempts)
     VALUES ($1, $2, 1)
     ON CONFLICT (attempt_key) DO UPDATE SET
       window_started_at = CASE WHEN app_pairing_attempts.window_started_at < $2::timestamptz - interval '10 minutes' THEN $2 ELSE app_pairing_attempts.window_started_at END,
       attempts = CASE WHEN app_pairing_attempts.window_started_at < $2::timestamptz - interval '10 minutes' THEN 1 ELSE app_pairing_attempts.attempts + 1 END
     RETURNING attempts <= 20 AS allowed`,
    [key, now],
  );

  return result.rows[0]?.allowed ?? false;
}

export async function cleanExpired(): Promise<void> {
  await ready();
  await database.query("DELETE FROM app_pairing_challenges WHERE expires_at <= now()");
  await database.query(
    "DELETE FROM app_device_tickets WHERE expires_at <= now() OR consumed_at IS NOT NULL",
  );
  await database.query(
    "DELETE FROM app_pairing_attempts WHERE window_started_at < now() - interval '1 day'",
  );
}

export type PairedDevice = {
  device_id: string;
  device_secret_hash: string;
  pairing_id: string;
  client_id: string;
};

type StoreOptions = {
  database?: Pool;
  digest?: typeof digest;
  ready?: typeof ready;
  rateLimit?: typeof rateLimit;
};

type ApprovalTransaction = {
  findChallenge(code: string): Promise<{ browser_sub: string; client_id: string } | undefined>;
  insertDevice(
    userSub: string,
    deviceId: string,
    deviceSecret: string,
    pairingId: string,
    clientId: string,
  ): Promise<PairedDevice | undefined>;
  findDevice(userSub: string): Promise<PairedDevice | undefined>;
  approveChallenge(code: string, userSub: string, deviceId: string): Promise<boolean>;
};

export function createPairingStore(options: StoreOptions = {}) {
  const pool = options.database ?? database;
  const hash = options.digest ?? digest;
  const ensureReady = options.ready ?? ready;
  const checkRateLimit = options.rateLimit ?? rateLimit;

  return {
    digestValue(value: string) {
      return hash(value);
    },

    allowAttempt(kind: string, ip: string) {
      return checkRateLimit(hash(`${kind}:${ip}`));
    },

    async createChallenge(input: {
      code: string;
      pollToken: string;
      oauthQuery: string;
      browserSub: string;
      clientId: string;
      redirectHost: string;
      scopes: string[];
      resource: string | null;
      expiresAt: Date;
    }) {
      await ensureReady();
      await pool.query(
        `INSERT INTO app_pairing_challenges (
           code_hash, poll_token_hash, oauth_query_hash, browser_sub, user_sub,
           client_id, redirect_host, scopes, resource, status, expires_at
         ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, 'pending', $9)`,
        [
          hash(input.code),
          hash(input.pollToken),
          hash(input.oauthQuery),
          input.browserSub,
          input.clientId,
          input.redirectHost,
          input.scopes,
          input.resource,
          input.expiresAt,
        ],
      );
    },

    async challengeStatus(input: { code: string; pollToken: string; oauthQuery: string }) {
      await ensureReady();

      const result = await pool.query<{
        status: string;
        expires_at: Date;
        consumed_at: Date | null;
        browser_sub: string;
      }>(
        `SELECT status, expires_at, consumed_at, browser_sub FROM app_pairing_challenges
         WHERE code_hash = $1 AND poll_token_hash = $2 AND oauth_query_hash = $3`,
        [hash(input.code), hash(input.pollToken), hash(input.oauthQuery)],
      );

      return result.rows[0];
    },

    async consumeChallengeStatus(input: { code: string; pollToken: string; oauthQuery: string }) {
      await ensureReady();

      const result = await pool.query<{ status: string }>(
        `UPDATE app_pairing_challenges SET consumed_at = now()
         WHERE code_hash = $1 AND poll_token_hash = $2 AND oauth_query_hash = $3 AND consumed_at IS NULL
         AND expires_at > now()
         RETURNING status`,
        [hash(input.code), hash(input.pollToken), hash(input.oauthQuery)],
      );

      return result.rows[0]?.status;
    },

    async inspectChallenge(code: string, userSub: string) {
      await ensureReady();

      const result = await pool.query<{
        browser_sub: string;
        client_id: string;
        redirect_host: string;
        scopes: string[];
        resource: string | null;
      }>(
        `SELECT browser_sub, client_id, redirect_host, scopes, resource FROM app_pairing_challenges
         WHERE code_hash = $1 AND browser_sub = $2 AND status = 'pending' AND expires_at > now()`,
        [hash(code), userSub],
      );

      return result.rows[0];
    },

    async declineChallenge(code: string, userSub: string) {
      await ensureReady();

      const result = await pool.query(
        `UPDATE app_pairing_challenges SET status = 'declined', user_sub = $2
         WHERE code_hash = $1 AND browser_sub = $2 AND status = 'pending' AND expires_at > now()`,
        [hash(code), userSub],
      );

      return Boolean(result.rowCount);
    },

    async withApprovalTransaction<T>(
      run: (transaction: ApprovalTransaction) => Promise<{ commit: boolean; value: T }>,
    ): Promise<T> {
      await ensureReady();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const transaction: ApprovalTransaction = {
          async findChallenge(code) {
            const result = await client.query<{ browser_sub: string; client_id: string }>(
              `SELECT browser_sub, client_id FROM app_pairing_challenges
               WHERE code_hash = $1 AND status = 'pending' AND expires_at > now() FOR UPDATE`,
              [hash(code)],
            );

            return result.rows[0];
          },
          async insertDevice(userSub, deviceId, deviceSecret, pairingId, clientId) {
            const result = await client.query<PairedDevice>(
              `INSERT INTO app_paired_devices (user_sub, device_id, device_secret_hash, pairing_id, client_id)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
               RETURNING device_id, device_secret_hash, pairing_id, client_id`,
              [userSub, deviceId, hash(deviceSecret), pairingId, clientId],
            );

            return result.rows[0];
          },
          async findDevice(userSub) {
            const result = await client.query<PairedDevice>(
              `SELECT device_id, device_secret_hash, pairing_id, client_id FROM app_paired_devices
               WHERE user_sub = $1 FOR UPDATE`,
              [userSub],
            );

            return result.rows[0];
          },
          async approveChallenge(code, userSub, deviceId) {
            const result = await client.query(
              `UPDATE app_pairing_challenges SET status = 'approved', user_sub = $2, device_id = $3
               WHERE code_hash = $1 AND status = 'pending' AND expires_at > now()`,
              [hash(code), userSub, deviceId],
            );

            return Boolean(result.rowCount);
          },
        };

        const outcome = await run(transaction);
        await client.query(outcome.commit ? "COMMIT" : "ROLLBACK");

        return outcome.value;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async hasDevice(userSub: string) {
      await ensureReady();

      const result = await pool.query("SELECT 1 FROM app_paired_devices WHERE user_sub = $1", [
        userSub,
      ]);

      return Boolean(result.rowCount);
    },

    async disconnectDevice(userSub: string, deviceId: string, deviceSecret: string) {
      await ensureReady();

      const result = await pool.query<{ pairing_id: string }>(
        `DELETE FROM app_paired_devices WHERE user_sub = $1 AND device_id = $2 AND device_secret_hash = $3
         RETURNING pairing_id`,
        [userSub, deviceId, hash(deviceSecret)],
      );

      return result.rows[0]?.pairing_id;
    },

    async deleteDeviceTickets(userSub: string, pairingId: string) {
      await ensureReady();
      await pool.query("DELETE FROM app_device_tickets WHERE user_sub = $1 AND pairing_id = $2", [
        userSub,
        pairingId,
      ]);
    },

    async pairingIdForDevice(userSub: string, deviceId: string, deviceSecret: string) {
      await ensureReady();

      const result = await pool.query<{ pairing_id: string }>(
        `SELECT pairing_id FROM app_paired_devices
         WHERE user_sub = $1 AND device_id = $2 AND device_secret_hash = $3`,
        [userSub, deviceId, hash(deviceSecret)],
      );

      return result.rows[0]?.pairing_id;
    },

    async createDeviceTicket(
      ticket: string,
      userSub: string,
      deviceId: string,
      pairingId: string,
      expiresAt: Date,
    ) {
      await ensureReady();
      await pool.query(
        `INSERT INTO app_device_tickets (ticket_hash, user_sub, device_id, pairing_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [hash(ticket), userSub, deviceId, pairingId, expiresAt],
      );
    },

    async consumeDeviceTicket(ticket: string) {
      await ensureReady();

      const result = await pool.query<{ user_sub: string; device_id: string; pairing_id: string }>(
        `UPDATE app_device_tickets AS ticket SET consumed_at = now()
         WHERE ticket.ticket_hash = $1 AND ticket.expires_at > now() AND ticket.consumed_at IS NULL
         AND EXISTS (SELECT 1 FROM app_paired_devices AS device
           WHERE device.user_sub = ticket.user_sub AND device.device_id = ticket.device_id
           AND device.pairing_id = ticket.pairing_id)
         RETURNING ticket.user_sub, ticket.device_id, ticket.pairing_id`,
        [hash(ticket)],
      );

      return result.rows[0];
    },

    async isPairingActive(userSub: string, deviceId: string, pairingId: string) {
      await ensureReady();

      const result = await pool.query(
        `SELECT 1 FROM app_paired_devices WHERE user_sub = $1 AND device_id = $2 AND pairing_id = $3`,
        [userSub, deviceId, pairingId],
      );

      return Boolean(result.rowCount);
    },

    async pairedClientId(userSub: string) {
      await ensureReady();

      const result = await pool.query<{ client_id: string }>(
        "SELECT client_id FROM app_paired_devices WHERE user_sub = $1",
        [userSub],
      );

      return result.rows[0]?.client_id;
    },
  };
}

export type PairingStore = ReturnType<typeof createPairingStore>;
