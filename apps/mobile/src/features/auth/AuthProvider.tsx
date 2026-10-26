import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { clearTokens, readTokens, subscribeToTokenUpdates } from "@/features/auth/session";
import type { TokenSet } from "@/features/auth/session-model";
import { isJsonObject, type JsonValue } from "@/features/auth/parse";

type AuthValue = {
  tokens: TokenSet | null;
  restoring: boolean;
  signOut: () => Promise<void>;
  setSession: (tokens: TokenSet) => void;
};

const AuthContext = createContext<AuthValue | null>(null);
const DEVICE_KEY = "nutritual.phone.device";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<TokenSet | null>(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    const unsubscribe = subscribeToTokenUpdates(setTokens);

    void readTokens()
      .then(setTokens)
      .catch(() => setTokens(null))
      .finally(() => setRestoring(false));

    return unsubscribe;
  }, []);
  const setSession = useCallback((value: TokenSet) => setTokens(value), []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setTokens(null);
  }, []);

  const value = useMemo(
    () => ({ tokens, restoring, signOut, setSession }),
    [tokens, restoring, signOut, setSession],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) throw new Error("AuthProvider is missing.");

  return value;
}

export async function getDeviceCredentials(): Promise<{ deviceId: string; deviceSecret: string }> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);

  if (existing) {
    let parsed: JsonValue;

    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = null;
    }

    if (isJsonObject(parsed)) {
      const deviceId = String(parsed.deviceId ?? "");
      const deviceSecret = String(parsed.deviceSecret ?? "");
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (
        uuid.test(deviceId) &&
        deviceId === parsed.deviceId &&
        uuid.test(deviceSecret) &&
        deviceSecret === parsed.deviceSecret
      ) {
        return { deviceId, deviceSecret };
      }
    }
  }

  const { randomUUID } = await import("expo-crypto");
  const value = { deviceId: randomUUID(), deviceSecret: randomUUID() };
  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(value));

  return value;
}
