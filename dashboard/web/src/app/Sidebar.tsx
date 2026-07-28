import { Shield, ShieldWarning } from '@phosphor-icons/react';

import { ServiceIcon } from '../components/ServiceIcon';
import { StatusDot } from '../components/StatusDot';
import { serviceUrl, type ServiceGroup, type ServiceStatus } from '../types';

interface Props {
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
}

export function Sidebar({ services, groups }: Props) {
  const transmission = services.find((service) => service.id === 'transmission');

  return (
    <aside
      style={{
        width: 250,
        flex: 'none',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        padding: 'var(--space-6) var(--space-4)',
        borderRight: '1px solid var(--color-divider)',
        background: 'var(--color-surface)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-1) var(--space-2) var(--space-6)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            flex: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-800)',
            color: 'var(--color-accent-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            fontSize: 17,
          }}
        >
          A
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: '-.01em',
            }}
          >
            AutoPlexx
          </div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Media Command Center
          </div>
        </div>
      </div>

      {groups.map((group) => {
        const items = services.filter((service) => service.group === group.id);
        if (items.length === 0) return null;

        return (
          <nav key={group.id} aria-label={group.label}>
            <h6
              style={{
                margin: 'var(--space-6) var(--space-3) var(--space-2)',
                color: 'var(--color-neutral-500)',
              }}
            >
              {group.label}
            </h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((service) => (
                <SidebarLink key={service.id} service={service} />
              ))}
            </div>
          </nav>
        );
      })}

      <div style={{ flex: 1 }} />

      {transmission && <VpnCard transmission={transmission} />}
    </aside>
  );
}

function SidebarLink({ service }: { service: ServiceStatus }) {
  const href = service.port === null ? null : serviceUrl(service.port);

  const inner = (
    <>
      <ServiceIcon mono={service.mono} hue={service.hue} />
      <span style={{ flex: 1 }}>{service.name}</span>
      <StatusDot state={service.state} size={7} detail={service.status} />
    </>
  );

  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    fontSize: 14,
  } as const;

  if (!href) {
    return (
      <div className="text-muted" style={{ ...style, opacity: 0.75 }}>
        {inner}
      </div>
    );
  }

  return (
    <a className="ap-link" href={href} target="_blank" rel="noreferrer" style={style}>
      {inner}
    </a>
  );
}

/**
 * Transmission's container state.
 *
 * The design mocked this up as a VPN status card with provider, region and
 * latency. None of that is knowable from outside the container, and — more
 * importantly — a running container is *not* proof that the tunnel came up or
 * that egress is protected. haugene/transmission-openvpn does gate traffic on
 * the tunnel, but this card can only observe the container, so it reports
 * exactly that and claims nothing about protection. Provider and server names
 * arrive in phase 2 from OPENVPN_PROVIDER / OPENVPN_CONFIG.
 */
function VpnCard({ transmission }: { transmission: ServiceStatus }) {
  const running = transmission.state === 'up';

  return (
    <div className="card elev-sm" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {running ? (
          <Shield size={20} color="var(--color-neutral-400)" weight="regular" />
        ) : (
          <ShieldWarning size={20} color="var(--ap-amber)" weight="regular" />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 13 }}>
            Transmission
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {running ? 'Container running · VPN image' : 'Container not running'}
          </div>
        </div>
      </div>
    </div>
  );
}
