import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { AuthStatus } from "@/features/auth/auth-status";
import { clearTokens, readTokens, subscribeToTokenUpdates } from "@/features/auth/session";
import { hasActiveSession, sessionExpiryTime, type TokenSet } from "@/features/auth/session-model";

type AuthValue = {
  status: AuthStatus;
  signOut: () => Promise<void>;
  setSession: (tokens: TokenSet) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<TokenSet | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const unsubscribe = subscribeToTokenUpdates(setTokens);

    void readTokens()
      .then(setTokens)
      .catch(() => setTokens(null))
      .finally(() => setRestoring(false));

    return unsubscribe;
  }, []);

  const expiresAt = sessionExpiryTime(tokens);

  const status: AuthStatus = restoring
    ? AuthStatus.restoring
    : hasActiveSession(tokens, now)
      ? AuthStatus.authenticated
      : AuthStatus.signedOut;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const expiryTimer =
      expiresAt === undefined || expiresAt <= now
        ? undefined
        : setTimeout(
            () => setNow(Date.now()),
            Math.min(Math.max(0, expiresAt - Date.now()), 2_147_483_647),
          );

    return () => {
      if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    };
  }, [expiresAt, now]);
  const setSession = useCallback((value: TokenSet) => setTokens(value), []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setTokens(null);
  }, []);

  const value = useMemo(() => ({ status, signOut, setSession }), [status, signOut, setSession]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) throw new Error("AuthProvider is missing.");

  return {
    ...value,
    isAuthenticated: value.status === AuthStatus.authenticated,
    isRestoring: value.status === AuthStatus.restoring,
    isSignedOut: value.status === AuthStatus.signedOut,
  };
}
