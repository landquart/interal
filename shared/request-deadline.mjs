// Reuse the existing 70s candidate-service budget for local resource requests.
// This bounds completion; it does not make promises about service latency.
export const RESOURCE_REQUEST_TIMEOUT_MS = 70_000;

export async function withRequestDeadline(operation, { signal, timeoutMs = RESOURCE_REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timer;
  let rejectCancellation;
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject; });
  const abort = () => {
    const error = signal?.reason || new DOMException('Aborted', 'AbortError');
    controller.abort(error); rejectCancellation(error);
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  else timer = setTimeout(() => {
    const error = Object.assign(new Error('Request deadline exceeded'), { name: 'TimeoutError', code: 'REQUEST_TIMEOUT' });
    controller.abort(error); rejectCancellation(error);
  }, timeoutMs);
  try {
    return await Promise.race([
      cancellation,
      controller.signal.aborted ? Promise.reject(controller.signal.reason) : operation(controller.signal)
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
