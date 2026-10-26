import { Text as UniversalText } from "@expo/ui";
import type { TextProps as UniversalTextProps, UniversalTextStyle } from "@expo/ui";
import { useWindowDimensions, StyleSheet } from "react-native";
import { usePalette } from "@/shared/ui/palette";

export type TextVariant = "largeTitle" | "title" | "headline" | "body" | "subhead" | "footnote";

type Props = Omit<UniversalTextProps, "textStyle"> & {
  variant?: TextVariant;
  color?: string;
  textStyle?: UniversalTextStyle;
};

const typography: Record<TextVariant, UniversalTextStyle> = StyleSheet.create({
  largeTitle: { fontSize: 34, fontWeight: "700", lineHeight: 41 },
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
  headline: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  body: { fontSize: 17, fontWeight: "400", lineHeight: 24 },
  subhead: { fontSize: 15, fontWeight: "400", lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
});

export default function AppText({ variant = "body", color, textStyle, ...props }: Props) {
  const { fontScale } = useWindowDimensions();
  const colors = usePalette();
  const baseStyle = typography[variant === "largeTitle" && fontScale > 1.3 ? "title" : variant];
  const fontSize = textStyle?.fontSize ?? baseStyle.fontSize ?? 17;

  const resolvedStyle: UniversalTextStyle = {
    ...baseStyle,
    ...textStyle,
    color: color ?? textStyle?.color ?? colors.text,
    fontSize: fontSize * fontScale,
  };

  if (resolvedStyle.lineHeight !== undefined) {
    resolvedStyle.lineHeight *= fontScale;
  }

  if (resolvedStyle.letterSpacing !== undefined) {
    resolvedStyle.letterSpacing *= fontScale;
  }

  return <UniversalText {...props} textStyle={resolvedStyle} />;
}
