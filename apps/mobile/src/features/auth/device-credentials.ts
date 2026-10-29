import * as SecureStore from "expo-secure-store";
import { z } from "zod";
import type { JsonValue } from "@/features/auth/parse";

const DEVICE_KEY = "nutritual.phone.device";

const deviceCredentialsSchema = z.object({
  deviceId: z.uuidv4(),
  deviceSecret: z.uuidv4(),
});

export async function getDeviceCredentials(): Promise<{ deviceId: string; deviceSecret: string }> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);

  if (existing) {
    let parsed: JsonValue;

    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = null;
    }

    const result = deviceCredentialsSchema.safeParse(parsed);

    if (result.success) return result.data;
  }

  const { randomUUID } = await import("expo-crypto");
  const value = { deviceId: randomUUID(), deviceSecret: randomUUID() };
  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(value));

  return value;
}
