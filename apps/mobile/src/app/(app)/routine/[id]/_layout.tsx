import { Stack } from "expo-router";
import { RoutineDraftProvider } from "@/features/routines/RoutineDraftProvider";

export default function RoutineFlowLayout() {
  return (
    <RoutineDraftProvider>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: true }} />
        <Stack.Screen name="schedule" options={{ title: "Frequency" }} />
        <Stack.Screen name="review" options={{ title: "Review" }} />
      </Stack>
    </RoutineDraftProvider>
  );
}
