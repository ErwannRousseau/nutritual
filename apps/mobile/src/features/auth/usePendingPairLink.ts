import { useEffect, useLayoutEffect, useRef } from "react";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { router, useRootNavigationState } from "expo-router";
import { createPendingPairLinkCoordinator } from "@/features/auth/pending-pair-link";
import { useAuth } from "@/features/auth/AuthProvider";

export function usePendingPairLink() {
  const { isAuthenticated } = useAuth();
  const navigationState = useRootNavigationState();
  const navigation = useRef({ ready: false, authenticated: false });
  const coordinator = useRef<ReturnType<typeof createPendingPairLinkCoordinator> | null>(null);
  const active = useRef(true);

  useLayoutEffect(() => {
    navigation.current = {
      ready: Boolean(navigationState?.key),
      authenticated: isAuthenticated,
    };
  }, [navigationState?.key, isAuthenticated]);

  useEffect(() => {
    active.current = true;
    coordinator.current ??= createPendingPairLinkCoordinator(
      (code) => SecureStore.setItemAsync("nutritual.pending-pair-code", code),
      () => (active.current ? navigation.current : { ready: false, authenticated: false }),
      (code, authenticated) => {
        if (active.current)
          router.replace(authenticated ? { pathname: "/pair", params: { code } } : "/sign-in");
      },
    );

    const pairLinks = coordinator.current;

    const subscription = Linking.addEventListener(
      "url",
      ({ url }) => void pairLinks.handleUrl(url),
    );

    void Linking.getInitialURL().then((url) => {
      if (active.current && url) void pairLinks.handleInitialUrl(url);
    });

    return () => {
      active.current = false;
      navigation.current.ready = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !navigationState?.key || !coordinator.current) return;
    let current = true;

    void coordinator.current
      .readPendingCode(() => SecureStore.getItemAsync("nutritual.pending-pair-code"))
      .then((code) => {
        if (current && active.current && navigation.current.authenticated && code)
          router.replace({ pathname: "/pair", params: { code } });
      });

    return () => {
      current = false;
    };
  }, [navigationState?.key, isAuthenticated]);
}
