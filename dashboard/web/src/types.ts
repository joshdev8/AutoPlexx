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
