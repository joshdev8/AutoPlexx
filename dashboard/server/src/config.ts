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

/**
 * Ports need tighter validation than a generic positive number: a fractional
 * value stops Fastify binding, and anything above 65535 silently produces a
 * launcher link that can never resolve. Fall back rather than fail — a typo in
 * `.env` should not stop the dashboard starting.
 */
function port(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

export const config = {
  /** Port the dashboard itself listens on inside the container. */
  port: port(process.env.DASHBOARD_PORT, 8090),
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
  grafanaPort: port(process.env.GRAFANA_PORT, 3000),

  /** How long container state is cached, in ms. Keeps polling off the proxy. */
  healthTtlMs: num(process.env.HEALTH_TTL_MS, 5_000),

  /**
   * Upstream base URLs. The defaults are the Compose service names, which is
   * what they resolve to inside this stack; each is overridable for anyone
   * running a service elsewhere.
   */
  upstream: {
    sonarr: process.env.SONARR_URL ?? 'http://sonarr:8989',
    radarr: process.env.RADARR_URL ?? 'http://radarr:7878',
    prowlarr: process.env.PROWLARR_URL ?? 'http://prowlarr:9696',
    bazarr: process.env.BAZARR_URL ?? 'http://bazarr:6767',
    tautulli: process.env.TAUTULLI_URL ?? 'http://tautulli:8181',
    seerr: process.env.SEERR_URL ?? 'http://seerr:5055',
    prometheus: process.env.PROMETHEUS_URL ?? 'http://prometheus:9090',
    transmission: process.env.TRANSMISSION_URL ?? 'http://transmission:9091',
  },

  /** Optional Transmission RPC auth, mirroring the stack's existing .env vars. */
  transmissionAuth: {
    username: process.env.TRANSMISSION_RPC_USERNAME ?? '',
    password: process.env.TRANSMISSION_RPC_PASSWORD ?? '',
  },

  /**
   * VPN details are read from the same variables Transmission itself uses, so
   * there is nothing extra to configure for the VPN card.
   */
  vpn: {
    provider: process.env.OPENVPN_PROVIDER ?? '',
    server: process.env.OPENVPN_CONFIG ?? '',
  },

  /** Cache TTLs per widget class, in ms. */
  ttl: {
    /** Streams change second to second; the shortest useful cache. */
    streams: num(process.env.STREAMS_TTL_MS, 5_000),
    downloads: num(process.env.DOWNLOADS_TTL_MS, 5_000),
    metrics: num(process.env.METRICS_TTL_MS, 10_000),
    /** Requests and the calendar move slowly; cache them harder. */
    requests: num(process.env.REQUESTS_TTL_MS, 30_000),
    calendar: num(process.env.CALENDAR_TTL_MS, 60_000),
    activity: num(process.env.ACTIVITY_TTL_MS, 30_000),
  },

  /** Upstream request timeout. Beyond this a widget degrades rather than hangs. */
  upstreamTimeoutMs: num(process.env.UPSTREAM_TIMEOUT_MS, 6_000),
} as const;
