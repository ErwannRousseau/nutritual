import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StyleSheet, useColorScheme } from "react-native";
import { RoutinesProvider } from "../routines/RoutinesProvider";
import { usePalette } from "../components/ui/palette";

export default function RootLayout() {
  const colors = usePalette();
  const scheme = useColorScheme();

  const styles = StyleSheet.create({
    header: { backgroundColor: colors.background },
    content: { backgroundColor: colors.background },
    title: { color: colors.text },
  });

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <RoutinesProvider>
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
          <Stack.Screen name="index" options={{ title: "Compléments" }} />
          <Stack.Screen
            name="routine/[id]"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="record/[id]"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="intake/[id]"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen name="routine-detail/[id]" options={{ title: "Complément" }} />
          <Stack.Screen name="as-needed" options={{ title: "À la demande" }} />
          <Stack.Screen name="history" options={{ title: "Historique" }} />
        </Stack>
      </RoutinesProvider>
    </ThemeProvider>
  );
}
