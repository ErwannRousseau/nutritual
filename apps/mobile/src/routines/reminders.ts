import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";
import type { NotificationRequestInput } from "expo-notifications";
import type { ReminderState, Routine } from "./model";
import { nextOccurrence } from "./model";

const identifierPrefix = "nutritual:";
const maxIntervalReminders = 16;
const iosPendingLimit = 64;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function routinePrefix(routineId: string): string {
  return `${identifierPrefix}${routineId}:`;
}

async function ownScheduled(prefix: string) {
  return (await Notifications.getAllScheduledNotificationsAsync()).filter((item) =>
    item.identifier.startsWith(prefix),
  );
}

async function cancelScheduled(items: { identifier: string }[]): Promise<void> {
  for (const item of items) await Notifications.cancelScheduledNotificationAsync(item.identifier);
}

function state(routineId: string, status: ReminderState["status"], message: string): ReminderState {
  return { routineId, status, message };
}

function notification(
  routine: Routine,
  identifier: string,
  trigger: NotificationRequestInput["trigger"],
): NotificationRequestInput {
  return {
    identifier,
    content: {
      title: "Rappel de routine",
      body: `C’est l’heure de prendre ${routine.productName}.`,
      sound: "default",
      data: { routineId: routine.id },
    },
    trigger,
  };
}

function intervalOccurrences(routine: Routine, count: number): Date[] {
  const occurrences: Date[] = [];
  let occurrence = nextOccurrence(routine, new Date());

  for (let index = 0; index < count && occurrence; index += 1) {
    occurrences.push(occurrence);
    occurrence = nextOccurrence(routine, occurrence);
  }

  return occurrences;
}

export async function updateReminder(
  routine: Routine,
  requestPermission: boolean,
): Promise<ReminderState> {
  try {
    const prefix = routinePrefix(routine.id);
    await cancelScheduled(await ownScheduled(prefix));

    if (routine.paused) return state(routine.id, "paused", "Routine en pause. Aucun rappel actif.");

    if (routine.frequency.kind === "as-needed")
      return state(routine.id, "none", "Routine à la demande. Aucun rappel programmé.");

    let permissions = await Notifications.getPermissionsAsync();

    const hasPermission = (value: typeof permissions) =>
      value.ios
        ? value.ios.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
          value.ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
          value.ios.status === Notifications.IosAuthorizationStatus.EPHEMERAL
        : value.status === "granted";

    if (!hasPermission(permissions) && requestPermission) {
      permissions = await Notifications.requestPermissionsAsync();
    }

    if (!hasPermission(permissions))
      return state(
        routine.id,
        "denied",
        "Autorisez les notifications dans les réglages pour activer les rappels.",
      );

    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const slots = iosPendingLimit - pending.length;
    const requests: NotificationRequestInput[] = [];
    // iOS cancellation has no completion callback, so never reuse an identifier being removed.
    const batchPrefix = `${prefix}${randomUUID()}:`;
    const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(routine.time);

    if (!time) throw new Error("Heure de rappel invalide.");

    const hour = Number(time[1]);
    const minute = Number(time[2]);
    let lastIntervalDate: Date | null = null;

    if (routine.frequency.kind === "weekdays") {
      if (routine.frequency.days.length === 7) {
        requests.push(
          notification(routine, `${batchPrefix}daily`, {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          }),
        );
      } else {
        for (const day of routine.frequency.days) {
          requests.push(
            notification(routine, `${batchPrefix}weekday-${day}`, {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: day + 1,
              hour,
              minute,
            }),
          );
        }
      }
    } else {
      const occurrences = intervalOccurrences(routine, Math.min(maxIntervalReminders, slots));
      lastIntervalDate = occurrences.at(-1) ?? null;

      for (const [index, occurrence] of occurrences.entries()) {
        requests.push(
          notification(routine, `${batchPrefix}interval-${index}`, {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            year: occurrence.getFullYear(),
            month: occurrence.getMonth() + 1,
            day: occurrence.getDate(),
            hour: occurrence.getHours(),
            minute: occurrence.getMinutes(),
            repeats: false,
          }),
        );
      }

      if (!requests.length) throw new Error("Aucun créneau de notification disponible.");
    }

    if (requests.length > slots) throw new Error("Aucun créneau de notification disponible.");

    const created: string[] = [];

    try {
      for (const request of requests)
        created.push(await Notifications.scheduleNotificationAsync(request));
    } catch (error) {
      await cancelScheduled(created.map((identifier) => ({ identifier })));
      throw error;
    }

    const scheduled = await ownScheduled(prefix);

    if (created.some((identifier) => !scheduled.some((item) => item.identifier === identifier))) {
      await cancelScheduled(scheduled);
      throw new Error("Le système n’a pas conservé tous les rappels programmés.");
    }

    const message = lastIntervalDate
      ? `Rappels programmés jusqu’au ${lastIntervalDate.toLocaleDateString("fr-FR")}. Ouvrez Nutritual avant cette date pour les renouveler.`
      : `Rappel programmé à ${routine.time}.`;

    return state(routine.id, "scheduled", message);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Réessayez plus tard.";

    return state(
      routine.id,
      "failed",
      `Routine enregistrée. L’état du rappel n’est pas confirmé. ${detail}`,
    );
  }
}

export async function removeReminders(routineId: string): Promise<void> {
  await cancelScheduled(await ownScheduled(routinePrefix(routineId)));
}

export async function removeOrphanReminders(routineIds: string[]): Promise<void> {
  const activePrefixes = routineIds.map(routinePrefix);

  const orphaned = (await Notifications.getAllScheduledNotificationsAsync()).filter(
    (item) =>
      item.identifier.startsWith(identifierPrefix) &&
      !activePrefixes.some((prefix) => item.identifier.startsWith(prefix)),
  );

  await cancelScheduled(orphaned);
}
