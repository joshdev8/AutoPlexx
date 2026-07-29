import { config } from '../config.js';
import { memoize } from '../cache.js';
import { credentialFor } from '../discovery.js';
import { getJson, safely, unavailable, type Result } from '../http.js';

/** Now Playing, from Tautulli's `get_activity` command. */

interface TautulliSession {
  title?: string;
  grandparent_title?: string;
  parent_media_index?: string;
  media_index?: string;
  year?: string;
  media_type?: string;
  friendly_name?: string;
  user?: string;
  video_full_resolution?: string;
  quality_profile?: string;
  transcode_decision?: string;
  player?: string;
  platform?: string;
  bandwidth?: string;
  progress_percent?: string;
  view_offset?: string;
  duration?: string;
  /** Plex image path for this item, e.g. `/library/metadata/130222/thumb/1785273308`. */
  thumb?: string;
  /** The show's poster, which is what an episode should display. */
  grandparent_thumb?: string;
}

interface TautulliActivity {
  response?: {
    result?: string;
    message?: string | null;
    data?: { sessions?: TautulliSession[]; stream_count?: string; total_bandwidth?: string };
  };
}

export type StreamMode = 'Direct Play' | 'Direct Stream' | 'Transcode';

export interface Stream {
  title: string;
  meta: string;
  mono: string;
  /**
   * Dashboard-relative URL for the poster, or null when Plex didn't supply a
   * usable path. Always points at this server's own `/api/poster` rather than
   * at Tautulli: the browser may have no route to Tautulli, and the API key
   * must not leave the server. `mono` stays the fallback either way.
   */
  poster: string | null;
  user: string;
  quality: string;
  mode: StreamMode;
  device: string;
  player: string;
  bandwidth: string;
  /** 0-100 */
  percent: number;
  elapsed: string;
  total: string;
}

export interface StreamsPayload {
  streams: Stream[];
  count: number;
  /** Total bandwidth across sessions, pre-formatted. */
  bandwidth: string;
  transcodes: number;
}

/** Tautulli reports ms; the design shows h:mm:ss. */
function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function mode(decision: string | undefined): StreamMode {
  if (decision === 'transcode') return 'Transcode';
  if (decision === 'copy') return 'Direct Stream';
  return 'Direct Play';
}

/** A short monogram for the poster placeholder, e.g. "The Bear" -> "BEAR". */
function monogram(title: string): string {
  const words = title.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0]!.slice(0, 4).toUpperCase();
  return words
    .map((w) => w[0]!)
    .join('')
    .slice(0, 4)
    .toUpperCase();
}

/**
 * The shape Plex uses for image paths. Anything else is refused.
 *
 * This is the whole of the trust boundary for `/api/poster`: the value arrives
 * from Tautulli, round-trips through the browser, and is then handed back to
 * Tautulli, so it has to be re-checked on the way in rather than trusted
 * because we emitted it. Constraining it to a literal metadata path keeps the
 * route from being usable as a general-purpose proxy.
 */
const PLEX_IMAGE_PATH = /^\/library\/metadata\/\d+\/(?:thumb|art|poster)\/\d+$/;

export function isPlexImagePath(value: string): boolean {
  return PLEX_IMAGE_PATH.test(value);
}

/** Wraps a Plex image path as a URL this server will proxy, or null if unusable. */
function posterUrl(path: string | undefined): string | null {
  if (!path || !isPlexImagePath(path)) return null;
  return `/api/poster?img=${encodeURIComponent(path)}`;
}

