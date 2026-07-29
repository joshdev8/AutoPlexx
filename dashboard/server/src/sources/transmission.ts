import { config } from '../config.js';
import { memoize } from '../cache.js';
import { safely, type Result } from '../http.js';
import { queue, type QueueRecord } from './arr.js';
import { arrPoster } from './posters.js';

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
  /** That *arr's cached cover, or null when nothing matched. */
  poster: string | null;
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

/** What a queue match tells us about a torrent: who grabbed it, and its art. */
interface Attribution {
  source: Download['source'];
  poster: string | null;
}

const UNATTRIBUTED: Attribution = { source: 'OTHER', poster: null };

/**
 * Labels a torrent with the *arr that grabbed it, and its artwork.
 *
 * The queues carry the release title, which is what Transmission names the
 * torrent, so an exact match works for the common case. Falls back to OTHER
 * rather than guessing — a wrong attribution is worse than none, and that
 * applies to the poster just as much as the tag.
 *
 * A torrent no *arr is tracking — an old manual grab, or one whose queue entry
 * has since been removed — matches nothing and keeps its placeholder. That is a
 * correct answer, not a missing one.
 */
function attribute(name: string, index: Map<string, Attribution>): Attribution {
  return index.get(name) ?? UNATTRIBUTED;
}

/**
 * Indexes both queues by release title. Sonarr is inserted first so that if the
 * same title somehow appears in both, the series wins over the movie — the
 * previous ordering, preserved.
 */
function indexQueues(sonarr: QueueRecord[], radarr: QueueRecord[]): Map<string, Attribution> {
  const index = new Map<string, Attribution>();

  for (const record of radarr) {
    if (record.title) index.set(record.title, { source: 'RADARR', poster: arrPoster('radarr', record.movieId) });
  }
  for (const record of sonarr) {
    if (record.title) index.set(record.title, { source: 'SONARR', poster: arrPoster('sonarr', record.seriesId) });
  }

  return index;
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

  const index = indexQueues(sonarrQueue, radarrQueue);

  const torrents = response.arguments?.torrents ?? [];
  // Status 4 is "downloading"; anything complete or seeding isn't interesting
  // on a dashboard that answers "what's in flight".
  const active = torrents.filter((t) => t.status === 4 && !t.isFinished);

  const downloads: Download[] = active
    .map((torrent) => {
      const name = torrent.name ?? 'Unknown';
      const { source, poster } = attribute(name, index);
      return {
        label: name,
        source,
        poster,
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

export const __test = { formatSpeed, formatEta, attribute, indexQueues, hintFor };
