export function deviceWebSocketUrl(serverUrl: string, ticket: string) {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/device";
  url.search = new URLSearchParams({ ticket }).toString();

  return url.toString();
}
