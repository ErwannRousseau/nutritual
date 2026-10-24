import type { ComponentProps } from "react";
import { Text as UniversalText } from "@expo/ui";
import { useWindowDimensions } from "react-native";

type Props = ComponentProps<typeof UniversalText>;

export default function ScaledText({ textStyle, ...props }: Props) {
  const { fontScale } = useWindowDimensions();

  const scaledTextStyle: NonNullable<Props["textStyle"]> = {
    ...textStyle,
    fontSize: (textStyle?.fontSize ?? 17) * fontScale,
  };

  if (textStyle?.lineHeight !== undefined)
    scaledTextStyle.lineHeight = textStyle.lineHeight * fontScale;

  if (textStyle?.letterSpacing !== undefined)
    scaledTextStyle.letterSpacing = textStyle.letterSpacing * fontScale;

  return <UniversalText {...props} textStyle={scaledTextStyle} />;
}
