import { Column, RNHostView } from "@expo/ui";
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import ActionButton from "@/shared/ui/ActionButton";
import AppText from "@/shared/ui/AppText";
import Screen from "@/shared/ui/Screen";
import { fillAvailableWidth } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";
import { useOAuthSignIn } from "@/features/auth/useOAuthSignIn";

export default function SignInScreen() {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState<string | null>(null);
  const { signIn, isSubmitting } = useOAuthSignIn((error) => setMessage(error));

  return (
    <Screen
      footer={
        <ActionButton
          label={isSubmitting ? "Signing in…" : "Sign in"}
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
        <AppText variant="largeTitle">Sign in</AppText>
        <AppText color={colors.secondary}>
          Sign in with your Neon account to access your routines and pair ChatGPT.
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
