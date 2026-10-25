import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const baseURL = process.env.BETTER_AUTH_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!databaseUrl || !baseURL || !secret) {
  throw new Error("DATABASE_URL, BETTER_AUTH_URL, and BETTER_AUTH_SECRET are required.");
}

export const database = new Pool({ connectionString: databaseUrl, max: 5 });

const options = {
  appName: "Nutritual",
  baseURL,
  secret,
  plugins: [expo()],
  trustedOrigins: ["nutritual://"],
  emailAndPassword: { enabled: true },
};

export const auth = betterAuth({
  ...options,
  database: process.env.NODE_ENV === "test" ? undefined : database,
  emailAndPassword: { enabled: true, disableSignUp: true },
});

export function createProvisioningAuth() {
  return betterAuth({ ...options, database });
}
