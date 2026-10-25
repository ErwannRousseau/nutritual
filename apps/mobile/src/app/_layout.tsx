import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, useColorScheme } from "react-native";
import { RoutinesProvider } from "@/routines/RoutinesProvider";
import { usePalette } from "@/components/ui/palette";
import { authClient } from "@/auth/auth-client";
import { hasActiveSession, sessionExpiryTime } from "@/auth/session";

export default function RootLayout() {
  const colors = usePalette();
  const scheme = useColorScheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: session, isPending } = authClient.useSession();
  const [now, setNow] = useState(Date.now);
  const expiresAt = sessionExpiryTime(session);

  const status = hasActiveSession(session, now)
    ? "authenticated"
    : session || !isPending
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
