import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";
import { FrequencyKind, ReminderOutcomes } from "@nutritual/protocol";
import type { NotificationRequestInput } from "expo-notifications";
import type { ReminderState, Routine } from "@/features/routines/model";
import { nextOccurrence } from "@/features/routines/model";

const identifierPrefix = "nutritual:";
const maxIntervalReminders = 16;
const iosPendingLimit = 64;
let pendingReminderWork: Promise<unknown> = Promise.resolve();

function serializeReminderWork<T>(work: () => Promise<T>): Promise<T> {
  const result = pendingReminderWork.then(work, work);
  pendingReminderWork = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

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
      title: "Routine reminder",
      body: `Time to take ${routine.productName}.`,
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

async function updateReminderOnce(
  routine: Routine,
  requestPermission: boolean,
): Promise<ReminderState> {
  try {
    const prefix = routinePrefix(routine.id);
    await cancelScheduled(await ownScheduled(prefix));

    if (routine.paused) return state(routine.id, "paused", "Routine paused. No active reminders.");

    if (routine.frequency.kind === FrequencyKind.asNeeded)
      return state(routine.id, ReminderOutcomes.none, "As-needed routine. No reminders scheduled.");

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
        ReminderOutcomes.denied,
        "Allow notifications in Settings to enable reminders.",
      );

    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const slots = iosPendingLimit - pending.length;
    const requests: NotificationRequestInput[] = [];
    // iOS cancellation has no completion callback, so never reuse an identifier being removed.
    const batchPrefix = `${prefix}${randomUUID()}:`;
    const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(routine.time);

    if (!time) throw new Error("Invalid reminder time.");

    const hour = Number(time[1]);
    const minute = Number(time[2]);
    let lastIntervalDate: Date | null = null;

    if (routine.frequency.kind === FrequencyKind.weekdays) {
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

      if (!requests.length) throw new Error("No notification slots are available.");
    }

    if (requests.length > slots) throw new Error("No notification slots are available.");

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
      throw new Error("The system did not keep all scheduled reminders.");
    }

    const message = lastIntervalDate
      ? `Reminders are scheduled through ${lastIntervalDate.toLocaleDateString("en-GB")}. Open Nutritual before this date to renew them.`
      : `Reminder scheduled for ${routine.time}.`;

    return state(routine.id, ReminderOutcomes.scheduled, message);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Try again later.";

    return state(
      routine.id,
      ReminderOutcomes.failed,
      `Routine saved. Reminder status is unconfirmed. ${detail}`,
    );
  }
}

export function updateReminder(
  routine: Routine,
  requestPermission: boolean,
): Promise<ReminderState> {
  return serializeReminderWork(() => updateReminderOnce(routine, requestPermission));
}

async function removeRemindersOnce(routineId: string): Promise<void> {
  await cancelScheduled(await ownScheduled(routinePrefix(routineId)));
}

export function removeReminders(routineId: string): Promise<void> {
  return serializeReminderWork(() => removeRemindersOnce(routineId));
}

async function removeOrphanRemindersOnce(routineIds: string[]): Promise<void> {
  const activePrefixes = routineIds.map(routinePrefix);

  const orphaned = (await Notifications.getAllScheduledNotificationsAsync()).filter(
    (item) =>
      item.identifier.startsWith(identifierPrefix) &&
      !activePrefixes.some((prefix) => item.identifier.startsWith(prefix)),
  );

  await cancelScheduled(orphaned);
}

export function removeOrphanReminders(routineIds: string[]): Promise<void> {
  return serializeReminderWork(() => removeOrphanRemindersOnce(routineIds));
}

export function restoreReminders(routines: Routine[]): Promise<ReminderState[]> {
  return serializeReminderWork(async () => {
    await removeOrphanRemindersOnce(routines.map((routine) => routine.id));
    const results: ReminderState[] = [];

    for (const routine of routines) results.push(await updateReminderOnce(routine, false));

    return results;
  });
}
