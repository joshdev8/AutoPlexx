import { launchUrl, type ServiceGroup, type ServiceStatus } from './types';

/**
 * Ranking and filtering for the header's service search.
 *
 * Kept apart from `CommandSearch.tsx` so it stays free of React and of Vite-only
 * syntax — the component tree reaches `import.meta.glob` through `ServiceIcon`,
 * which plain `node --test` can't evaluate. Pure module, directly testable.
 */

export const MAX_RESULTS = 7;

/** A service is openable when it publishes a web UI and is actually installed. */
export interface Openable extends ServiceStatus {
  port: number;
  href: string;
}

export interface Matches {
  /** Services that can actually be opened — the navigable results. */
  openable: Openable[];
  /** Matched services with nothing to open, named but not offered as results. */
  unopenable: ServiceStatus[];
}

/**
 * Ranks a service against a query. Lower is better; `null` means no match.
 *
 * Name matches beat blurb matches, and a name that starts with the query beats
 * one that merely contains it — typing "so" should reach Sonarr before
 * Flaresolverr.
 */
export function score(service: ServiceStatus, query: string): number | null {
  const name = service.name.toLowerCase();
  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  if (service.id.includes(query)) return 2;
  if (service.blurb.toLowerCase().includes(query)) return 3;
  return null;
}

/**
 * Filters the catalog for the search menu.
 *
 * Only services in a visible group are searchable, matching what the sidebar
 * and Launcher show — `system` services like the socket proxy have no UI and
 * aren't things a user navigates to.
 *
 * Services with nothing to open are split off rather than dropped: they'd be
 * rows that do nothing on Enter, or worse, open a tab that connection-refuses.
 * `stateKnown` is threaded through to `launchUrl` so an unreachable socket
 * proxy doesn't empty the menu — see that function for why.
 */
export function match(
  services: ServiceStatus[],
  groups: readonly { id: ServiceGroup }[],
  rawQuery: string,
  stateKnown = true,
): Matches {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') return { openable: [], unopenable: [] };

  const visible = new Set(groups.map((group) => group.id));
  const ranked = services
    .filter((service) => visible.has(service.group))
    .flatMap((service) => {
      const rank = score(service, query);
      return rank === null ? [] : [{ service, rank }];
    })
    .sort((a, b) => a.rank - b.rank || a.service.name.localeCompare(b.service.name));

  const withHref = ranked.map(({ service }) => ({
    service,
    href: launchUrl(service, stateKnown),
  }));

  return {
    openable: withHref
      .flatMap(({ service, href }) =>
        href === null || service.port === null ? [] : [{ ...service, port: service.port, href }],
      )
      .slice(0, MAX_RESULTS),
    unopenable: withHref.flatMap(({ service, href }) => (href === null ? [service] : [])),
  };
}
