export function redirectSystemPath({ path }: { path: string }) {
  if (path.startsWith("com.erwannrousseau.nutritual:///oauth/callback?")) return null;

  return path;
}
