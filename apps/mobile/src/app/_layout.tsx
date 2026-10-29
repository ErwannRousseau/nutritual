import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { SplashScreenController } from "@/features/auth/SplashScreenController";
import { usePendingPairLink } from "@/features/auth/usePendingPairLink";

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated } = useAuth();
  usePendingPairLink();

  return (
    <>
      <SplashScreenController />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isAuthenticated} redirectTo="/sign-in">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated} redirectTo="/">
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
