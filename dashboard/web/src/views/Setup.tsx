import { CheckCircle, Clock, Warning } from '@phosphor-icons/react';

import { usePolled } from '../hooks/usePolled';
import type { Integration } from '../types';

const LABEL: Record<string, string> = {
  sonarr: 'Sonarr',
  radarr: 'Radarr',
  prowlarr: 'Prowlarr',
  bazarr: 'Bazarr',
  tautulli: 'Tautulli',
  seerr: 'Seerr',
};

const STATE = {
  live: { Icon: CheckCircle, hue: 'var(--ap-green)', label: 'Connected' },
  waiting: { Icon: Clock, hue: 'var(--color-neutral-500)', label: 'Waiting' },
  blocked: { Icon: Warning, hue: 'var(--ap-amber)', label: 'Needs attention' },
} as const;

/**
 * Shows which integrations are live and what's outstanding.
 *
 * The dashboard configures itself by reading each service's own config file, so
 * this panel exists to make that legible: on a first boot the user can watch
 * integrations connect themselves, and anything genuinely stuck names the one
 * step that fixes it. Keys are never sent to the browser — only their state.
 */
export function Setup() {
  // Polled on the same cadence as server-side discovery, so a service that has
  // just written its config shows up here without a reload.
  const { data, loading } = usePolled<{ integrations: Integration[] }>('/api/integrations', 30_000);

  const integrations = data?.integrations ?? [];
  const live = integrations.filter((i) => i.state === 'live').length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h4 style={{ margin: 0, fontSize: 17 }}>Integrations</h4>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 'var(--space-2)', lineHeight: 1.6 }}>
          The dashboard reads each service&rsquo;s API key from the config file that service
          writes, so there is nothing to paste. Anything still waiting will connect on its own
          once that service has started for the first time.
        </p>
        {!loading && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
            {live} of {integrations.length} connected
          </div>
        )}
      </div>

      {loading && !data ? (
        <span className="text-muted" style={{ fontSize: 13 }}>
          Loading…
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {integrations.map((integration) => {
            const { Icon, hue, label } = STATE[integration.state];
            return (
              <div
                key={integration.source}
                className="card elev-sm"
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                }}
              >
                <Icon size={18} color={hue} weight="regular" style={{ flex: 'none', marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 15 }}>
                      {LABEL[integration.source] ?? integration.source}
                    </span>
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      {label}
                    </span>
                    {integration.origin === 'env' && (
                      <span className="tag tag-neutral" title="Set explicitly in .env">
                        override
                      </span>
                    )}
                  </div>
                  {integration.hint && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                      {integration.hint}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
