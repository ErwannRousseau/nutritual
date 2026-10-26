import type { PairingStore } from "./pairing-store.ts";
import type { RoutineRelay } from "./routine-relay.ts";

export const ticketLifetimeMs = 60_000;

export function canUseMcpClient(
  clientId: string | undefined,
  pairedClientId: string | undefined,
  mobileClientId: string,
): boolean {
  return Boolean(clientId && clientId !== mobileClientId && pairedClientId === clientId);
}

export function createPairingOperations(store: PairingStore, relay: RoutineRelay) {
  return {
    allowAttempt(kind: string, ip: string) {
      return store.allowAttempt(kind, ip);
    },

    createChallenge(input: Parameters<PairingStore["createChallenge"]>[0]) {
      return store.createChallenge(input);
    },

    async challengeStatus(
      input: { code: string; pollToken: string; oauthQuery: string },
      browserSub: string,
    ) {
      const challenge = await store.challengeStatus(input);

      if (!challenge || challenge.expires_at <= new Date() || challenge.consumed_at)
        return "expired";

      if (challenge.browser_sub !== browserSub) return "mismatch";

      if (challenge.status === "pending") return challenge.status;

      return (await store.consumeChallengeStatus(input)) ?? "expired";
    },

    inspectChallenge(code: string, userSub: string) {
      return store.inspectChallenge(code, userSub);
    },

    approveChallenge(
      input: { code: string; deviceId: string; deviceSecret: string },
      userSub: string,
    ) {
      return store.withApprovalTransaction(async (transaction) => {
        const challenge = await transaction.findChallenge(input.code);

        if (!challenge) return { commit: false, value: "challenge_unavailable" as const };

        if (challenge.browser_sub !== userSub)
          return { commit: false, value: "account_mismatch" as const };

        const secretHash = store.digestValue(input.deviceSecret);

        let device = await transaction.insertDevice(
          userSub,
          input.deviceId,
          input.deviceSecret,
          crypto.randomUUID(),
          challenge.client_id,
        );

        if (!device) device = await transaction.findDevice(userSub);

        if (
          !device ||
          device.device_id !== input.deviceId ||
          device.device_secret_hash !== secretHash ||
          device.client_id !== challenge.client_id
        )
          return { commit: false, value: "device_already_paired" as const };

        if (!(await transaction.approveChallenge(input.code, userSub, input.deviceId)))
          return { commit: false, value: "challenge_unavailable" as const };

        return { commit: true, value: "approved" as const };
      });
    },

    declineChallenge(code: string, userSub: string) {
      return store.declineChallenge(code, userSub);
    },

    pairingStatus(userSub: string) {
      return store.hasDevice(userSub);
    },

    async disconnect(userSub: string, deviceId: string, deviceSecret: string) {
      const pairingId = await store.disconnectDevice(userSub, deviceId, deviceSecret);

      if (!pairingId) return false;
      relay.disconnectPairedPhone(userSub, deviceId, pairingId);
      await store.deleteDeviceTickets(userSub, pairingId);

      return true;
    },

    async issueDeviceTicket(userSub: string, deviceId: string, deviceSecret: string) {
      const pairingId = await store.pairingIdForDevice(userSub, deviceId, deviceSecret);

      if (!pairingId) return undefined;
      const ticket = crypto.randomUUID() + crypto.randomUUID();
      await store.createDeviceTicket(
        ticket,
        userSub,
        deviceId,
        pairingId,
        new Date(Date.now() + ticketLifetimeMs),
      );

      return ticket;
    },

    consumeDeviceTicket(ticket: string) {
      return store.consumeDeviceTicket(ticket);
    },

    isPairingActive(userSub: string, deviceId: string, pairingId: string) {
      return store.isPairingActive(userSub, deviceId, pairingId);
    },

    async canUseMcpClient(userSub: string, clientId: string | undefined, mobileClientId: string) {
      if (!clientId || clientId === mobileClientId) return false;

      return canUseMcpClient(clientId, await store.pairedClientId(userSub), mobileClientId);
    },
  };
}

export type PairingOperations = ReturnType<typeof createPairingOperations>;
