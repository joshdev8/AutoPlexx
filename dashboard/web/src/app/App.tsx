import { useMemo } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Launcher } from '../views/Launcher';
import { StackHealth } from '../components/StackHealth';
import { usePolled } from '../hooks/usePolled';
import { useTheme } from '../hooks/useTheme';
import type { HealthReport, ServiceGroup } from '../types';

interface ServicesResponse {
  groups: readonly { id: ServiceGroup; label: string }[];
  services: HealthReport['services'];
}

const HEALTH_POLL_MS = 10_000;

export function App() {
  const [theme, toggleTheme] = useTheme();

  // The catalog is static, so it's fetched once and never polled; only live
  // container state is refreshed.
  const catalog = usePolled<ServicesResponse>('/api/services', 60 * 60 * 1000);
  const health = usePolled<HealthReport>('/api/health', HEALTH_POLL_MS);

  const groups = catalog.data?.groups ?? [];
  const services = health.data?.services ?? catalog.data?.services ?? [];

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
      <Sidebar services={services} groups={groups} />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header
          title="Dashboard"
          subtitle={subtitle}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div style={{ padding: 'var(--space-8)', flex: 1 }} className="ap-view">
          <div style={{ marginBottom: 'var(--space-6)', maxWidth: 420 }}>
            <StackHealth health={health.data} loading={health.loading} />
          </div>

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

          {catalog.loading ? (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Loading services…
            </span>
          ) : (
            <Launcher services={services} groups={groups} />
          )}
        </div>
      </main>
    </div>
  );
}
