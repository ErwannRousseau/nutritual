export function createActionQueue(onBusyChange: (busy: boolean) => void) {
  let pending = 1;
  let finishLoading!: () => void;

  let tail = new Promise<void>((resolve) => {
    finishLoading = resolve;
  });

  function finish() {
    pending -= 1;
    onBusyChange(pending > 0);
  }

  return {
    isBusy: () => pending > 0,
    finishLoading() {
      finish();
      finishLoading();
    },
    run<T>(action: () => Promise<T>): Promise<T> {
      pending += 1;
      onBusyChange(true);
      const result = tail.then(action);
      tail = result.then(
        () => undefined,
        () => undefined,
      );

      return result.finally(finish);
    },
  };
}
