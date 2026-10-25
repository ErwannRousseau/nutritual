import { Column } from "@expo/ui";
import AppText from "@/components/ui/AppText";
import Screen from "@/components/ui/Screen";
import { fillAvailableWidth } from "@/components/ui/layout";

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
