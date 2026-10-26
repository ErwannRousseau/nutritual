import { RNHostView } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";
import { platformNames, type AppSymbolName } from "@/shared/ui/AppSymbol";
import { usePalette } from "@/shared/ui/palette";

type Props = {
  name: AppSymbolName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function IconButton({ name, label, onPress, disabled = false }: Props) {
  const colors = usePalette();

  return (
    <RNHostView matchContents>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.icon}
      >
        <SymbolView name={platformNames[name]} size={20} tintColor={colors.blue} />
      </Pressable>
    </RNHostView>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
});
