import { Column, Host, ScrollView } from "@expo/ui";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useHeaderHeight } from "expo-router/react-navigation";
import { KeyboardAvoidingView, Platform, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fillParent } from "@/shared/ui/layout";
import { usePalette } from "@/shared/ui/palette";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  grouped?: boolean;
};

export default function Screen({ children, footer, grouped = false }: Props) {
  const colors = usePalette();
  const colorScheme = useColorScheme() ?? "light";
  const backgroundColor = grouped ? colors.grouped : colors.background;
  const headerHeight = useHeaderHeight();
  const styles = useMemo(() => createStyles(colors, backgroundColor), [backgroundColor, colors]);

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
        style={styles.keyboard}
      >
        <View style={styles.main}>
          <Host
            colorScheme={colorScheme}
            seedColor={colors.blue}
            style={styles.host}
            ignoreSafeArea="keyboard"
            useViewportSizeMeasurement
          >
            <ScrollView showsIndicators={false} style={styles.scroll}>
              <Column spacing={24} style={styles.content}>
                {children}
              </Column>
            </ScrollView>
          </Host>
        </View>
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

function createStyles(colors: ReturnType<typeof usePalette>, backgroundColor: string) {
  return StyleSheet.create({
    root: { backgroundColor, flex: 1 },
    keyboard: { flex: 1 },
    main: { backgroundColor, flex: 1, paddingHorizontal: 20, width: fillParent },
    host: { backgroundColor, flex: 1, width: fillParent },
    scroll: { width: fillParent, height: fillParent },
    content: { paddingBottom: 24, paddingTop: 20, width: fillParent },
    footer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.separator,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    footerHost: {
      alignSelf: "stretch",
      backgroundColor: colors.surface,
      width: fillParent,
    },
    footerContent: { width: fillParent, paddingBottom: 12 },
  });
}
