import { config } from '../config.js';
import { memoize } from '../cache.js';
import { credentialFor } from '../discovery.js';
import { safely, unavailable, upstreamHint, type Result } from '../http.js';
import { calendar, type CalendarEpisode } from './arr.js';

/**
 * The Dashboard's four-item "Upcoming" peek. The full calendar page consumes
 * `calendar()` directly over a wider range.
 */

export interface UpcomingItem extends CalendarEpisode {
  /** Day of month, for the date chip. */
  day: number;
  /** Uppercase short month, e.g. JUL. */
  month: string;
}

async function load(): Promise<{ items: UpcomingItem[] }> {
  const start = new Date();
  const end = new Date(start.getTime() + 21 * 24 * 60 * 60 * 1000);

  const episodes = await calendar(start, end);

  const items = episodes
    .filter((episode) => episode.airDate)
    .sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime())
    .slice(0, 4)
    .map((episode) => {
      const date = new Date(episode.airDate);
      return {
        ...episode,
        day: date.getDate(),
        month: date.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
      };
    });

  return { items };
}

export const getUpcoming = memoize<Result<{ items: UpcomingItem[] }>>(async () => {
  const credential = await credentialFor('sonarr');
  if (credential.state !== 'live') {
    return unavailable('Waiting for Sonarr', credential.hint ?? undefined);
  }
  return safely(load, upstreamHint({ name: 'Sonarr', urlVar: 'SONARR_URL' }));
}, config.ttl.calendar);
