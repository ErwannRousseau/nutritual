import { useColorScheme } from "react-native";

const lightPalette = {
  background: "#FFFFFF",
  grouped: "#F2F2F7",
  surface: "#FFFFFF",
  upcoming: "#E5F7FA",
  text: "#1C1C1E",
  secondary: "#6C6C70",
  blue: "#006AD8",
  cyan: "#008FA8",
  badge: "#007F95",
  separator: "#D1D1D6",
  danger: "#D92D20",
} as const;

const darkPalette = {
  background: "#000000",
  grouped: "#1C1C1E",
  surface: "#2C2C2E",
  upcoming: "#16323A",
  text: "#FFFFFF",
  secondary: "#8E8E93",
  blue: "#0A84FF",
  cyan: "#64D2FF",
  badge: "#007F95",
  separator: "#38383A",
  danger: "#FF6961",
} as const;

export type Palette = { [Key in keyof typeof lightPalette]: string };

export function usePalette(): Palette {
  const scheme = useColorScheme();

  return scheme === "dark" ? darkPalette : lightPalette;
}
