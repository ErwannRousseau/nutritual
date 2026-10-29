export const AuthStatus = {
  restoring: "restoring",
  authenticated: "authenticated",
  signedOut: "signed-out",
} as const;

export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];
