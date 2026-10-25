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
