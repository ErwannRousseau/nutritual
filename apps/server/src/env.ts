import { z } from "zod";

const env = z
  .object({
    DATABASE_URL: z.url(),
    NEON_AUTH_BASE_URL: z.url(),
    PUBLIC_BASE_URL: z.url(),
    MOBILE_OAUTH_CLIENT_ID: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3000),
  })
  .parse(process.env);

export const { DATABASE_URL, NEON_AUTH_BASE_URL, PUBLIC_BASE_URL, MOBILE_OAUTH_CLIENT_ID, PORT } =
  env;
