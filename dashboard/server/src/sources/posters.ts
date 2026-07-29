import { config } from '../config.js';
import { credentialFor } from '../discovery.js';
import type { ArrId } from './arr.js';

/**
 * Poster artwork, from whichever service already holds it.
 *
 * Four upstreams supply art and none of them can be reached from the browser:
 * three sit behind API keys that must not leave the server, and the fourth is
 * off-box. So every poster is addressed as `/api/poster?src=…&ref=…` and this
 * module is the only place that knows how to turn that into bytes.
 *
 * `ref` is produced here, travels to the browser, and comes back — so each
 * source re-validates it on the way in rather than trusting it because we
 * emitted it. That check is the trust boundary; without it the route would be a
 * general-purpose proxy wearing a dashboard's clothes.
 */

export type PosterSource = 'plex' | 'sonarr' | 'radarr' | 'tmdb';

/** Plex addresses art by metadata path; the trailing number changes when art does. */
const PLEX_IMAGE_PATH = /^\/library\/metadata\/\d+\/(?:thumb|art|poster)\/\d+$/;
/** TMDb paths are a single opaque filename — no directories, so no traversal. */
const TMDB_IMAGE_PATH = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;
/** Servarr covers are addressed by the numeric id of the series or movie. */
const ARR_ID = /^[1-9]\d{0,9}$/;

/**
 * Total by construction: an unrecognised source is refused rather than falling
 * off the end. The type says that can't happen, but this is a security check
 * reached from a query string, so it does not lean on the type to be safe.
 */
function isValidRef(source: PosterSource, ref: string): boolean {
  switch (source) {
    case 'plex':
      return PLEX_IMAGE_PATH.test(ref);
    case 'tmdb':
      return TMDB_IMAGE_PATH.test(ref);
    case 'sonarr':
    case 'radarr':
      return ARR_ID.test(ref);
    default:
      return false;
  }
}

function url(source: PosterSource, ref: string | undefined | null): string | null {
  if (!ref || !isValidRef(source, ref)) return null;
  return `/api/poster?src=${source}&ref=${encodeURIComponent(ref)}`;
}

/** A Plex image path, as `get_activity` reports it. */
export const plexPoster = (path: string | undefined): string | null => url('plex', path);

/** A Sonarr series or Radarr movie, by its numeric id. */
export const arrPoster = (arr: ArrId, id: number | undefined): string | null =>
  id === undefined ? null : url(arr, String(id));

/** A TMDb poster path, as Seerr reports it. */
export const tmdbPoster = (path: string | undefined): string | null => url('tmdb', path);

export interface PosterImage {
  body: Buffer;
  contentType: string;
}

/**
 * One fetch, shared by every source. Returns null rather than throwing for
 * every failure mode — the caller turns that into a 404 and the tile falls back
 * to its monogram, which is also what it shows before an image loads.
 */
async function fetchImage(target: string, headers: Record<string, string> = {}): Promise<PosterImage | null> {
  try {
    const response = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(config.upstreamTimeoutMs),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    // Tautulli answers a bad key with a 200 JSON envelope, and the *arrs will
    // hand back an HTML error page, so the content type is the only reliable
    // way to tell an image from a polite refusal.
    if (!contentType.startsWith('image/')) return null;

    return { body: Buffer.from(await response.arrayBuffer()), contentType };
  } catch {
    return null;
  }
}

/** Plex art, read through Tautulli so it stays on the LAN. */
async function fromPlex(ref: string): Promise<PosterImage | null> {
  const credential = await credentialFor('tautulli');
  if (credential.state !== 'live' || !credential.apiKey) return null;

  return fetchImage(
    `${config.upstream.tautulli}/api/v2` +
      `?apikey=${encodeURIComponent(credential.apiKey)}` +
      `&cmd=pms_image_proxy&img=${encodeURIComponent(ref)}` +
      `&width=300&height=450&fallback=poster`,
  );
}

/**
 * A Servarr's own cached cover. The `images` array on these APIs only carries
 * `remoteUrl` pointing at thetvdb/tmdb, but each *arr also keeps a local copy
 * and serves it from `mediacover` — which is what keeps this offline-safe.
 */
async function fromArr(arr: ArrId, ref: string): Promise<PosterImage | null> {
  const credential = await credentialFor(arr);
  if (credential.state !== 'live' || !credential.apiKey) return null;

  const base = config.upstream[arr].replace(/\/$/, '');
  const urlBase = credential.urlBase.replace(/\/$/, '');
  return fetchImage(`${base}${urlBase}/api/v3/mediacover/${ref}/poster.jpg`, {
    'X-Api-Key': credential.apiKey,
  });
}

/**
 * TMDb, for requests that no *arr has picked up yet.
 *
 * This is the one source that needs outbound internet, which the rest of the
 * stack deliberately avoids. It is confined to the Requests panel and fails to
 * the placeholder, so an install with no route out sees exactly the behaviour
 * it had before rather than an error.
 */
async function fromTmdb(ref: string): Promise<PosterImage | null> {
  return fetchImage(`${config.tmdbImageBase}/w342${ref}`);
}

export async function getPoster(source: string, ref: string): Promise<PosterImage | null> {
  if (source !== 'plex' && source !== 'sonarr' && source !== 'radarr' && source !== 'tmdb') {
    return null;
  }
  if (!isValidRef(source, ref)) return null;

  switch (source) {
    case 'plex':
      return fromPlex(ref);
    case 'sonarr':
    case 'radarr':
      return fromArr(source, ref);
    case 'tmdb':
      return fromTmdb(ref);
  }
}

export const __test = { isValidRef, url };
