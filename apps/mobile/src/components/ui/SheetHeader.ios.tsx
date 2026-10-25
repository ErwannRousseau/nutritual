import { RNHostView } from "@expo/ui/swift-ui";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/ui/palette";

export default function SheetHeader({ title }: { title: string }) {
  const colors = usePalette();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <RNHostView matchContents={{ vertical: true }}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityLabel="Fermer"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.close}
        >
          <SymbolView name="xmark" size={20} tintColor={colors.blue} />
        </Pressable>
      </View>
    </RNHostView>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    header: { height: 44, justifyContent: "center", position: "relative", width: "100%" },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      left: 0,
      paddingHorizontal: 56,
      position: "absolute",
      right: 0,
      textAlign: "center",
    },
    close: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 22,
      height: 44,
      justifyContent: "center",
      width: 44,
      zIndex: 1,
    },
  });
}
