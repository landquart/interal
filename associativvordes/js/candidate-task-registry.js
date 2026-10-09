// One manual request per candidate; responses may only update their original context.
export function createCandidateTaskRegistry() {
  const tasks = new Map();
  const cancel = item => { tasks.get(item)?.controller.abort(); tasks.delete(item); };
  return {
    cancel,
    cancelAll() { for (const item of tasks.keys()) cancel(item); },
    begin(item, isContextCurrent) {
      cancel(item);
      const task = { controller: new AbortController() };
      tasks.set(item, task);
      return {
        signal: task.controller.signal,
        isCurrent: () => tasks.get(item) === task && !task.controller.signal.aborted && isContextCurrent(),
        finish() { if (tasks.get(item) === task) tasks.delete(item); }
      };
    }
  };
}
