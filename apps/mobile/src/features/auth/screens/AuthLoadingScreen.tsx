import { Column } from "@expo/ui";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";

export default function AuthLoadingScreen() {
  return (
    <Screen>
      <Column spacing={16} modifiers={fillAvailableWidth}>
        <AppText variant="title">Ouverture de Nutritual</AppText>
        <AppText color="#6C6C70">Restauration de la session…</AppText>
      </Column>
    </Screen>
  );
}
