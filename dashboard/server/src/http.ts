import { config } from './config.js';

/**
 * Every widget is allowed to fail on its own. `Unavailable` is the shape that
 * failure takes: a reason the UI can show, rather than an exception that would
 * take the whole response with it.
 */
export interface Unavailable {
  available: false;
  reason: string;
  /** A concrete next step, when there is one. */
  hint?: string;
}

export type Result<T> = (T & { available: true }) | Unavailable;

export function unavailable(reason: string, hint?: string): Unavailable {
  return hint ? { available: false, reason, hint } : { available: false, reason };
}

/**
 * Turns a thrown error into a reason string a person can act on. Node's fetch
 * wraps the useful part in `cause`, and the bare "fetch failed" it surfaces
 * otherwise tells a user nothing.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'upstream timed out';
    }
    const code = (error.cause as { code?: string } | undefined)?.code;
    if (code === 'ECONNREFUSED') return 'connection refused';
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'host not found';
    return error.message;
  }
  return 'request failed';
}

/** GET a JSON endpoint with a timeout. Throws; callers convert to `Unavailable`. */
export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(config.upstreamTimeoutMs),
  });
  if (!response.ok) {
    // 401/403 almost always means a stale API key, which is worth saying
    // plainly rather than reporting as a generic HTTP error.
    if (response.status === 401 || response.status === 403) {
      throw new Error(`authentication rejected (${response.status})`);
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Wraps a source function so it always resolves. This is the single place the
 * "one dead upstream must never blank the page" rule is enforced.
 */
export async function safely<T extends object>(
  load: () => Promise<T>,
  hint?: string,
): Promise<Result<T>> {
  try {
    return { ...(await load()), available: true };
  } catch (error) {
    return unavailable(describeError(error), hint);
  }
}
