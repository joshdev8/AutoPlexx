import { config } from '../config.js';
import { credentialFor, type SourceId } from '../discovery.js';
import { getJson } from '../http.js';
import { arrPoster } from './posters.js';

/**
 * Shared client for the Servarr v3 API. Sonarr and Radarr differ in their
 * resources but not in their auth, versioning or error shape, so the transport
 * lives here once.
 */

export type ArrId = Extract<SourceId, 'sonarr' | 'radarr'>;

/** Builds a v3 API URL, honouring a UrlBase if the service is behind a sub-path. */
export async function arrRequest<T>(
  arr: ArrId,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const credential = await credentialFor(arr);
  if (!credential.apiKey) {
    throw new Error(credential.hint ?? `${arr} API key not found yet`);
  }

  const base = config.upstream[arr].replace(/\/$/, '');
  const urlBase = credential.urlBase.replace(/\/$/, '');
  const query = new URLSearchParams(params).toString();
  const url = `${base}${urlBase}/api/v3/${path}${query ? `?${query}` : ''}`;

  return getJson<T>(url, { 'X-Api-Key': credential.apiKey });
}

export interface QueueRecord {
  title?: string;
  /** Set on Sonarr records; the key to that series' cached cover. */
  seriesId?: number;
  /** Set on Radarr records; the key to that movie's cached cover. */
  movieId?: number;
  status?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  downloadId?: string;
  trackedDownloadState?: string;
}

interface QueuePage {
  records?: QueueRecord[];
  totalRecords?: number;
}

/**
 * Current queue, in full.
 *
 * Every record is matched against Transmission's torrent list to label each
 * download and find its artwork, so a partial queue silently produces wrong
 * answers rather than missing ones — an unmatched torrent is labelled OTHER,
 * which is indistinguishable from one no *arr is tracking. A long-running
 * install accumulates hundreds of stalled entries (this was found against a
 * 636-record queue), so paging to the end is the only way the match can be
 * trusted.
 */
export async function queue(arr: ArrId): Promise<QueueRecord[]> {
  const pageSize = 250;
  const records: QueueRecord[] = [];

  // Bounded rather than `while (true)`: a queue that never reports a total, or
  // reports a wrong one, must not spin this loop forever.
  for (let page = 1; page <= 20; page += 1) {
    const body = await arrRequest<QueuePage>(arr, 'queue', {
      page: String(page),
      pageSize: String(pageSize),
      includeUnknownMovieItems: 'false',
    });

    const batch = body.records ?? [];
    records.push(...batch);

    if (batch.length < pageSize) break;
    if (body.totalRecords !== undefined && records.length >= body.totalRecords) break;
  }

  return records;
}

export interface HistoryRecord {
  eventType?: string;
  date?: string;
  sourceTitle?: string;
}

interface HistoryPage {
  records?: HistoryRecord[];
}

/** Recent history, newest first — the raw material for the activity feed. */
export async function history(arr: ArrId, pageSize = 20): Promise<HistoryRecord[]> {
  const page = await arrRequest<HistoryPage>(arr, 'history', {
    page: '1',
    pageSize: String(pageSize),
    sortKey: 'date',
    sortDirection: 'descending',
  });
  return page.records ?? [];
}

export interface CalendarEpisode {
  seriesTitle: string;
  /** Dashboard-relative poster URL for the series, or null if unavailable. */
  poster: string | null;
  code: string;
  title: string;
  network: string;
  airDate: string;
  /** Downloaded / airing today / not yet acquired. */
  status: 'downloaded' | 'airing' | 'missing';
}

interface SonarrCalendarItem {
  title?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  airDateUtc?: string;
  hasFile?: boolean;
  seriesId?: number;
  series?: { title?: string; network?: string };
}

function classify(item: SonarrCalendarItem, now: Date): CalendarEpisode['status'] {
  if (item.hasFile) return 'downloaded';
  const air = item.airDateUtc ? new Date(item.airDateUtc) : null;
  // Not yet aired is "airing" (upcoming); aired without a file is "missing".
  if (air && air.getTime() > now.getTime()) return 'airing';
  return 'missing';
}

/** Sonarr's release calendar over a date range. */
export async function calendar(start: Date, end: Date): Promise<CalendarEpisode[]> {
  const items = await arrRequest<SonarrCalendarItem[]>('sonarr', 'calendar', {
    start: start.toISOString(),
    end: end.toISOString(),
    includeSeries: 'true',
  });

  const now = new Date();
  return items.map((item) => ({
    seriesTitle: item.series?.title ?? 'Unknown',
    poster: arrPoster('sonarr', item.seriesId),
    code: `S${String(item.seasonNumber ?? 0).padStart(2, '0')}E${String(item.episodeNumber ?? 0).padStart(2, '0')}`,
    title: item.title ?? '',
    network: item.series?.network ?? '',
    airDate: item.airDateUtc ?? '',
    status: classify(item, now),
  }));
}

export const __test = { classify };
