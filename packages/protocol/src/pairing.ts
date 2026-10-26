export type PairingChallengeRequest = {
  oauthQuery: string;
};

export type PairingChallengeResponse = {
  code: string;
  pollToken: string;
  qrUrl: string;
  expiresAt: string;
};

export type PairingChallengeStatus = "pending" | "approved" | "declined" | "mismatch" | "expired";

export type PairingChallengeStatusRequest = PairingChallengeRequest & {
  code: string;
  pollToken: string;
};

export type PairingChallengeStatusResponse = {
  status: PairingChallengeStatus;
};

export type PairingCodeRequest = {
  code: string;
};

export type PairingOAuthRequestDetails = {
  clientId: string;
  redirectHost: string;
  scope: string[];
  resource: string | null;
};

export type PairingChallengeInspectionResponse = {
  status: "pending";
  details: PairingOAuthRequestDetails;
};

export type PairingApprovalRequest = PairingCodeRequest & {
  deviceId: string;
  deviceSecret: string;
};

export type PairingDeviceRequest = {
  deviceId: string;
  deviceSecret: string;
};

export type PairingStatusResponse = {
  paired: boolean;
};

export type DeviceTicketResponse = {
  ticket: string;
};
