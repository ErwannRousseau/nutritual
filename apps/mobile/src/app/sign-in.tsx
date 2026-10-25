import { Column, RNHostView } from "@expo/ui";
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import ActionButton from "@/components/ui/ActionButton";
import AppText from "@/components/ui/AppText";
import Screen from "@/components/ui/Screen";
import { fillAvailableWidth } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";
import { useOAuthSignIn } from "@/auth/useOAuthSignIn";

export default function SignInScreen() {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState<string | null>(null);
  const { signIn, isSubmitting } = useOAuthSignIn((error) => setMessage(error));

  return (
    <Screen
      footer={
        <ActionButton
          label={isSubmitting ? "Ouverture de la connexion…" : "Se connecter"}
          onPress={() => {
            setMessage(null);
            void signIn();
          }}
          disabled={isSubmitting}
          testID="sign-in-submit"
        />
      }
    >
      <Column spacing={20} modifiers={fillAvailableWidth}>
        <AppText variant="largeTitle">Se connecter</AppText>
        <AppText color={colors.secondary}>
          Connectez-vous avec votre compte Neon pour accéder à vos routines et jumeler ChatGPT.
        </AppText>
        {message ? (
          <RNHostView matchContents>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.error}
              testID="sign-in-error"
            >
              {message}
            </Text>
          </RNHostView>
        ) : null}
      </Column>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    error: { color: colors.danger, fontSize: 17 },
  });
}
