import type { UniversalDimension } from "@expo/ui";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { containerRelativeFrame, frame } from "@expo/ui/swift-ui/modifiers";
import { Platform } from "react-native";

export const fillParent: UniversalDimension = "100%";
export const sixtyPercent: UniversalDimension = "60%";

export const fillAvailableWidth = Platform.select({
  ios: [frame({ maxWidth: Infinity, alignment: "leading" })],
  android: [fillMaxWidth()],
});

export const fillContainerWidth = Platform.select({
  ios: [containerRelativeFrame({ axes: "horizontal", alignment: "leading" })],
  android: fillAvailableWidth,
});

export const centerAvailableWidth = Platform.select({
  ios: [frame({ maxWidth: Infinity, alignment: "center" })],
  android: [fillMaxWidth()],
});
