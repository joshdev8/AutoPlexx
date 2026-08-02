import { useEffect, useRef, type ReactNode } from 'react';
import { Info, WarningCircle } from '@phosphor-icons/react';

import type { Result } from '../types';

interface PanelProps {
  title: string;
  /** Small grey label next to the title, naming the upstream service. */
  source?: string;
  icon?: ReactNode;
  /** Right-aligned content in the header row. */
  aside?: ReactNode;
  span: number;
  children: ReactNode;
}

/** A Command Center card. `span` is in 12-column grid units. */
export function Panel({ title, source, icon, aside, span, children }: PanelProps) {
  return (
    <section
      className="card elev-sm"
      style={{ gridColumn: `span ${span}`, padding: 'var(--space-6)', gap: 'var(--space-4)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: 17 }}>{title}</h4>
        {source && (
          <span className="text-muted" style={{ fontSize: 12 }}>
            {source}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * What a panel shows when its upstream isn't usable yet.
 *
 * This is the visible half of the "one dead upstream never blanks the page"
 * rule: it states the reason and, where there is one, the single concrete step
 * that fixes it — so nobody has to go read docs to find out what's missing.
 */
export function PanelEmpty({ result }: { result: { reason: string; hint?: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg)',
        alignItems: 'flex-start',
      }}
    >
      <Info size={16} color="var(--color-neutral-500)" weight="regular" style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{result.reason}</div>
        {result.hint && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {result.hint}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Shown above a panel's content when the newest response was unavailable but an
 * earlier one wasn't.
 *
 * An upstream declining once is not a reason to throw away data that is seconds
 * old — but it is a reason to say so, because silently showing stale numbers is
 * worse than showing none. Carries the same reason and hint `PanelEmpty` would,
 * so the fix stays discoverable without the panel going blank.
 */
export function PanelStale({ result }: { result: { reason: string; hint?: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        alignItems: 'flex-start',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        background: 'color-mix(in srgb, var(--ap-amber) 12%, transparent)',
      }}
    >
      <WarningCircle
        size={14}
        color="var(--ap-amber)"
        weight="regular"
        style={{ flex: 'none', marginTop: 2 }}
      />
      <div style={{ minWidth: 0, fontSize: 12 }}>
        <span>Showing last known data — {result.reason}</span>
        {result.hint && (
          <div className="text-muted" style={{ marginTop: 2 }}>
            {result.hint}
          </div>
        )}
      </div>
    </div>
  );
}

/** Remembers the most recent payload that was actually available. */
function useLastAvailable<T extends object>(data: Result<T> | null): T | null {
  const lastAvailable = useRef<T | null>(null);
  useEffect(() => {
    if (data?.available) lastAvailable.current = data;
  }, [data]);
  return lastAvailable.current;
}

/** Placeholder while a panel's first request is in flight. */
export function PanelLoading() {
  return (
    <span className="text-muted" style={{ fontSize: 13 }}>
      Loading…
    </span>
  );
}

/** Renders data, an empty state, or a loader — the three states every panel has. */
export function PanelBody<T extends object>({
  data,
  loading,
  error,
  empty,
  children,
}: {
  data: Result<T> | null;
  loading: boolean;
  /**
   * The polling error, if the request to this dashboard's own API failed.
   * Distinct from `data.available === false`, which is the upstream declining
   * to answer — that arrives as a successful response.
   */
  error?: string | null;
  /** Shown when the upstream is fine but has nothing to report. */
  empty?: string;
  children: (value: T) => ReactNode;
}) {
  const lastAvailable = useLastAvailable(data);

  const render = (value: T) => {
    const rendered = children(value);
    if (empty && Array.isArray(rendered) && rendered.length === 0) {
      return (
        <span className="text-muted" style={{ fontSize: 13 }}>
          {empty}
        </span>
      );
    }
    return <>{rendered}</>;
  };

  if (loading && !data) return <PanelLoading />;
  // A transport failure leaves `data` null with `loading` false. Reporting that
  // as "No response yet" would imply the request is still coming.
  if (!data) {
    return (
      <PanelEmpty
        result={
          error
            ? { reason: 'Dashboard API unreachable', hint: error }
            : { reason: 'No response yet' }
        }
      />
    );
  }

  if (!data.available) {
    // An upstream blip arrives as a *successful* response carrying
    // `available: false`, so `usePolled` can't tell it from real data and
    // replaces the last good payload with it. Without this branch a single
    // failed poll blanks the panel until the server-side TTL lapses — up to a
    // minute for the calendar — which is exactly what "a failed refresh keeps
    // the last good data on screen" is supposed to prevent.
    if (lastAvailable) {
      return (
        <>
          <PanelStale result={data} />
          {render(lastAvailable)}
        </>
      );
    }
    return <PanelEmpty result={data} />;
  }

  return render(data);
}
