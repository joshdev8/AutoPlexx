import { Heartbeat, WarningCircle } from '@phosphor-icons/react';

import type { HealthReport } from '../types';

interface Props {
  health: HealthReport | null;
  loading: boolean;
}

/**
 * The "N / M up" tile. Its hue tracks the actual state of the stack: green when
 * everything is up, amber when something needs attention.
 */
export function StackHealth({ health, loading }: Props) {
  if (loading || !health) {
    return (
      <div className="card elev-sm" style={{ justifyContent: 'center', padding: 'var(--space-4)' }}>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Checking stack health…
        </span>
      </div>
    );
  }

  // Container state comes from docker-socket-proxy; if that's unreachable we say
  // so rather than implying the whole stack is down.
  if (!health.reachable) {
    return (
      <div className="card elev-sm" style={{ justifyContent: 'center', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <WarningCircle size={18} color="var(--ap-amber)" weight="regular" />
          <span className="card-kicker" style={{ color: 'var(--color-neutral-500)' }}>
            Stack Health
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            fontSize: 20,
            color: 'var(--ap-amber)',
            marginTop: 2,
          }}
        >
          Unavailable
        </div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Can&rsquo;t reach docker-socket-proxy
        </div>
      </div>
    );
  }

  const allUp = health.up === health.total;
  const hue = allUp ? 'var(--ap-green)' : 'var(--ap-amber)';
  const attentionCount = health.total - health.up;

  return (
    <div className="card elev-sm" style={{ justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Heartbeat size={18} color={hue} weight="regular" />
        <span className="card-kicker" style={{ color: 'var(--color-neutral-500)' }}>
          Stack Health
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 500,
          fontSize: 26,
          color: hue,
          marginTop: 2,
        }}
      >
        {health.up} / {health.total} up
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>
        {allUp
          ? 'All services nominal'
          : `${attentionCount} service${attentionCount === 1 ? '' : 's'} need${
              attentionCount === 1 ? 's' : ''
            } attention · ${health.attention.join(', ')}`}
      </div>
    </div>
  );
}
