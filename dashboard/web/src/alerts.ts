/**
 * Derives the "what needs attention" list from data the app already polls.
 *
 * This is computed in the browser rather than served from the API because both
 * inputs are already on screen — /api/health drives the sidebar and the health
 * tile, /api/integrations drives Setup. A dedicated endpoint would poll the
 * same two sources again to produce something the client can assemble for free.
 */

import type { HealthReport, Integration, ServiceStatus } from './types';

export type AlertKind = 'unreachable' | 'attn' | 'down' | 'blocked';

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  /** One line naming what is actually wrong, or the step that fixes it. */
  detail: string;
  /** Set when the alert is about a service with a web UI, so it can be opened. */
  port?: number;
}

/**
 * Rendering order. A stack that can't be inspected at all outranks a single
 * unhealthy container, which outranks a stopped one (often deliberate), which
 * outranks an integration that only degrades one panel.
 */
const ORDER: Record<AlertKind, number> = {
  unreachable: 0,
  attn: 1,
  down: 2,
  blocked: 3,
};

export function deriveAlerts(
  health: HealthReport | null,
  integrations: Integration[],
): Alert[] {
  const alerts: Alert[] = [];

  // Without the socket proxy every service reports `absent`, which would
  // otherwise produce no alerts at all — the quietest possible rendering of the
  // loudest possible problem. Report the cause and stop: the per-service states
  // behind it aren't trustworthy.
  if (health && !health.reachable) {
    return [
      {
        id: 'docker-unreachable',
        kind: 'unreachable',
        title: 'Container state unavailable',
        detail:
          'The dashboard cannot reach docker-socket-proxy, so service status may be stale. Check that the autoplexx-socket-proxy container is running.',
      },
    ];
  }

  for (const service of health?.services ?? []) {
    // `absent` is not a fault. A user who trimmed services out of their compose
    // file would otherwise get a permanent list of alerts for things they chose
    // not to run.
    if (service.state === 'attn') {
      alerts.push(serviceAlert(service, 'attn', 'needs attention'));
    } else if (service.state === 'down') {
      alerts.push(serviceAlert(service, 'down', 'is stopped'));
    }
  }

  for (const integration of integrations) {
    // Only `blocked` — `waiting` is the normal state on a clean install, where
    // a service simply hasn't written its config file yet. Alerting on it would
    // mean a first boot opens with a full inbox that clears itself.
    if (integration.state !== 'blocked') continue;

    const service = health?.services.find((candidate) => candidate.id === integration.source);
    alerts.push({
      id: `integration:${integration.source}`,
      kind: 'blocked',
      title: `${service?.name ?? integration.source} is not connected`,
      detail: integration.hint ?? 'The dashboard could not read an API key for this service.',
      ...(service?.port != null ? { port: service.port } : {}),
    });
  }

  return alerts.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

function serviceAlert(service: ServiceStatus, kind: AlertKind, summary: string): Alert {
  return {
    id: `service:${service.id}`,
    kind,
    title: `${service.name} ${summary}`,
    // Docker's own status line is the most specific thing available here —
    // "Restarting (1) 4 seconds ago" says far more than "needs attention".
    detail: service.status ?? service.blurb,
    ...(service.port != null ? { port: service.port } : {}),
  };
}
