/**
 * TTL memo with in-flight de-duplication.
 *
 * Every widget polls on its own interval and several browsers may be open at
 * once; without this, each poll would hit the upstream directly. Concurrent
 * calls during a miss share one in-flight promise so a slow upstream can't be
 * stampeded.
 */
export function memoize<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let value: T | undefined;
  let expiresAt = 0;
  let inFlight: Promise<T> | null = null;

  return async () => {
    if (value !== undefined && Date.now() < expiresAt) return value;
    if (inFlight) return inFlight;

    inFlight = fn()
      .then((result) => {
        value = result;
        expiresAt = Date.now() + ttlMs;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}
