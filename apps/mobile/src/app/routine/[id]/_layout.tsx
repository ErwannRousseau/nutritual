import { Stack } from "expo-router";
import { RoutineDraftProvider } from "../../../components/routine-form/RoutineDraftProvider";

export default function RoutineFlowLayout() {
  return (
    <RoutineDraftProvider>
      <Stack screenOptions={{ headerBackTitle: "Retour" }}>
        <Stack.Screen name="index" options={{ headerShown: true }} />
        <Stack.Screen name="schedule" options={{ title: "Fréquence" }} />
        <Stack.Screen name="review" options={{ title: "Vérifier" }} />
      </Stack>
    </RoutineDraftProvider>
  );
}
