import { Column, RNHostView } from "@expo/ui";
import { router } from "expo-router";
import { Text as NativeText } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import Text from "@/shared/ui/Text";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";
import { useAuth } from "@/features/auth/AuthProvider";
import { PairingStatus, useChatGptConnection } from "@/features/auth/useChatGptConnection";

const statusText = {
  [PairingStatus.loading]: "Checking ChatGPT connection…",
  [PairingStatus.paired]: "ChatGPT is paired with this phone.",
  [PairingStatus.notPaired]: "No phone is paired with ChatGPT.",
  [PairingStatus.unavailable]: "ChatGPT connection status is unavailable.",
};

export default function SettingsScreen() {
  const { pairingStatus, message, busy, disconnect } = useChatGptConnection();
  const colors = usePalette();
  const { signOut } = useAuth();

  return (
    <Screen>
      <Column spacing={18}>
        <Text variant="largeTitle">ChatGPT pairing</Text>
        <Text color={colors.secondary}>{statusText[pairingStatus]}</Text>
        <ActionButton
          label="Enter pairing code"
          onPress={() => router.push("/pair")}
          kind="secondary"
        />
        {pairingStatus === PairingStatus.paired || pairingStatus === PairingStatus.unavailable ? (
          <ActionButton
            label={busy ? "Disconnecting…" : "Disconnect ChatGPT"}
            onPress={() => void disconnect()}
            disabled={busy}
            kind="destructive"
          />
        ) : null}
        {message ? (
          <RNHostView matchContents>
            <NativeText accessibilityRole="alert">{message}</NativeText>
          </RNHostView>
        ) : null}
        <ActionButton label="Sign out" onPress={() => void signOut()} kind="secondary" />
      </Column>
    </Screen>
  );
}
