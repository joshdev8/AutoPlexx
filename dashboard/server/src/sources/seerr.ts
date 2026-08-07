import { config } from '../config.js';
import { memoize } from '../cache.js';
import { credentialFor } from '../discovery.js';
import { getJson, safely, unavailable, upstreamHint, type Result } from '../http.js';
import { tmdbPoster } from './posters.js';

/** Content requests, from Seerr. */

/** Seerr's numeric request status codes. */
const STATUS: Record<number, RequestItem['status']> = {
  1: 'Pending',
  2: 'Approved',
  3: 'Declined',
};

/** Media availability, used to promote an approved request to "Downloading". */
const MEDIA_AVAILABLE = 5;
const MEDIA_PARTIALLY_AVAILABLE = 4;
const MEDIA_PROCESSING = 3;

interface SeerrRequest {
  id?: number;
  status?: number;
  type?: string;
  createdAt?: string;
  requestedBy?: { displayName?: string; username?: string; plexUsername?: string };
  media?: { status?: number; tmdbId?: number };
}

interface SeerrPage {
  pageInfo?: { results?: number };
  results?: SeerrRequest[];
}

export interface RequestItem {
  title: string;
  /** Dashboard-relative poster URL, or null when there's nothing to show. */
  poster: string | null;
  kind: 'Movie' | 'Series';
  user: string;
  when: string;
  status: 'Pending' | 'Approved' | 'Declined' | 'Downloading' | 'Available';
}

interface SeerrMediaDetails {
  title?: string;
  name?: string;
  /** TMDb path, e.g. `/u4YZhMms48mgP756hniUcw6PQPU.jpg`. */
  posterPath?: string;
}

export interface RequestsPayload {
  requests: RequestItem[];
  pending: number;
}

/** "2h ago" / "Yesterday" / a date, matching the design's relative phrasing. */
function relative(iso: string | undefined, now: Date): string {
  if (!iso) return '';
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

function statusOf(request: SeerrRequest): RequestItem['status'] {
  const mediaStatus = request.media?.status;
  // An approved request whose media is already processing reads better as
  // "Downloading" — that's what the user actually wants to know.
  if (request.status === 2) {
    if (mediaStatus === MEDIA_AVAILABLE) return 'Available';
    if (mediaStatus === MEDIA_PARTIALLY_AVAILABLE || mediaStatus === MEDIA_PROCESSING) {
      return 'Downloading';
    }
  }
  return STATUS[request.status ?? 0] ?? 'Pending';
}

interface Described {
  title: string;
  poster: string | null;
}

const UNKNOWN: Described = { title: 'Unknown title', poster: null };

/**
 * Title and artwork for a request, from the one detail call.
 *
 * The poster comes back on the same response as the title, so artwork costs no
 * extra request. Unlike every other source here the path resolves against
 * TMDb rather than something in the stack — Seerr keeps no local copy, and its
 * `/imageproxy/` is not present on every build. A request no *arr has picked up
 * yet has no other source of art, so this is the trade; it degrades to the
 * placeholder when there's no route out.
 */
async function describe(request: SeerrRequest, apiKey: string): Promise<Described> {
  const tmdbId = request.media?.tmdbId;
  if (!tmdbId) return UNKNOWN;

  const kind = request.type === 'tv' ? 'tv' : 'movie';
  try {
    const details = await getJson<SeerrMediaDetails>(
      `${config.upstream.seerr}/api/v1/${kind}/${tmdbId}`,
      { 'X-Api-Key': apiKey },
    );
    return {
      title: details.title || details.name || 'Unknown title',
      poster: tmdbPoster(details.posterPath),
    };
  } catch {
    // Detail lookup goes out to TMDb via Seerr and can fail independently of
    // the request list; a missing title shouldn't drop the row.
    return UNKNOWN;
  }
}

/**
 * The number of outstanding requests, from its own filtered query.
 *
 * Counting the `Pending` rows in the list below would cap the total at the page
 * size, so a household with more than eight open requests — or with old ones
 * still waiting behind newer arrivals — would see a count that quietly
 * understates. `take=1` because only `pageInfo.results` is wanted; the row
 * itself is discarded.
 */
async function pendingCount(apiKey: string, fallback: number): Promise<number> {
  try {
    const page = await getJson<SeerrPage>(
      `${config.upstream.seerr}/api/v1/request?filter=pending&take=1&skip=0`,
      { 'X-Api-Key': apiKey },
    );
    // `getJson` types the body but can't vouch for it, so a malformed count —
    // a string, a negative, a NaN — falls back rather than reaching the panel.
    const results = page.pageInfo?.results;
    if (typeof results !== 'number' || !Number.isFinite(results) || results < 0) return fallback;
    return results;
  } catch {
    // The list already loaded successfully; a failed count shouldn't cost the
    // panel its rows, so fall back to what the visible page can prove.
    return fallback;
  }
}

async function load(): Promise<RequestsPayload> {
  const credential = await credentialFor('seerr');
  if (!credential.apiKey) throw new Error(credential.hint ?? 'Seerr API key not found yet');

  const page = await getJson<SeerrPage>(
    `${config.upstream.seerr}/api/v1/request?take=8&skip=0&sort=added`,
    { 'X-Api-Key': credential.apiKey },
  );

  const now = new Date();
  const results = page.results ?? [];

  const requests = await Promise.all(
    results.map(async (request): Promise<RequestItem> => ({
      ...(await describe(request, credential.apiKey!)),
      kind: request.type === 'tv' ? 'Series' : 'Movie',
      user:
        request.requestedBy?.displayName ||
        request.requestedBy?.plexUsername ||
        request.requestedBy?.username ||
        'Unknown',
      when: relative(request.createdAt, now),
      status: statusOf(request),
    })),
  );

  return {
    requests,
    pending: await pendingCount(
      credential.apiKey,
      requests.filter((r) => r.status === 'Pending').length,
    ),
  };
}

export const getRequests = memoize<Result<RequestsPayload>>(async () => {
  const credential = await credentialFor('seerr');
  if (credential.state !== 'live') {
    return unavailable('Waiting for Seerr', credential.hint ?? undefined);
  }
  return safely(load, upstreamHint({ name: 'Seerr', urlVar: 'SEERR_URL' }));
}, config.ttl.requests);

export const __test = { relative, statusOf, pendingCount, describe };
