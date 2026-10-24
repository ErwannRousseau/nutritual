import { Column, Host, ScrollView } from "@expo/ui";
import type { ReactNode } from "react";
import { useHeaderHeight } from "expo-router/react-navigation";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "./palette";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  grouped?: boolean;
};

export default function Screen({ children, footer, grouped = false }: Props) {
  const { width } = useWindowDimensions();
  const colors = usePalette();
  const colorScheme = useColorScheme() ?? "light";
  const backgroundColor = grouped ? colors.grouped : colors.background;
  const headerHeight = useHeaderHeight();

  const styles = StyleSheet.create({
    root: { backgroundColor, flex: 1 },
    keyboard: { flex: 1 },
    host: { backgroundColor, flex: 1 },
    scroll: { width, height: "100%" as const },
    content: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 20, width },
    footer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.separator,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    footerHost: { backgroundColor: colors.surface },
    footerContent: { width: width - 40, paddingBottom: 12 },
  });

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
        style={styles.keyboard}
      >
        <Host
          colorScheme={colorScheme}
          seedColor={colors.blue}
          style={styles.host}
          ignoreSafeArea="keyboard"
        >
          <ScrollView showsIndicators={false} style={styles.scroll}>
            <Column spacing={24} style={styles.content}>
              {children}
            </Column>
          </ScrollView>
        </Host>
        {footer ? (
          <View style={styles.footer}>
            <Host
              colorScheme={colorScheme}
              ignoreSafeArea="all"
              matchContents={{ vertical: true }}
              seedColor={colors.blue}
              style={styles.footerHost}
            >
              <Column style={styles.footerContent}>{footer}</Column>
            </Host>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
