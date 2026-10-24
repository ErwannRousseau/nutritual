import { RNHostView } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";
import { usePalette } from "./palette";

type Props = { size?: 40 | 96 };

export default function ProductBadge({ size = 40 }: Props) {
  const colors = usePalette();
  const large = size === 96;

  const styles = StyleSheet.create({
    badge: {
      alignItems: "center",
      backgroundColor: large ? colors.surface : colors.badge,
      borderRadius: size / 2,
      height: size,
      justifyContent: "center",
      width: size,
    },
  });

  return (
    <RNHostView matchContents>
      <View
        accessible
        accessibilityLabel="Complément"
        accessibilityRole="image"
        style={styles.badge}
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
