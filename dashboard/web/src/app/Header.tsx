import { ArrowUpRight, Moon, Plus, Sun } from '@phosphor-icons/react';

import { CommandSearch } from '../components/CommandSearch';
import { Notifications } from '../components/Notifications';
import { serviceUrl, type ServiceGroup, type ServiceStatus } from '../types';
import type { Alert } from '../alerts';
import type { Theme } from '../hooks/useTheme';

interface Props {
  title: string;
  subtitle: string;
  theme: Theme;
  onToggleTheme: () => void;
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
  alerts: Alert[];
  onOpenSetup: () => void;
}

export function Header({
  title,
  subtitle,
  theme,
  onToggleTheme,
  services,
  groups,
  alerts,
  onOpenSetup,
}: Props) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-8)',
        borderBottom: '1px solid var(--color-divider)',
        background: 'var(--color-bg)',
      }}
    >
      {/*
        The title yields space before the controls do. Without this the search
        box is the thing that collapses on a narrow window, and a search field
        squeezed down to its own icon is worse than a truncated date.
      */}
      <div style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden' }}>
        <h4 style={{ margin: 0, fontSize: 21 }}>{title}</h4>
        <div
          className="text-muted"
          style={{
            fontSize: 12,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ flex: '1 0 var(--space-4)' }} />

      <CommandSearch services={services} groups={groups} />
      <RequestButton services={services} />
      <Notifications alerts={alerts} onOpenSetup={onOpenSetup} />

      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? <Moon size={17} weight="regular" /> : <Sun size={17} weight="regular" />}
      </button>
    </header>
  );
}

/**
 * Hands off to Seerr rather than requesting from here.
 *
 * The design mocked a Request control in the header, and this is that control —
 * but it deep-links instead of posting. The dashboard is read-only and ships no
 * auth, so a request endpoint here would let anyone who can reach the LAN page
 * add to the library under Seerr's credentials, with no record of who did it.
 * Seerr already has accounts, approval rules and its own search; what the
 * header adds is the shortcut, not a second front door.
 */
function RequestButton({ services }: { services: ServiceStatus[] }) {
  const seerr = services.find((service) => service.id === 'seerr');

  // Not in the catalog, absent from the host, or published without a UI port —
  // in each case there is nothing to link to, so no control is shown.
  if (!seerr || seerr.state === 'absent' || seerr.port === null) return null;

  if (seerr.state === 'down') {
    return (
      <button type="button" className="btn btn-secondary" disabled title="Seerr is not running">
        <Plus size={15} weight="regular" />
        Request
      </button>
    );
  }

  return (
    <a
      className="btn btn-primary"
      href={serviceUrl(seerr.port)}
      target="_blank"
      rel="noreferrer"
      title="Request a movie or series in Seerr"
    >
      <Plus size={15} weight="regular" />
      Request
      <ArrowUpRight size={12} weight="regular" />
    </a>
  );
}
