import type { ReactNode } from 'react';
import { Info } from '@phosphor-icons/react';

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
  empty,
  children,
}: {
  data: Result<T> | null;
  loading: boolean;
  /** Shown when the upstream is fine but has nothing to report. */
  empty?: string;
  children: (value: T) => ReactNode;
}) {
  if (loading && !data) return <PanelLoading />;
  if (!data) return <PanelEmpty result={{ reason: 'No response yet' }} />;
  if (!data.available) return <PanelEmpty result={data} />;

  const rendered = children(data);
  if (empty && Array.isArray(rendered) && rendered.length === 0) {
    return (
      <span className="text-muted" style={{ fontSize: 13 }}>
        {empty}
      </span>
    );
  }
  return <>{rendered}</>;
}
