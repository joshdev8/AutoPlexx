/**
 * The service catalog — the single source of truth for what the dashboard knows
 * about the stack. Both the sidebar groups and the Launcher grid render from
 * this array, and `/api/health` matches container state against it.
 *
 * Derived from docker-compose.yml, NOT from the design prototype's mock data
 * (which lists Prowlarr under Downloads, omits Sonarr from the sidebar, and
 * hard-codes VPN details). When a service is added to or removed from
 * docker-compose.yml, update this file to match.
 */

/** Semantic hues from the design's `--ap-*` custom properties. */
export type Hue = 'green' | 'amber' | 'red' | 'cyan' | 'violet';

/**
 * `system` services have no web UI and are hidden from the sidebar and
 * Launcher, but still count toward stack health.
 */
export type ServiceGroup = 'media' | 'downloads' | 'monitoring' | 'system';

export interface ServiceDef {
  /** Stable identifier, matches the compose service key. */
  id: string;
  /** Display name. */
  name: string;
  /** Two-letter monogram for the icon tile. */
  mono: string;
  /** `container_name` in docker-compose.yml — how health lookups match. */
  container: string;
  group: ServiceGroup;
  hue: Hue;
  /**
   * Host port the service's web UI is published on, if any. Services with a
   * null port have no UI and render without an "Open" affordance.
   */
  port: number | null;
  /** One-line description, shown under the name in the Launcher. */
  blurb: string;
}

