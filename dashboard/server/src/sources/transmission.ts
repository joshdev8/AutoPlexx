import { config } from '../config.js';
import { memoize } from '../cache.js';
import { safely, type Result } from '../http.js';
import { queue, type QueueRecord } from './arr.js';

/**
 * Active downloads, from Transmission's RPC endpoint.
 *
 * Transmission requires a CSRF handshake: the first call returns 409 with an
 * `X-Transmission-Session-Id` header that must be echoed on the retry. The
 * token stays valid until the daemon restarts, so it's cached and only
 * re-fetched on the next 409.
 */

const RPC_PATH = '/transmission/rpc';

let sessionId: string | null = null;

interface TorrentFields {
  name?: string;
  percentDone?: number;
  rateDownload?: number;
  eta?: number;
  status?: number;
  isFinished?: boolean;
}

interface RpcResponse {
  result?: string;
  arguments?: { torrents?: TorrentFields[] };
}

export interface Download {
  label: string;
  /** Which *arr grabbed it, when it can be matched. */
  source: 'SONARR' | 'RADARR' | 'OTHER';
  /** 0-100 */
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadsPayload {
  downloads: Download[];
  active: number;
}

function authHeader(): Record<string, string> {
  const { username, password } = config.transmissionAuth;
  if (!username && !password) return {};
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return { authorization: `Basic ${encoded}` };
}

async function rpc(body: unknown, retryOn409 = true): Promise<RpcResponse> {
  const response = await fetch(`${config.upstream.transmission}${RPC_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(sessionId ? { 'X-Transmission-Session-Id': sessionId } : {}),
      ...authHeader(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.upstreamTimeoutMs),
  });

  if (response.status === 409 && retryOn409) {
    const token = response.headers.get('x-transmission-session-id');
    if (!token) throw new Error('Transmission returned 409 without a session id');
    sessionId = token;
    // One retry only — a second 409 means something other than a stale token.
    return rpc(body, false);
  }

  if (response.status === 401) {
    throw new Error('Transmission rejected the RPC credentials');
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const parsed = (await response.json()) as RpcResponse;
  if (parsed.result !== 'success') {
    throw new Error(parsed.result || 'Transmission RPC error');
  }
  return parsed;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '0 MB/s';
  const mb = bytesPerSecond / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${Math.round(bytesPerSecond / 1000)} KB/s`;
}

function formatEta(seconds: number | undefined): string {
  // Transmission uses negative values for "unknown" and "not downloading".
  if (seconds === undefined || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Labels a torrent with the *arr that grabbed it.
 *
 * The queues carry the release title, which is what Transmission names the
 * torrent, so an exact match works for the common case. Falls back to OTHER
 * rather than guessing — a wrong attribution is worse than none.
 */
function attribute(
  name: string,
  sonarrTitles: Set<string>,
  radarrTitles: Set<string>,
): Download['source'] {
  if (sonarrTitles.has(name)) return 'SONARR';
  if (radarrTitles.has(name)) return 'RADARR';
  return 'OTHER';
}

function titleSet(records: QueueRecord[]): Set<string> {
  return new Set(records.map((r) => r.title).filter((t): t is string => Boolean(t)));
}

async function load(): Promise<DownloadsPayload> {
  // The *arr queues are a nice-to-have for labelling; if either is unavailable
  // the downloads still render, just without a source tag.
  const [response, sonarrQueue, radarrQueue] = await Promise.all([
    rpc({
      method: 'torrent-get',
      arguments: {
        fields: ['name', 'percentDone', 'rateDownload', 'eta', 'status', 'isFinished'],
      },
    }),
    queue('sonarr').catch(() => [] as QueueRecord[]),
    queue('radarr').catch(() => [] as QueueRecord[]),
  ]);

  const sonarrTitles = titleSet(sonarrQueue);
  const radarrTitles = titleSet(radarrQueue);

  const torrents = response.arguments?.torrents ?? [];
  // Status 4 is "downloading"; anything complete or seeding isn't interesting
  // on a dashboard that answers "what's in flight".
  const active = torrents.filter((t) => t.status === 4 && !t.isFinished);

  const downloads: Download[] = active
    .map((torrent) => {
      const name = torrent.name ?? 'Unknown';
      return {
        label: name,
        source: attribute(name, sonarrTitles, radarrTitles),
        percent: Math.round((torrent.percentDone ?? 0) * 100),
        speed: formatSpeed(torrent.rateDownload ?? 0),
        eta: formatEta(torrent.eta),
      };
    })
    // Closest to done first — that's the one the user is waiting on.
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  return { downloads, active: active.length };
}

/**
 * Picks the next step that actually matches the failure. A rejected credential
 * and an unreachable host need completely different fixes, and a generic hint
 * sends people looking in the wrong place.
 */
function hintFor(reason: string): string {
  if (reason.includes('credentials')) {
    return 'Set TRANSMISSION_RPC_USERNAME and TRANSMISSION_RPC_PASSWORD in .env to match Transmission.';
  }
  if (reason.includes('refused') || reason.includes('not found') || reason.includes('timed out')) {
    return 'Transmission runs behind the VPN; check LOCAL_NETWORK in .env covers your subnet.';
  }
  return 'Check the Transmission container logs.';
}

export const getDownloads = memoize<Result<DownloadsPayload>>(async () => {
  const result = await safely(load);
  return result.available ? result : { ...result, hint: hintFor(result.reason) };
}, config.ttl.downloads);

export interface VpnStatus {
  provider: string;
  server: string;
  /** True when Transmission answered RPC — proof the tunnelled container works. */
  connected: boolean;
}

/**
 * VPN card. The design mocked provider/region/latency; provider and server come
 * from the same variables Transmission itself uses, so there is nothing extra
 * to configure. Latency isn't knowable from outside the container, so it isn't
 * shown rather than being invented.
 */
export const getVpn = memoize<Result<VpnStatus>>(
  () =>
    safely(async () => {
      // Reachability is the signal here, so an RPC failure is an answer rather
      // than an error — the card still renders, just not as secured.
      const connected = await rpc({ method: 'session-get' }).then(
        () => true,
        () => false,
      );
      return {
        provider: config.vpn.provider.toUpperCase(),
        server: config.vpn.server.toUpperCase(),
        connected,
      };
    }),
  config.ttl.downloads,
);

export const __test = { formatSpeed, formatEta, attribute, hintFor };
