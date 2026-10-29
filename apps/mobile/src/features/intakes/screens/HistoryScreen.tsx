import { Host, List, ListItem } from "@expo/ui";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { useRoutineStore } from "@/features/routines/RoutinesProvider";
import type { Intake } from "@/features/routines/model";
import { dateLabel, timeLabel } from "@/features/routines/display";
import Text from "@/shared/ui/Text";
import AppSymbol from "@/shared/ui/AppSymbol";
import Screen from "@/shared/ui/Screen";
import { usePalette } from "@/shared/ui/palette";

export default function HistoryScreen() {
  const { intakes } = useRoutineStore();
  const colors = usePalette();
  const scheme = useColorScheme() ?? "light";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const history = [...intakes].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const renderRow = useCallback(
    ({ item }: { item: Intake }) => {
      const date = new Date(item.recordedAt);

      return (
        <ListItem
          onPress={() => router.push({ pathname: "/intake/[id]", params: { id: item.id } })}
        >
          <ListItem.Leading>
            <AppSymbol name="checkmark" color={colors.cyan} />
          </ListItem.Leading>
          <Text>{item.productName}</Text>
          <ListItem.Supporting>
            <Text
              variant="subhead"
              color={colors.secondary}
            >{`${dateLabel(date)} ${date.getFullYear()} at ${timeLabel(date)}`}</Text>
          </ListItem.Supporting>
          <ListItem.Trailing>
            <AppSymbol name="chevron.right" size={14} color={colors.secondary} />
          </ListItem.Trailing>
        </ListItem>
      );
    },
    [colors.cyan, colors.secondary],
  );

  if (history.length === 0)
    return (
      <Screen>
        <Text color={colors.secondary}>Your recorded intakes will appear here.</Text>
      </Screen>
    );

  return (
    <Host style={styles.host} colorScheme={scheme} seedColor={colors.blue}>
      <List>
        <List.ForEach data={history} keyExtractor={(item) => item.id}>
          {renderRow}
        </List.ForEach>
      </List>
    </Host>
  );
}

function createStyles(colors: ReturnType<typeof usePalette>) {
  return StyleSheet.create({ host: { flex: 1, backgroundColor: colors.grouped } });
}
