import { Column, RNHostView, TextInput, useNativeState } from "@expo/ui";
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import ActionButton from "@/components/ui/ActionButton";
import AppText from "@/components/ui/AppText";
import Screen from "@/components/ui/Screen";
import { fillAvailableWidth } from "@/components/ui/layout";
import { usePalette } from "@/components/ui/palette";
import { authClient } from "@/auth/auth-client";

export default function SignInScreen() {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const email = useNativeState("");
  const password = useNativeState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn() {
    const normalizedEmail = email.value.trim();

    if (!normalizedEmail || !password.value) {
      setMessage("Renseignez votre adresse e-mail et votre mot de passe.");

      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password: password.value,
      });

      if (result.error) {
        password.set("");
        setMessage("Adresse e-mail ou mot de passe incorrect.");
      }
    } catch {
      password.set("");
      setMessage("Connexion impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <ActionButton
          label={isSubmitting ? "Connexion…" : "Se connecter"}
          onPress={() => void signIn()}
          disabled={isSubmitting}
          testID="sign-in-submit"
        />
      }
    >
      <Column spacing={20} modifiers={fillAvailableWidth}>
        <AppText variant="largeTitle">Se connecter</AppText>
        <AppText color={colors.secondary}>Connectez-vous pour accéder à vos routines.</AppText>
        <Column spacing={8} modifiers={fillAvailableWidth}>
          <AppText variant="headline">Adresse e-mail</AppText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="nom@exemple.fr"
            returnKeyType="next"
            modifiers={fillAvailableWidth}
            style={styles.input}
            testID="sign-in-email"
            value={email}
          />
        </Column>
        <Column spacing={8} modifiers={fillAvailableWidth}>
          <AppText variant="headline">Mot de passe</AppText>
          <TextInput
            autoComplete="current-password"
            onSubmitEditing={() => void signIn()}
            placeholder="Mot de passe"
            returnKeyType="done"
            modifiers={fillAvailableWidth}
            secureTextEntry
            style={styles.input}
            testID="sign-in-password"
            value={password}
          />
        </Column>
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
    input: {
      backgroundColor: colors.grouped,
      borderColor: colors.separator,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 17,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    error: { color: colors.danger, fontSize: 17 },
  });
}
