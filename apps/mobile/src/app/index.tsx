import RoutineScreen from "../components/RoutineScreen";
import { useRoutines } from "../routines/useRoutines";

export default function HomeScreen() {
  const { routines, intakes, reminders, busy, error, save, remove, pause, record, undo, reload } =
    useRoutines();

  return (
    <RoutineScreen
      routines={routines}
      intakes={intakes}
      reminders={reminders}
      busy={busy}
      error={error}
      onSave={save}
      onDelete={remove}
      onPause={pause}
      onRecord={record}
      onUndo={undo}
      onRetry={reload}
    />
  );
}
