import { Column } from "@expo/ui";
import Text from "@/shared/ui/Text";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";

export default function AuthLoadingScreen() {
  return (
    <Screen>
      <Column spacing={16} modifiers={fillAvailableWidth}>
        <Text variant="title">Opening Nutritual</Text>
        <Text color="#6C6C70">Restoring session…</Text>
      </Column>
    </Screen>
  );
}
