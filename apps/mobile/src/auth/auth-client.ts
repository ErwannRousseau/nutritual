import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env.EXPO_PUBLIC_SERVER_URL;

if (!baseURL) throw new Error("Set EXPO_PUBLIC_SERVER_URL to the Nutritual server origin.");

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "nutritual",
      storagePrefix: "nutritual",
      storage: SecureStore,
    }),
  ],
});
