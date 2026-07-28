import { Cpu, HardDrives, Memory, WifiHigh, type Icon } from '@phosphor-icons/react';

import { PanelEmpty } from './Panel';
import type { Gauge, Result } from '../types';

const ICON: Record<Gauge['id'], Icon> = {
  cpu: Cpu,
  memory: Memory,
  storage: HardDrives,
  network: WifiHigh,
};

const HUE: Record<Gauge['id'], string> = {
  cpu: 'var(--ap-green)',
  memory: 'var(--ap-cyan)',
  storage: 'var(--ap-amber)',
  network: 'var(--ap-violet)',
};

interface Props {
  data: Result<{ gauges: Gauge[] }> | null;
  loading: boolean;
}

/** The four resource gauges. Placeholders keep the strip's layout stable. */
export function Gauges({ data, loading }: Props) {
  if (!data?.available) {
    const ids: Gauge['id'][] = ['cpu', 'memory', 'storage', 'network'];
    return (
      <>
        {ids.map((id) => (
          <div
            key={id}
            className="card elev-sm"
            style={{ padding: 'var(--space-4)', justifyContent: 'center', minHeight: 88 }}
          >
            {id === 'cpu' && !loading && data && !data.available ? (
              <PanelEmpty result={data} />
            ) : (
              <span className="text-muted" style={{ fontSize: 12 }}>
                {loading ? 'Loading…' : '—'}
              </span>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {data.gauges.map((gauge) => (
        <GaugeCard key={gauge.id} gauge={gauge} />
      ))}
    </>
  );
}

function GaugeCard({ gauge }: { gauge: Gauge }) {
  const color = HUE[gauge.id];
  const Icon = ICON[gauge.id];
  // The ring is a conic-gradient sweep, as in the design prototype. A metric
  // with no ceiling (throughput) shows an unfilled track instead of a lie.
  const degrees = gauge.fraction === null ? 0 : Math.round(gauge.fraction * 360);

  return (
    <div
      className="card elev-sm"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          flex: 'none',
          borderRadius: '50%',
          background: `conic-gradient(${color} ${degrees}deg, var(--color-neutral-800) 0)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={color} />
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          className="text-muted"
          style={{ fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase' }}
        >
          {gauge.label}
        </div>
        <div
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 16, marginTop: 4 }}
        >
          {gauge.value}
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          {gauge.sub}
        </div>
      </div>
    </div>
  );
}