export const SERVICES: readonly ServiceDef[] = [
  // ============ MEDIA ============
  {
    id: 'plex',
    name: 'Plex',
    mono: 'PX',
    container: 'plex',
    group: 'media',
    hue: 'amber',
    port: 32400,
    blurb: 'Central media server',
  },
  {
    id: 'seerr',
    name: 'Seerr',
    mono: 'SE',
    container: 'seerr',
    group: 'media',
    hue: 'violet',
    port: 5055,
    blurb: 'Content requests',
  },
  {
    id: 'radarr',
    name: 'Radarr',
    mono: 'RA',
    container: 'radarr',
    group: 'media',
    hue: 'cyan',
    port: 7878,
    blurb: 'Movie management',
  },
  {
    id: 'sonarr',
    name: 'Sonarr',
    mono: 'SO',
    container: 'sonarr',
    group: 'media',
    hue: 'cyan',
    port: 8989,
    blurb: 'TV management',
  },
  {
    id: 'prowlarr',
    name: 'Prowlarr',
    mono: 'PR',
    container: 'prowlarr',
    group: 'media',
    hue: 'green',
    port: 9696,
    blurb: 'Indexer manager',
  },
  {
    id: 'bazarr',
    name: 'Bazarr',
    mono: 'BZ',
    container: 'bazarr',
    group: 'media',
    hue: 'green',
    port: 6767,
    blurb: 'Subtitle management',
  },
  {
    id: 'maintainerr',
    name: 'Maintainerr',
    mono: 'MN',
    container: 'maintainerr',
    group: 'media',
    hue: 'violet',
    port: 6246,
    blurb: 'Rule-based library cleanup',
  },
  {
    id: 'checkrr',
    name: 'Checkrr',
    mono: 'CK',
    container: 'checkrr',
    group: 'media',
    hue: 'amber',
    port: 8585,
    blurb: 'Media integrity scanning',
  },
  {
    id: 'watchlistarr',
    name: 'Watchlistarr',
    mono: 'WL',
    container: 'watchlistarr',
    group: 'media',
    hue: 'cyan',
    port: null,
    blurb: 'Syncs Plex watchlist to *arrs',
  },

  // ============ DOWNLOADS ============
  {
    id: 'transmission',
    name: 'Transmission',
    mono: 'TR',
    container: 'transmission',
    group: 'downloads',
    hue: 'green',
    port: 9091,
    blurb: 'Torrent client via VPN',
  },
  {
    id: 'flaresolverr',
    name: 'FlareSolverr',
    mono: 'FS',
    container: 'flaresolverr',
    group: 'downloads',
    hue: 'cyan',
    port: 8191,
    blurb: 'Cloudflare bypass proxy',
  },
  {
    id: 'requestrr',
    name: 'Requestrr',
    mono: 'RQ',
    container: 'requestrr',
    group: 'downloads',
    hue: 'violet',
    port: 4545,
    blurb: 'Discord request bot',
  },
  {
    id: 'decluttarr',
    name: 'Decluttarr',
    mono: 'DC',
    container: 'decluttarr',
    group: 'downloads',
    hue: 'amber',
    port: null,
    blurb: 'Clears stalled *arr queue items',
  },
  {
    id: 'cleanarr',
    name: 'Cleanarr',
    mono: 'CL',
    container: 'cleanarr',
    group: 'downloads',
    hue: 'amber',
    port: null,
    blurb: 'Duplicate content cleanup',
  },

  // ============ MONITORING ============
  {
    id: 'grafana',
    name: 'Grafana',
    mono: 'GF',
    container: 'grafana',
    group: 'monitoring',
    hue: 'amber',
    // Host port is ${GRAFANA_PORT:-3000}; resolved from env at request time.
    port: 3000,
    blurb: 'Metrics visualization',
  },
  {
    id: 'tautulli',
    name: 'Tautulli',
    mono: 'TA',
    container: 'tautulli',
    group: 'monitoring',
    hue: 'cyan',
    port: 8181,
    blurb: 'Plex usage monitoring',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    mono: 'PM',
    container: 'prometheus',
    group: 'monitoring',
    hue: 'red',
    port: 9090,
    blurb: 'Time-series metrics',
  },
  {
    id: 'tracearr',
    name: 'Tracearr',
    mono: 'TC',
    container: 'tracearr',
    group: 'monitoring',
    hue: 'red',
    port: 3001,
    blurb: 'Stream & sharing detection',
  },
  {
    id: 'portainer',
    name: 'Portainer',
    mono: 'PT',
    container: 'portainer',
    group: 'monitoring',
    hue: 'violet',
    port: 9000,
    blurb: 'Docker management UI',
  },
  {
    id: 'cadvisor',
    name: 'cAdvisor',
    mono: 'CA',
    container: 'cadvisor',
    group: 'monitoring',
    hue: 'green',
    port: 8080,
    blurb: 'Per-container metrics',
  },
  {
    id: 'node-exporter',
    name: 'node-exporter',
    mono: 'NE',
    container: 'node-exporter',
    group: 'monitoring',
    hue: 'green',
    port: 9100,
    blurb: 'Host metrics',
  },
  {
    id: 'telegraf',
    name: 'Telegraf',
    mono: 'TG',
    container: 'telegraf',
    group: 'monitoring',
    hue: 'cyan',
    port: null,
    blurb: 'Metrics collection agent',
  },

  // ============ SYSTEM (no UI; counted in health, hidden from nav) ============
  {
    id: 'watchtower',
    name: 'Watchtower',
    mono: 'WT',
    container: 'watchtower',
    group: 'system',
    hue: 'green',
    port: null,
    blurb: 'Automated container updates',
  },
  {
    id: 'timescale',
    name: 'TimescaleDB',
    mono: 'TS',
    container: 'tracearr-timescale',
    group: 'system',
    hue: 'cyan',
    port: null,
    blurb: 'Tracearr time-series database',
  },
  {
    id: 'redis',
    name: 'Redis',
    mono: 'RD',
    container: 'tracearr-redis',
    group: 'system',
    hue: 'red',
    port: null,
    blurb: 'Tracearr cache & queue',
  },
  // Named `autoplexx-*` rather than the bare `dashboard` / `docker-socket-proxy`:
  // both are generic enough to collide with a container a user already runs, and
  // a `container_name` collision fails `docker compose up` outright.
  {
    id: 'dashboard',
    name: 'Dashboard',
    mono: 'AP',
    container: 'autoplexx-dashboard',
    group: 'system',
    hue: 'violet',
    port: null,
    blurb: 'This dashboard',
  },
  {
    id: 'docker-socket-proxy',
    name: 'Socket Proxy',
    mono: 'SP',
    container: 'autoplexx-socket-proxy',
    group: 'system',
    hue: 'green',
    port: null,
    blurb: 'Read-only Docker API for the dashboard',
  },
];

/** Groups rendered in the sidebar and Launcher, in display order. */
export const VISIBLE_GROUPS = [
  { id: 'media', label: 'Media' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'monitoring', label: 'Monitoring' },
] as const satisfies readonly { id: ServiceGroup; label: string }[];

export function serviceByContainer(container: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.container === container);
}