function toStream(session: TautulliSession): Stream {
  const isEpisode = session.media_type === 'episode';
  const title = (isEpisode ? session.grandparent_title : session.title) ?? 'Unknown';

  // Episodes read better as SxxEyy; movies as a year.
  const season = session.parent_media_index?.padStart(2, '0');
  const episode = session.media_index?.padStart(2, '0');
  const meta = isEpisode && season && episode ? `S${season}E${episode}` : (session.year ?? '');

  const offset = Number(session.view_offset ?? 0);
  const total = Number(session.duration ?? 0);
  const percent = Number(session.progress_percent ?? 0);
  const bandwidthKbps = Number(session.bandwidth ?? 0);

  return {
    title,
    meta,
    mono: monogram(title),
    // An episode's own thumb is the episode still; the show's poster is what
    // the design's poster tile wants.
    poster: posterUrl(isEpisode ? session.grandparent_thumb : session.thumb),
    user: session.friendly_name || session.user || 'Unknown',
    quality: session.video_full_resolution || session.quality_profile || '',
    mode: mode(session.transcode_decision),
    device: session.platform ?? '',
    player: session.player ?? '',
    bandwidth: bandwidthKbps > 0 ? `${(bandwidthKbps / 1000).toFixed(1)} Mbps` : '',
    percent: Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0,
    elapsed: duration(offset),
    total: duration(total),
  };
}

async function load(): Promise<StreamsPayload> {
  const credential = await credentialFor('tautulli');
  if (!credential.apiKey) {
    throw new Error(credential.hint ?? 'Tautulli API key not found yet');
  }

  const url = `${config.upstream.tautulli}/api/v2?apikey=${encodeURIComponent(credential.apiKey)}&cmd=get_activity`;
  const body = await getJson<TautulliActivity>(url);

  // Tautulli answers 200 with result:"error" for a bad key, so the envelope has
  // to be checked rather than trusting the status code.
  if (body.response?.result !== 'success') {
    throw new Error(body.response?.message || 'Tautulli rejected the request');
  }

  const sessions = body.response.data?.sessions ?? [];
  const streams = sessions.map(toStream);
  const totalKbps = Number(body.response.data?.total_bandwidth ?? 0);

  return {
    streams,
    count: streams.length,
    bandwidth: totalKbps > 0 ? `${(totalKbps / 1000).toFixed(1)} Mbps` : '0 Mbps',
    transcodes: streams.filter((s) => s.mode === 'Transcode').length,
  };
}

export const getStreams = memoize<Result<StreamsPayload>>(async () => {
  const credential = await credentialFor('tautulli');
  if (credential.state !== 'live') {
    return unavailable(
      credential.state === 'blocked' ? 'Tautulli API disabled' : 'Waiting for Tautulli',
      credential.hint ?? undefined,
    );
  }
  return safely(load);
}, config.ttl.streams);

export interface PosterImage {
  body: Buffer;
  contentType: string;
}

/**
 * Fetches one poster through Tautulli's `pms_image_proxy`, which reads it from
 * Plex — so artwork never requires outbound internet, matching the rest of the
 * stack's self-hosted assumption.
 *
 * Returns null rather than throwing for every failure mode, because the caller
 * turns that into a 404 and the UI falls back to the monogram tile. A missing
 * poster must never be louder than that.
 */
export async function getPoster(path: string): Promise<PosterImage | null> {
  if (!isPlexImagePath(path)) return null;

  const credential = await credentialFor('tautulli');
  if (credential.state !== 'live' || !credential.apiKey) return null;

  const url =
    `${config.upstream.tautulli}/api/v2` +
    `?apikey=${encodeURIComponent(credential.apiKey)}` +
    `&cmd=pms_image_proxy` +
    `&img=${encodeURIComponent(path)}` +
    `&width=300&height=450&fallback=poster`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(config.upstreamTimeoutMs) });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    // Tautulli answers a bad key with a 200 JSON envelope, so the content type
    // is the only thing that distinguishes an image from an error.
    if (!contentType.startsWith('image/')) return null;

    return { body: Buffer.from(await response.arrayBuffer()), contentType };
  } catch {
    return null;
  }
}

export const __test = { duration, mode, monogram, toStream, posterUrl, isPlexImagePath };
