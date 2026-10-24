# Local intake routines: iOS verification

Checked on 24 October 2026 with agent-device, an iPhone 17 simulator, and a local
development build. These observations do not certify physical-device behavior
or Android support.

## Observed flows

- Created a daily Vitamine D routine and a Magnésium routine every two calendar
  days from 2026-10-24. Edited Magnésium to every three days with the same anchor.
  Created Zinc on Tuesday through Friday by deselecting Monday. The Saturday
  overview excluded Zinc and kept the other routines independent.
- Denied notification permission. The routine remained saved with an explanation
  that reminders required permission. Enabled permission through iOS Settings.
  Foregrounding Nutritual then showed scheduled reminders without recreating the
  routine. The interval queue displayed its last covered date.
- A Magnésium notification arrived at 22:03 with Settings in the foreground.
  Returning to Nutritual left intake history empty. Foreground renewal advanced
  the queue coverage. A transient renewal failure exposed reuse of identifiers
  during asynchronous iOS cancellation. New batches now use distinct identifiers.
  Subsequent edits, foreground renewals and relaunches reported accepted queues.
  At 22:15, after closing Nutritual, a daily Vitamine D reminder arrived. Magnésium
  had been scheduled at the same time and then paused. The expanded notification
  list showed only the new Vitamine D entry and the earlier 22:03 Magnésium entry.
  No new Magnésium reminder appeared at the paused occurrence.
- Recorded and undid an intake. Paused and resumed a routine. Closed and relaunched
  the app and observed the saved routine and paused state. Recorded an as-needed
  intake, deleted its routine, and relaunched. Its dated history entry and product
  name remained available.
- Created an as-needed routine with a long product name. Its form hid the reminder
  time, its overview used a separate section, and its intake sheet remained
  readable. Enabled Larger Accessibility Sizes and moved the system slider to
  64%. The overview stacked controls and the form remained scrollable with the
  creation action reachable. Empty-name validation worked. Restored the original
  system text setting afterward.

## Visual inspection

Inspected the supplied local reference images and used agent-device to explore
Apple Health's medication flow: name, type, strength, schedule, native time picker
and review. Cancelled that flow without saving a medication.

Rechecked Nutritual's rebuilt overview, intake sheet, routine details and three-step
creation flow against those references. The shared UI kit uses named StyleSheets,
wide cyan upcoming cards, a neutral recorded-intake group, native navigation and
date/time controls. Creation now separates name, frequency and review.

Verified empty-name and invalid-interval errors, changing an interval's anchor date,
weekday selection, pause, as-needed creation, intake recording and undo. Confirmed
that cancelling an edit returns to its detail screen and saving returns to the
correct destination without a discard alert. Back navigation within the form
preserves its draft. Confirmed discard closes the form, while continuing preserves
the draft.

Inspected dark mode and Larger Accessibility Sizes at 73% in the overview,
frequency form, detail actions and history, including a long product name. Text
wraps and actions remain reachable by scrolling. Restored normal text size and
light appearance. Removed the additional QA routines and undid their intakes.

## Static and build checks

The iOS simulator development build succeeded. Workspace typechecking, lint,
format checks and the five existing server tests passed. No mobile unit or
integration tests were added, following the issue's chosen verification boundary.
Independent reviews covered repository standards and the specification. A spring
DST case with a past occurrence followed by a nonexistent local time was corrected
and logically reviewed.

## Remaining verification

The simulator's General settings did not expose Date & Time. Time-zone travel and
clock changes across DST were not exercised through agent-device. Physical phone
shutdown behavior, queue saturation at 64 notifications, and reliable delivery
over an extended period remain unverified. Deletion was checked in the UI and by
history persistence, without waiting for a deleted routine's future delivery time.

Every-N-day reminders have finite coverage and need the app opened to renew them.
The app never creates catch-up reminders. Suppressing an overdue notification
after phone shutdown remains controlled by iOS, as accepted in ADR-0001.
