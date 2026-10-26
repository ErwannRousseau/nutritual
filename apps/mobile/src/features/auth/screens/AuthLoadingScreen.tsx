import { Column } from "@expo/ui";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";

export default function AuthLoadingScreen() {
  return (
    <Screen>
      <Column spacing={16} modifiers={fillAvailableWidth}>
        <AppText variant="title">Opening Nutritual</AppText>
        <AppText color="#6C6C70">Restoring session…</AppText>
      </Column>
    </Screen>
  );
}
