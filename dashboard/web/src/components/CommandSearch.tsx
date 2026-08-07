import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

import { ServiceIcon } from './ServiceIcon';
import { StatusDot } from './StatusDot';
import { useDismissable } from '../hooks/useDismissable';
import { match, type Openable } from '../search';
import { type ServiceGroup, type ServiceStatus } from '../types';

interface Props {
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
  /** Whether container state is trustworthy — see `launchUrl`. */
  stateKnown: boolean;
}

/**
 * The header's service search.
 *
 * The one action a result can take is "open this service", so services with
 * nothing to open — no web UI, or not installed — aren't offered as results;
 * they'd be rows that do nothing on Enter, or worse, open a dead tab. They're
 * still named underneath when they match, because a user searching "watchtower"
 * deserves better than an empty menu.
 */
export function CommandSearch({ services, groups, stateKnown }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = () => setOpen(false);
  const wrapRef = useDismissable<HTMLDivElement>(open, close);

  const { openable, unopenable } = useMemo(
    () => match(services, groups, query, stateKnown),
    [services, groups, query, stateKnown],
  );

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
    window.open(service.href, '_blank', 'noopener,noreferrer');
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
                <ServiceIcon id={service.id} mono={service.mono} hue={service.hue} />
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

          {unopenable.length > 0 && (
            <div
              className="text-muted"
              style={{
                borderTop: '1px solid var(--color-divider)',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 11,
              }}
            >
              Also matched, nothing to open: {unopenable.map((service) => service.name).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
