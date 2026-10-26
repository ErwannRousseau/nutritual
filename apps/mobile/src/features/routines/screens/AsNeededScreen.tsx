import { Column } from "@expo/ui";
import { router } from "expo-router";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import UpcomingCard from "@/features/routines/components/UpcomingCard";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { FrequencyKind } from "@nutritual/protocol";

export default function AsNeededScreen() {
  const { routines } = useRoutineStore();
  const colors = usePalette();

  const asNeeded = routines.filter(
    (routine) => !routine.paused && routine.frequency.kind === FrequencyKind.asNeeded,
  );

  return (
    <Screen>
      <AppText color={colors.secondary}>
        Enregistrez une prise quand vous en avez besoin. Aucun rappel automatique.
      </AppText>
      <Column spacing={12}>
        {asNeeded.map((routine) => (
          <UpcomingCard
            key={routine.id}
            routine={routine}
            onPress={() => router.push({ pathname: "/record/[id]", params: { id: routine.id } })}
          />
        ))}
        {asNeeded.length === 0 && <AppText>Aucun complément à la demande.</AppText>}
      </Column>
    </Screen>
  );
}
