import { config } from '../config.js';
import { memoize } from '../cache.js';
import { SERVICES, serviceByContainer, type ServiceDef } from '../services.js';

/** Shape of the fields we use from Docker's `GET /containers/json`. */
interface DockerContainer {
  Names?: string[];
  State?: string;
  Status?: string;
}

export type ServiceState =
  /** Running, and healthy if it reports health at all. */
  | 'up'
  /** Running but unhealthy, or restart-looping — the "needs attention" case. */
  | 'attn'
  /** Present but not running. */
  | 'down'
  /** Still coming up; health check hasn't passed yet. */
  | 'starting'
  /** No such container. The user may simply not run this service. */
  | 'absent';

export interface ServiceStatus extends ServiceDef {
  state: ServiceState;
  /** Docker's human-readable status line, e.g. "Up 2 hours (healthy)". */
  status: string | null;
}

export interface HealthReport {
  services: ServiceStatus[];
  /** Count of `up` services. */
  up: number;
  /** Services actually present on this host — `absent` ones are excluded. */
  total: number;
  /** Services needing attention, for the health tile's subtitle. */
  attention: string[];
  /** False when the socket proxy is unreachable; the UI says so explicitly. */
  reachable: boolean;
  /**
   * Whether the per-service `state` values were actually observed, as opposed
   * to placeholders. This is NOT the inverse of `reachable`, and the difference
   * matters: an outage *after* a successful poll still carries real states, just
   * stale ones, so this stays true while `reachable` goes false. It is only
   * false on the cold path, where nothing has ever been observed and every
   * service is reported `absent` because we have nothing better to say.
   *
   * The UI keys "is this service really missing" off this rather than
   * `reachable` — see `launchUrl` in the web app.
   */
  statesKnown: boolean;
}

function classify(container: DockerContainer): ServiceState {
  const state = container.State ?? '';
  const status = container.Status ?? '';

  if (state === 'restarting') return 'attn';
  if (state !== 'running') return 'down';
  // Only containers that declare a healthcheck carry these suffixes; the rest
  // are simply "Up <duration>" and count as up.
  if (status.includes('(unhealthy)')) return 'attn';
  if (status.includes('(health: starting)')) return 'starting';
  return 'up';
}

async function fetchContainers(): Promise<Map<string, DockerContainer>> {
  const response = await fetch(`${config.dockerProxyUrl}/containers/json?all=1`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`docker proxy responded ${response.status}`);
  }

  const containers = (await response.json()) as DockerContainer[];
  const byName = new Map<string, DockerContainer>();
  for (const container of containers) {
    // Docker returns names with a leading slash: ["/plex"].
    for (const name of container.Names ?? []) {
      byName.set(name.replace(/^\//, ''), container);
    }
  }
  return byName;
}

/**
 * The most recent report built from a successful proxy call.
 *
 * A blip in the proxy must not erase what we already know — without this, every
 * service would flip to `absent` and `memoize` would cache that emptiness,
 * blanking the sidebar and the health tile over a transient failure.
 */
let lastGoodReport: HealthReport | null = null;

async function buildReport(): Promise<HealthReport> {
  let byName: Map<string, DockerContainer>;
  try {
    byName = await fetchContainers();
  } catch {
    // Keep the last known state and mark it unreachable, so the UI can show
    // real data flagged as stale rather than an empty stack.
    if (lastGoodReport) return { ...lastGoodReport, reachable: false };

    // Nothing known yet — this is the first call and it failed. Every service
    // reads `absent` here as a placeholder, not an observation, which is what
    // `statesKnown: false` tells the UI.
    return {
      services: SERVICES.map((service) => ({ ...service, state: 'absent', status: null })),
      up: 0,
      total: 0,
      attention: [],
      reachable: false,
      statesKnown: false,
    };
  }

  const services: ServiceStatus[] = SERVICES.map((service) => {
    const container = byName.get(service.container);
    if (!container) return { ...service, state: 'absent', status: null };
    return { ...service, state: classify(container), status: container.Status ?? null };
  });

  // Services absent from this host are excluded from the denominator, so a user
  // who trimmed services out of docker-compose.yml doesn't see a count that can
  // never reach 100%.
  const present = services.filter((s) => s.state !== 'absent');

  const report: HealthReport = {
    services,
    up: present.filter((s) => s.state === 'up').length,
    total: present.length,
    attention: present.filter((s) => s.state === 'attn' || s.state === 'down').map((s) => s.name),
    reachable: true,
    statesKnown: true,
  };

  lastGoodReport = report;
  return report;
}

export const getHealth = memoize(buildReport, config.healthTtlMs);

export const __test = {
  classify,
  serviceByContainer,
  buildReport,
  resetLastGood: () => {
    lastGoodReport = null;
  },
};
