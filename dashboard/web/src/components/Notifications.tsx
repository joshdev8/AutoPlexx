import { useState } from 'react';
import { ArrowUpRight, Bell, CheckCircle, PlugsConnected, Warning, WarningOctagon } from '@phosphor-icons/react';

import { useDismissable } from '../hooks/useDismissable';
import { serviceUrl } from '../types';
import type { Alert, AlertKind } from '../alerts';

interface Props {
  alerts: Alert[];
  /** Jumps to the Setup view, where a blocked integration is explained in full. */
  onOpenSetup: () => void;
}

const KIND = {
  unreachable: { Icon: WarningOctagon, hue: 'var(--ap-red)' },
  attn: { Icon: Warning, hue: 'var(--ap-amber)' },
  down: { Icon: WarningOctagon, hue: 'var(--ap-red)' },
  blocked: { Icon: PlugsConnected, hue: 'var(--ap-amber)' },
} as const satisfies Record<AlertKind, { Icon: typeof Warning; hue: string }>;

/**
 * The header's alert bell.
 *
 * Everything here is derived from data already on screen, so it never
 * contradicts the sidebar — and it deliberately says nothing when nothing is
 * wrong, rather than inventing an activity feed. The Command Center's Activity
 * panel is where "things that happened" belongs; this is only "things that need
 * you".
 */
export function Notifications({ alerts, onOpenSetup }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  const count = alerts.length;
  const label = count === 0 ? 'Alerts: nothing needs attention' : `Alerts: ${count} need attention`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        style={{ position: 'relative' }}
      >
        <Bell size={17} weight="regular" />
        {count > 0 && (
          <span className="ap-badge" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="ap-pop elev-lg"
          role="dialog"
          aria-label="Alerts"
          style={{ top: 'calc(100% + 8px)', right: 0, width: 340 }}
        >
          <div
            style={{
              padding: 'var(--space-3)',
              borderBottom: '1px solid var(--color-divider)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            Needs attention
          </div>

          {count === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-4) var(--space-3)',
                fontSize: 13,
              }}
            >
              <CheckCircle size={18} color="var(--ap-green)" weight="regular" />
              <span className="text-muted">Every service is running and connected.</span>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 340, overflowY: 'auto' }}>
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onOpenSetup={() => {
                    setOpen(false);
                    onOpenSetup();
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert, onOpenSetup }: { alert: Alert; onOpenSetup: () => void }) {
  const { Icon, hue } = KIND[alert.kind];

  return (
    <li
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <Icon size={16} color={hue} weight="regular" style={{ flex: 'none', marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{alert.title}</div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
          {alert.detail}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          {/*
            A stopped container's UI won't answer, so "Open" is only offered for
            problems where the service is still up — a blocked integration is
            exactly that case.
          */}
          {alert.kind === 'blocked' && (
            <>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onOpenSetup}>
                Setup
              </button>
              {alert.port != null && (
                <a
                  className="btn btn-ghost"
                  href={serviceUrl(alert.port)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12 }}
                >
                  Open
                  <ArrowUpRight size={12} weight="regular" />
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
