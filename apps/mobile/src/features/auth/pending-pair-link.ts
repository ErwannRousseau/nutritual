import { normalizePairCode } from "./parse";

type Navigation = { ready: boolean; authenticated: boolean };

export function createPendingPairLinkCoordinator(
  storeCode: (code: string) => Promise<void>,
  getNavigation: () => Navigation,
  navigate: (code: string, authenticated: boolean) => void,
) {
  let revision = 0;
  let writing = false;
  let writes = Promise.resolve();

  async function handleUrl(url: string) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      return false;
    }

    if (parsedUrl.pathname !== "/pair") return false;
    const code = normalizePairCode(parsedUrl.searchParams.get("code"));

    if (!code) return false;
    const request = ++revision;
    writing = true;
    writes = writes.catch(() => {}).then(() => storeCode(code));

    try {
      await writes;
    } finally {
      if (request === revision) writing = false;
    }

    if (request === revision) {
      const navigation = getNavigation();

      if (navigation.ready) navigate(code, navigation.authenticated);
    }

    return true;
  }

  return {
    handleUrl,
    handleInitialUrl: (url: string) => revision === 0 && handleUrl(url),
    readPendingCode: async (readCode: () => Promise<string | null>) => {
      const request = revision;

      if (writing) return null;
      const code = await readCode();

      return request === revision && !writing ? code : null;
    },
  };
}
