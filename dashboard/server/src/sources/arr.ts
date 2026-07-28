import { config } from '../config.js';
import { credentialFor, type SourceId } from '../discovery.js';
import { getJson } from '../http.js';

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
  status?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  downloadId?: string;
  trackedDownloadState?: string;
}

interface QueuePage {
  records?: QueueRecord[];
}

/**
 * Current queue. Asked for a generous page size because the dashboard matches
 * these against Transmission's torrent list to label each download's source.
 */
export async function queue(arr: ArrId): Promise<QueueRecord[]> {
  const page = await arrRequest<QueuePage>(arr, 'queue', {
    pageSize: '100',
    includeUnknownMovieItems: 'false',
  });
  return page.records ?? [];
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
    code: `S${String(item.seasonNumber ?? 0).padStart(2, '0')}E${String(item.episodeNumber ?? 0).padStart(2, '0')}`,
    title: item.title ?? '',
    network: item.series?.network ?? '',
    airDate: item.airDateUtc ?? '',
    status: classify(item, now),
  }));
}

export const __test = { classify };
