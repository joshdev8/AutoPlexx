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

/** An upstream this dashboard talks to over HTTP, for building failure hints. */
export interface Upstream {
  /** Display name as the user knows it, e.g. "Sonarr". */
  name: string;
  /** The env var overriding its base URL, e.g. `SONARR_URL`. */
  urlVar: string;
}

/**
 * Builds the next step that actually matches a failure.
 *
 * Generalises what `hintFor` in `transmission.ts` does for one service: a
 * rejected credential and an unreachable host need completely different fixes,
 * and a generic hint sends people looking in the wrong place. Without this,
 * every source except Transmission reported a bare reason and no next step — so
 * a service on a network the dashboard doesn't share read "upstream timed out",
 * and the natural guess is to go re-check an API key that was never at fault.
 */
export function upstreamHint({ name, urlVar }: Upstream): (reason: string) => string {
  return (reason) => {
    if (reason.includes('authentication')) {
      return `${name} rejected the dashboard's API key. Confirm the key in ${name}'s own settings, or set it in .env to override what was discovered.`;
    }
    if (reason.includes('host not found')) {
      return `Nothing resolved ${name}'s hostname. It has to be defined in docker-compose.yml and share a network with the dashboard — or set ${urlVar} in .env to reach it another way.`;
    }
    if (reason.includes('refused')) {
      return `${name} resolved but refused the connection, so it is probably still starting, or not listening on the port ${urlVar} points at.`;
    }
    if (reason.includes('timed out')) {
      return `${name} did not answer in time — either still starting, or not reachable from the dashboard's networks. ${urlVar} overrides where to look.`;
    }
    return `Check the ${name} container logs.`;
  };
}

/**
 * Wraps a source function so it always resolves. This is the single place the
 * "one dead upstream must never blank the page" rule is enforced.
 *
 * The hint may be a function of the reason rather than a fixed string, because
 * the useful next step usually depends on how the call failed.
 */
export async function safely<T extends object>(
  load: () => Promise<T>,
  hint?: string | ((reason: string) => string),
): Promise<Result<T>> {
  try {
    return { ...(await load()), available: true };
  } catch (error) {
    const reason = describeError(error);
    return unavailable(reason, typeof hint === 'function' ? hint(reason) : hint);
  }
}
