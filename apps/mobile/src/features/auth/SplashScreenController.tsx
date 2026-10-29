import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/features/auth/AuthProvider";

void SplashScreen.preventAutoHideAsync();

export function SplashScreenController() {
  const { isRestoring } = useAuth();

  useEffect(() => {
    if (!isRestoring) SplashScreen.hide();
  }, [isRestoring]);

  return null;
}
