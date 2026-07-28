import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

import { ServiceIcon } from './ServiceIcon';
import { StatusDot } from './StatusDot';
import { useDismissable } from '../hooks/useDismissable';
import { serviceUrl, type ServiceGroup, type ServiceStatus } from '../types';

interface Props {
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
}

const MAX_RESULTS = 7;

/** A service is openable when it publishes a web UI. */
interface Openable extends ServiceStatus {
  port: number;
}

export interface Matches {
  /** Services that can actually be opened — the navigable results. */
  openable: Openable[];
  /** Matched services with no web UI, named but not offered as results. */
  uiless: ServiceStatus[];
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
 */
export function match(
  services: ServiceStatus[],
  groups: readonly { id: ServiceGroup }[],
  rawQuery: string,
): Matches {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') return { openable: [], uiless: [] };

  const visible = new Set(groups.map((group) => group.id));
  const ranked = services
    .filter((service) => visible.has(service.group))
    .flatMap((service) => {
      const rank = score(service, query);
      return rank === null ? [] : [{ service, rank }];
    })
    .sort((a, b) => a.rank - b.rank || a.service.name.localeCompare(b.service.name));

  return {
    openable: ranked
      .flatMap(({ service }) => (service.port === null ? [] : [{ ...service, port: service.port }]))
      .slice(0, MAX_RESULTS),
    uiless: ranked.flatMap(({ service }) => (service.port === null ? [service] : [])),
  };
}

/**
 * The header's service search.
 *
 * The one action a result can take is "open this service", so services without
 * a web UI aren't offered as results — they'd be rows that do nothing on Enter.
 * They're still named underneath when they match, because a user searching
 * "watchtower" deserves better than an empty menu.
 */
export function CommandSearch({ services, groups }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = () => setOpen(false);
  const wrapRef = useDismissable<HTMLDivElement>(open, close);

  const { openable, uiless } = useMemo(() => match(services, groups, query), [services, groups, query]);

  // Clamp rather than reset, so results narrowing under the cursor doesn't
  // leave the highlight pointing past the end of the list.
  const activeIndex = Math.min(active, Math.max(openable.length - 1, 0));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      // "/" is the convention for search-focus, but only when it isn't being
      // typed into something.
      const slash = event.key === '/' && !typing;
      const commandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
      if (!slash && !commandK) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const openService = (service: Openable) => {
    window.open(serviceUrl(service.port), '_blank', 'noopener,noreferrer');
    setQuery('');
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // First Escape closes the menu, a second clears the box — so an
      // accidental open doesn't cost the query.
      if (open) close();
      else setQuery('');
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (openable.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (Math.min(index, openable.length - 1) + 1) % openable.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (Math.min(index, openable.length - 1) + openable.length - 1) % openable.length);
    } else if (event.key === 'Enter') {
      const service = openable[activeIndex];
      if (service) openService(service);
    }
  };

  const expanded = open && query.trim() !== '';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 150, maxWidth: 360 }}>
      <MagnifyingGlass
        size={15}
        weight="regular"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-neutral-500)',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={inputRef}
        className="input"
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          expanded && openable[activeIndex] ? `${listId}-${openable[activeIndex].id}` : undefined
        }
        aria-label="Search services"
        placeholder="Search services…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ width: '100%', paddingLeft: 32, height: 36 }}
      />

      {expanded && (
        <div className="ap-pop elev-lg" style={{ top: 'calc(100% + 6px)', left: 0, right: 0 }}>
          <ul id={listId} role="listbox" aria-label="Service results" className="ap-menu">
            {openable.map((service, index) => (
              <li
                key={service.id}
                id={`${listId}-${service.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className="ap-menu-item"
                // Keeps focus in the input so the combobox keeps its keyboard
                // contract; the press is handled on mouseDown instead of click.
                onMouseDown={(event) => {
                  event.preventDefault();
                  openService(service);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <ServiceIcon mono={service.mono} hue={service.hue} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14 }}>{service.name}</span>
                  <span className="text-muted" style={{ display: 'block', fontSize: 11 }}>
                    {service.blurb} · :{service.port}
                  </span>
                </span>
                <StatusDot state={service.state} size={7} detail={service.status} />
              </li>
            ))}

            {openable.length === 0 && (
              <li className="text-muted" style={{ padding: 'var(--space-3)', fontSize: 13 }}>
                No matching service
              </li>
            )}
          </ul>

          {uiless.length > 0 && (
            <div
              className="text-muted"
              style={{
                borderTop: '1px solid var(--color-divider)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 11,
              }}
            >
              Also matched, no web UI: {uiless.map((service) => service.name).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
