import { SymbolView } from "expo-symbols";
import type { SymbolViewProps } from "expo-symbols";
import { RNHostView } from "@expo/ui";

export const symbolNames = [
  "pills",
  "pill",
  "plus",
  "checkmark",
  "chevron.right",
  "xmark",
  "calendar",
  "clock",
  "pause",
  "ellipsis",
] as const;

export type AppSymbolName = (typeof symbolNames)[number];

export const platformNames: Record<AppSymbolName, NonNullable<SymbolViewProps["name"]>> = {
  pills: { ios: "pills.fill", android: "medication" },
  pill: { ios: "pills", android: "medication" },
  plus: { ios: "plus", android: "add" },
  checkmark: { ios: "checkmark", android: "check" },
  "chevron.right": { ios: "chevron.right", android: "chevron_right" },
  xmark: { ios: "xmark", android: "close" },
  calendar: { ios: "calendar", android: "calendar_month" },
  clock: { ios: "clock", android: "schedule" },
  pause: { ios: "pause.fill", android: "pause" },
  ellipsis: { ios: "ellipsis", android: "more_horiz" },
};

type Props = {
  name: AppSymbolName;
  size?: number;
  color?: string;
};

export default function AppSymbol({ name, size = 20, color }: Props) {
  return (
    <RNHostView matchContents>
      <SymbolView name={platformNames[name]} size={size} tintColor={color} />
    </RNHostView>
  );
}
