import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, useColorScheme } from "react-native";
import { RoutinesProvider } from "@/routines/RoutinesProvider";
import { usePalette } from "@/components/ui/palette";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { hasActiveSession, sessionExpiryTime } from "@/auth/session";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { router, useRootNavigationState } from "expo-router";
import { normalizePairCode } from "@/auth/parse";

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
    const handleUrl = async (url: string) => {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
      } catch {
        return;
      }

      if (parsedUrl.pathname !== "/pair") return;
      const code = normalizePairCode(parsedUrl.searchParams.get("code"));

      if (!code) return;
      await SecureStore.setItemAsync("nutritual.pending-pair-code", code);

      if (navigationState?.key)
        router.replace(
          status === "authenticated" ? { pathname: "/pair", params: { code } } : "/sign-in",
        );
    };

    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    return () => sub.remove();
  }, [navigationState?.key, status]);

  useEffect(() => {
    if (status !== "authenticated" || !navigationState?.key) return;
    void SecureStore.getItemAsync("nutritual.pending-pair-code").then((code) => {
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
