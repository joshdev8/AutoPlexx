/**
 * Environment parsing. Every value here has a working default — the dashboard
 * must start and be useful against a completely unconfigured `.env`, because
 * AutoPlexx is a public repo people clone and run. Nothing in this file may
 * throw on a missing variable.
 */

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  /** Port the dashboard itself listens on inside the container. */
  port: num(process.env.DASHBOARD_PORT, 8090),
  host: process.env.DASHBOARD_HOST ?? '0.0.0.0',

  /**
   * docker-socket-proxy base URL. The proxy is locked to CONTAINERS=1, so the
   * dashboard can read container state but cannot act on it — deliberately
   * avoiding a second root-equivalent socket mount alongside Portainer's.
   */
  dockerProxyUrl: process.env.DOCKER_PROXY_URL ?? 'http://docker-socket-proxy:2375',

  /**
   * Grafana's host port is user-configurable via GRAFANA_PORT, so the Launcher
   * link has to follow it rather than assume 3000.
   */
  grafanaPort: num(process.env.GRAFANA_PORT, 3000),

  /** How long container state is cached, in ms. Keeps polling off the proxy. */
  healthTtlMs: num(process.env.HEALTH_TTL_MS, 5_000),
} as const;
