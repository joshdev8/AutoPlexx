import { config } from '../config.js';
import { memoize } from '../cache.js';
import { credentialFor } from '../discovery.js';
import { safely, type Result } from '../http.js';
import { history } from './arr.js';

/**
 * The activity feed — a merged, time-ordered view of what the stack has been
 * doing. Each contributing source is optional: whichever ones are configured
 * show up, and the feed still renders if only one is.
 */

export type ActivityKind = 'grab' | 'download' | 'upgrade' | 'other';

export interface ActivityItem {
  kind: ActivityKind;
  text: string;
  /** ISO timestamp; the client formats it. */
  at: string;
}

/** Maps Servarr event types onto the icons the design uses. */
function kindOf(eventType: string | undefined): ActivityKind {
  switch (eventType) {
    case 'grabbed':
      return 'grab';
    case 'downloadFolderImported':
    case 'episodeFileImported':
    case 'movieFileImported':
      return 'download';
    case 'episodeFileRenamed':
    case 'movieFileRenamed':
      return 'upgrade';
    default:
      return 'other';
  }
}

function phrase(eventType: string | undefined, service: string, title: string): string {
  switch (eventType) {
    case 'grabbed':
      return `${service} grabbed ${title}`;
    case 'downloadFolderImported':
    case 'episodeFileImported':
    case 'movieFileImported':
      return `Imported ${title}`;
    case 'episodeFileDeleted':
    case 'movieFileDeleted':
      return `Deleted ${title}`;
    default:
      return `${service}: ${title}`;
  }
}

async function fromArr(arr: 'sonarr' | 'radarr'): Promise<ActivityItem[]> {
  const credential = await credentialFor(arr);
  if (credential.state !== 'live') return [];

  const service = arr === 'sonarr' ? 'Sonarr' : 'Radarr';
  try {
    const records = await history(arr, 15);
    return records
      .filter((record) => record.date && record.sourceTitle)
      .map((record) => ({
        kind: kindOf(record.eventType),
        text: phrase(record.eventType, service, record.sourceTitle!),
        at: record.date!,
      }));
  } catch {
    // A single contributor failing must not empty the feed.
    return [];
  }
}

async function load(): Promise<{ items: ActivityItem[] }> {
  const contributions = await Promise.all([fromArr('sonarr'), fromArr('radarr')]);

  const items = contributions
    .flat()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return { items };
}

export const getActivity = memoize<Result<{ items: ActivityItem[] }>>(
  () => safely(load),
  config.ttl.activity,
);

export const __test = { kindOf, phrase };
