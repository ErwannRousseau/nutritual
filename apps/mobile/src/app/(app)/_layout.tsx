import { Stack } from "expo-router";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { RoutinesProvider } from "@/features/routines/RoutinesProvider";
import { usePalette, type Palette } from "@/shared/ui/palette";

export default function AuthenticatedLayout() {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
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
        <Stack.Screen name="index" options={{ title: "Supplements" }} />
        <Stack.Screen name="routine/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="record/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen
          name="routine-group"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen name="intake/[id]" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="routine-detail/[id]" options={{ title: "Supplement" }} />
        <Stack.Screen name="as-needed" options={{ title: "As needed" }} />
        <Stack.Screen name="history" options={{ title: "History" }} />
        <Stack.Screen name="settings" options={{ title: "ChatGPT pairing" }} />
        <Stack.Screen name="pair" options={{ title: "Pair ChatGPT" }} />
      </Stack>
    </RoutinesProvider>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    header: { backgroundColor: colors.background },
    content: { backgroundColor: colors.background },
    title: { color: colors.text },
  });
}
