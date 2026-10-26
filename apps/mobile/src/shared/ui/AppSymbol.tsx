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
  pills: { ios: "pills.fill", android: "medication", web: "medication" },
  pill: { ios: "pills", android: "medication", web: "medication" },
  plus: { ios: "plus", android: "add", web: "add" },
  checkmark: { ios: "checkmark", android: "check", web: "check" },
  "chevron.right": { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  xmark: { ios: "xmark", android: "close", web: "close" },
  calendar: { ios: "calendar", android: "calendar_month", web: "calendar_month" },
  clock: { ios: "clock", android: "schedule", web: "schedule" },
  pause: { ios: "pause.fill", android: "pause", web: "pause" },
  ellipsis: { ios: "ellipsis", android: "more_horiz", web: "more_horiz" },
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
