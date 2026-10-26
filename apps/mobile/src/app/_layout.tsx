import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, useColorScheme } from "react-native";
import { RoutinesProvider } from "@/routines/RoutinesProvider";
import { usePalette } from "@/components/ui/palette";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { hasActiveSession, sessionExpiryTime } from "@/auth/session";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { router, useRootNavigationState } from "expo-router";
import { createPendingPairLinkCoordinator } from "@/auth/pending-pair-link";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthenticatedLayout />
    </AuthProvider>
  );
}

function AuthenticatedLayout() {
  const colors = usePalette();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { tokens: session, restoring } = useAuth();
  const navigationState = useRootNavigationState();
  const [now, setNow] = useState(Date.now);
  const expiresAt = sessionExpiryTime(session);

  const status = hasActiveSession(session, now)
    ? "authenticated"
    : !restoring
      ? "signed-out"
      : "restoring";

  const currentNavigation = useRef({ ready: false, authenticated: false });
  useLayoutEffect(() => {
    currentNavigation.current = {
      ready: Boolean(navigationState?.key),
      authenticated: status === "authenticated",
    };
  }, [navigationState?.key, status]);

  const pairLinkCoordinator = useRef<ReturnType<typeof createPendingPairLinkCoordinator> | null>(
    null,
  );

  const initialUrlRequested = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });

    const expiryTimer =
      expiresAt === undefined
        ? undefined
        : setTimeout(() => setNow(Date.now()), Math.max(0, expiresAt - Date.now()));

    return () => {
      subscription.remove();

      if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    };
  }, [expiresAt]);

  useEffect(() => {
    pairLinkCoordinator.current ??= createPendingPairLinkCoordinator(
      (code) => SecureStore.setItemAsync("nutritual.pending-pair-code", code),
      () => currentNavigation.current,
      (code, authenticated) =>
        router.replace(authenticated ? { pathname: "/pair", params: { code } } : "/sign-in"),
    );
    const coordinator = pairLinkCoordinator.current;
    const sub = Linking.addEventListener("url", ({ url }) => void coordinator.handleUrl(url));

    if (!initialUrlRequested.current) {
      initialUrlRequested.current = true;
      void Linking.getInitialURL().then((url) => {
        if (url) void coordinator.handleInitialUrl(url);
      });
    }

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !navigationState?.key) return;
    const coordinator = pairLinkCoordinator.current;

    if (!coordinator) return;
    void coordinator
      .readPendingCode(() => SecureStore.getItemAsync("nutritual.pending-pair-code"))
      .then((code) => {
        if (code) router.replace({ pathname: "/pair", params: { code } });
      });
  }, [navigationState?.key, status]);

  const stack = (
    <Stack
      screenOptions={{
        headerTintColor: colors.blue,
        headerStyle: styles.header,
        headerTitleStyle: styles.title,
        contentStyle: styles.content,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Protected
        guard={status === "authenticated"}
        redirectTo={status === "restoring" ? "/auth-loading" : "/sign-in"}
      >
        <Stack.Screen name="index" options={{ title: "Compléments" }} />
        <Stack.Screen name="routine/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="record/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="intake/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="routine-detail/[id]" options={{ title: "Complément" }} />
        <Stack.Screen name="as-needed" options={{ title: "À la demande" }} />
        <Stack.Screen name="history" options={{ title: "Historique" }} />
        <Stack.Screen name="settings" options={{ title: "ChatGPT et jumelage" }} />
        <Stack.Screen name="pair" options={{ title: "Jumeler ChatGPT" }} />
      </Stack.Protected>
      <Stack.Protected
        guard={status === "restoring"}
        redirectTo={status === "authenticated" ? "/" : "/sign-in"}
      >
        <Stack.Screen name="auth-loading" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signed-out"} redirectTo="/">
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      {status === "authenticated" ? <RoutinesProvider>{stack}</RoutinesProvider> : stack}
    </ThemeProvider>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    header: { backgroundColor: colors.background },
    content: { backgroundColor: colors.background },
    title: { color: colors.text },
  });
}
