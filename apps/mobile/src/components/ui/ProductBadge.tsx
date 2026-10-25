import { RNHostView } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { usePalette } from "@/components/ui/palette";

type Props = { size?: 40 | 96 };

export default function ProductBadge({ size = 40 }: Props) {
  const colors = usePalette();
  const large = size === 96;
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);

  return (
    <RNHostView matchContents>
      <View
        accessible
        accessibilityLabel="Complément"
        accessibilityRole="image"
        style={large ? styles.large : styles.small}
      >
        <SymbolView
          name={{ ios: "pills.fill", android: "medication", web: "medication" }}
          size={size * 0.48}
          tintColor={large ? colors.cyan : "#FFFFFF"}
        />
      </View>
    </RNHostView>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>, size: Props["size"]) {
  const badge = (diameter: number, backgroundColor: string): ViewStyle => ({
    alignItems: "center",
    backgroundColor,
    borderRadius: diameter / 2,
    height: diameter,
    justifyContent: "center",
    width: diameter,
  });

  return StyleSheet.create({
    small: badge(40, colors.badge),
    large: badge(size ?? 96, colors.surface),
  });
}
