# Nutritual

Nutritual organizes dietary supplement intake routines and their reminders.

## Language

**Product**: A dietary supplement the user wants to include in their intake
routines.

**Intake routine**: A plan for taking a product on selected weekdays, every N
days from a chosen start date, or as needed. Scheduled times follow the user's
current time zone. An intake routine can be paused.
_Avoid_: Program, reminder

**Intake**: A recorded occurrence of taking a product as part of an intake
routine, with the date and time it was recorded. Receiving a reminder does not
count as an intake.

**Paused routine**: An intake routine whose reminders are suspended while its
schedule is preserved. Resuming it uses the original schedule without catching
up on missed reminders.

**Reminder**: A notification scheduled to signal an intake as part of an intake
routine. _Avoid_: Routine

**Paired phone**: The phone designated to receive intake routine creation
requests from the user's authorized ChatGPT connection. Only one phone is paired
at a time.

**ChatGPT connection**: The user's authorization for ChatGPT to create intake
routines on their paired phone. Revoking this authorization preserves the
phone's existing routines and intake history.
