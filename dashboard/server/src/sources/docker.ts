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

async function buildReport(): Promise<HealthReport> {
  let byName: Map<string, DockerContainer>;
  try {
    byName = await fetchContainers();
  } catch {
    // The proxy being down must not blank the page — report every service as
    // unknown and let the UI explain that container state is unavailable.
    return {
      services: SERVICES.map((service) => ({ ...service, state: 'absent', status: null })),
      up: 0,
      total: 0,
      attention: [],
      reachable: false,
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

  return {
    services,
    up: present.filter((s) => s.state === 'up').length,
    total: present.length,
    attention: present.filter((s) => s.state === 'attn' || s.state === 'down').map((s) => s.name),
    reachable: true,
  };
}

export const getHealth = memoize(buildReport, config.healthTtlMs);

export const __test = { classify, serviceByContainer };
