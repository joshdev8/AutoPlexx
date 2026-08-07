/** Mirrors the server's `services.ts` / `sources/docker.ts` response shapes. */

export type Hue = 'green' | 'amber' | 'red' | 'cyan' | 'violet';
export type ServiceGroup = 'media' | 'downloads' | 'monitoring' | 'system';
export type ServiceState = 'up' | 'attn' | 'down' | 'starting' | 'absent';

export interface Service {
  id: string;
  name: string;
  mono: string;
  container: string;
  group: ServiceGroup;
  hue: Hue;
  port: number | null;
  blurb: string;
  /** Compose may legitimately not define this service — see `launchUrl`. */
  optional?: boolean;
}

export interface ServiceStatus extends Service {
  state: ServiceState;
  status: string | null;
}

export interface HealthReport {
  services: ServiceStatus[];
  up: number;
  total: number;
  attention: string[];
  reachable: boolean;
}

export const HUE_VAR: Record<Hue, string> = {
  green: 'var(--ap-green)',
  amber: 'var(--ap-amber)',
  red: 'var(--ap-red)',
  cyan: 'var(--ap-cyan)',
  violet: 'var(--ap-violet)',
};

/** Dot color per state. `down`/`absent` are drawn as rings in CSS. */
export const STATE_COLOR: Record<ServiceState, string> = {
  up: 'var(--ap-green)',
  attn: 'var(--ap-amber)',
  starting: 'var(--ap-cyan)',
  down: 'transparent',
  absent: 'transparent',
};

export const STATE_LABEL: Record<ServiceState, string> = {
  up: 'Running',
  attn: 'Needs attention',
  starting: 'Starting',
  down: 'Stopped',
  absent: 'Not installed',
};

/**
 * Services are published on the host, so links are built against whatever
 * hostname the dashboard itself was loaded from — this stack is reached by bare
 * IP at least as often as by name.
 */
export function serviceUrl(port: number): string {
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * Where a service's web UI can be opened, or `null` when there's nothing to
 * open. Two reasons for `null`, and both must be honoured everywhere a link is
 * drawn:
 *
 *  - the service publishes no UI port (Watchtower, the socket proxy);
 *  - an `optional` service isn't installed. Only services flagged `optional` in
 *    the catalog — the two halves of the Plex/Jellyfin swap — are suppressed
 *    this way, because for them `absent` is a choice the user made and the port
 *    leads nowhere.
 *
 * Everything else keeps its link even when absent. A catalog entry can go
 * `absent` merely because the container was renamed, and silently removing a
 * working link would hide that rather than surface it.
 *
 * `down` deliberately still yields a URL: the container exists and the user may
 * be about to start it.
 *
 * `stateKnown` is the report's `reachable` flag, and it matters more than it
 * looks. When the socket proxy can't be reached on a cold start the server has
 * no last-good report to fall back on, so it reports *every* service as
 * `absent` (see `buildReport` in `sources/docker.ts`). Suppressing on `absent`
 * alone would strip every link in the UI at exactly the moment a user most
 * needs the launcher — a dead upstream blanking the page, which this app
 * doesn't do. So `absent` only means "not installed" when we actually reached
 * Docker; otherwise it means "don't know", and a link is better than no link.
 */
export function launchUrl(
  service: Pick<ServiceStatus, 'port' | 'state' | 'optional'>,
  stateKnown = true,
): string | null {
  if (service.port === null) return null;
  if (service.optional && service.state === 'absent' && stateKnown) return null;
  return serviceUrl(service.port);
}

// ---- Widget payloads (mirrors the server's source modules) ------------------

/**
 * Every widget endpoint returns either data or a reason it can't. The
 * discriminant lets each panel render its own empty state without any of them
 * being able to fail the page.
 */
export type Result<T> = (T & { available: true }) | { available: false; reason: string; hint?: string };

export interface Gauge {
  id: 'cpu' | 'memory' | 'storage' | 'network';
  label: string;
  value: string;
  sub: string;
  fraction: number | null;
}

export type StreamMode = 'Direct Play' | 'Direct Stream' | 'Transcode';

export interface Stream {
  title: string;
  meta: string;
  mono: string;
  /** Dashboard-relative poster URL, or null when there's no artwork to show. */
  poster: string | null;
  user: string;
  quality: string;
  mode: StreamMode;
  device: string;
  player: string;
  bandwidth: string;
  percent: number;
  elapsed: string;
  total: string;
}

export interface Download {
  label: string;
  source: 'SONARR' | 'RADARR' | 'OTHER';
  /** Dashboard-relative poster URL, or null when there's no artwork to show. */
  poster: string | null;
  percent: number;
  speed: string;
  eta: string;
}

export interface RequestItem {
  title: string;
  poster: string | null;
  kind: 'Movie' | 'Series';
  user: string;
  when: string;
  status: 'Pending' | 'Approved' | 'Declined' | 'Downloading' | 'Available';
}

export interface UpcomingItem {
  seriesTitle: string;
  poster: string | null;
  code: string;
  title: string;
  network: string;
  airDate: string;
  status: 'downloaded' | 'airing' | 'missing';
  day: number;
  month: string;
}

export interface ActivityItem {
  kind: 'grab' | 'download' | 'upgrade' | 'other';
  text: string;
  at: string;
}

export interface VpnStatus {
  provider: string;
  server: string;
  connected: boolean;
}

export interface Integration {
  source: string;
  state: 'live' | 'waiting' | 'blocked';
  origin: 'env' | 'discovered' | 'none';
  hint: string | null;
}

/** Stream mode hues, matching the prototype's `modeHue` logic. */
export const MODE_HUE: Record<StreamMode, string> = {
  Transcode: 'var(--ap-amber)',
  'Direct Stream': 'var(--ap-cyan)',
  'Direct Play': 'var(--ap-green)',
};

export const REQUEST_HUE: Record<RequestItem['status'], string> = {
  Pending: 'var(--ap-amber)',
  Approved: 'var(--ap-cyan)',
  Downloading: 'var(--ap-green)',
  Available: 'var(--ap-cyan)',
  Declined: 'var(--ap-red)',
};

export const UPCOMING_HUE: Record<UpcomingItem['status'], string> = {
  downloaded: 'var(--ap-cyan)',
  airing: 'var(--ap-amber)',
  missing: 'var(--color-neutral-500)',
};
