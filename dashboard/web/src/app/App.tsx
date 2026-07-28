import { useMemo, useState } from 'react';
import { GridNine, Sliders, SquaresFour, WarningCircle } from '@phosphor-icons/react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Launcher } from '../views/Launcher';
import { CommandCenter } from '../views/CommandCenter';
import { Setup } from '../views/Setup';
import { StackHealth } from '../components/StackHealth';
import { Gauges } from '../components/Gauges';
import { usePolled } from '../hooks/usePolled';
import { useTheme } from '../hooks/useTheme';
import { deriveAlerts } from '../alerts';
import type { Gauge, HealthReport, Integration, Result, ServiceGroup, VpnStatus } from '../types';

interface ServicesResponse {
  groups: readonly { id: ServiceGroup; label: string }[];
  services: HealthReport['services'];
}

type View = 'command' | 'launcher' | 'setup';

const HEALTH_POLL_MS = 10_000;
/** Matches the server's discovery TTL, so a newly written key surfaces promptly. */
const INTEGRATION_POLL_MS = 30_000;

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [view, setView] = useState<View>('command');

  // The catalog is static, so it's fetched once and never polled; only live
  // container state is refreshed.
  const catalog = usePolled<ServicesResponse>('/api/services', 60 * 60 * 1000);
  const health = usePolled<HealthReport>('/api/health', HEALTH_POLL_MS);
  const metrics = usePolled<Result<{ gauges: Gauge[] }>>('/api/metrics', 15_000);
  const vpn = usePolled<Result<VpnStatus>>('/api/vpn', 30_000);
  // Polled here rather than inside Setup because the alert bell needs the same
  // data — one poll feeds both, whichever view is on screen.
  const integrations = usePolled<{ integrations: Integration[] }>(
    '/api/integrations',
    INTEGRATION_POLL_MS,
  );

  const groups = catalog.data?.groups ?? [];
  const services = health.data?.services ?? catalog.data?.services ?? [];

  const alerts = useMemo(
    () => deriveAlerts(health.data, integrations.data?.integrations ?? []),
    [health.data, integrations.data],
  );

  const subtitle = useMemo(() => {
    const today = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!health.data) return today;
    if (!health.data.reachable) return `${today} · container state may be stale`;
    // Guard total === 0 so an empty stack isn't announced as nominal.
    if (health.data.total === 0) return `${today} · no services found`;
    const nominal = health.data.up === health.data.total;
    return `${today} · ${nominal ? 'all systems nominal' : `${health.data.attention.length} need attention`}`;
  }, [health.data]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Sidebar services={services} groups={groups} vpn={vpn.data} vpnLoading={vpn.loading} />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header
          title="Dashboard"
          subtitle={subtitle}
          theme={theme}
          onToggleTheme={toggleTheme}
          services={services}
          groups={groups}
          alerts={alerts}
          onOpenSetup={() => setView('setup')}
        />

        <div style={{ padding: 'var(--space-8)', flex: 1 }} className="ap-view">
          <div className="seg" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="seg-opt">
              <input
                type="radio"
                name="ap-home"
                checked={view === 'command'}
                onChange={() => setView('command')}
              />
              <SquaresFour size={15} />
              Command Center
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name="ap-home"
                checked={view === 'launcher'}
                onChange={() => setView('launcher')}
              />
              <GridNine size={15} />
              Launcher
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name="ap-home"
                checked={view === 'setup'}
                onChange={() => setView('setup')}
              />
              <Sliders size={15} />
              Setup
            </label>
          </div>

          {/* The resource strip stays on both data views — it's the "is the box OK" line. */}
          {view !== 'setup' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr) 1.3fr',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <Gauges data={metrics.data} loading={metrics.loading} />
              <StackHealth health={health.data} loading={health.loading} />
            </div>
          )}

          {/*
            A failed refresh keeps the last good data on screen, so this banner
            reports the staleness rather than replacing the dashboard with an
            error page.
          */}
          {health.error && health.data && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                fontSize: 12,
                color: 'var(--ap-amber)',
              }}
            >
              <WarningCircle size={14} weight="regular" />
              Status may be stale — last refresh failed ({health.error})
            </div>
          )}

          {view === 'command' && <CommandCenter />}
          {view === 'launcher' &&
            (catalog.loading ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                Loading services…
              </span>
            ) : (
              <Launcher services={services} groups={groups} />
            ))}
          {view === 'setup' && (
            <Setup integrations={integrations.data?.integrations ?? []} loading={integrations.loading} />
          )}
        </div>
      </main>
    </div>
  );
}
