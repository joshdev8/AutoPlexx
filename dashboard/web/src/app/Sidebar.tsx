import { Shield, ShieldWarning } from '@phosphor-icons/react';

import { ServiceIcon } from '../components/ServiceIcon';
import { StatusDot } from '../components/StatusDot';
import { serviceUrl, type Result, type ServiceGroup, type ServiceStatus, type VpnStatus } from '../types';

interface Props {
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
  vpn: Result<VpnStatus> | null;
}

export function Sidebar({ services, groups, vpn }: Props) {
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

      {transmission && <VpnCard transmission={transmission} vpn={vpn} />}
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
 * Transmission's state, and the VPN it's configured against.
 *
 * The design mocked this as a VPN status card with provider, region and
 * latency. Two things it deliberately does not do:
 *
 *  - It does not claim the tunnel is up. Neither a running container nor a
 *    responding RPC proves the tunnel established or that egress is protected.
 *    haugene/transmission-openvpn does gate traffic on the tunnel, but this
 *    card can only observe from outside, so it reports what it observed and
 *    claims nothing more.
 *  - It does not show latency, which isn't knowable from out here. The provider
 *    and server names are real — they come from the same OPENVPN_* variables
 *    Transmission itself reads — so they're shown as configuration, not status.
 */
function VpnCard({
  transmission,
  vpn,
}: {
  transmission: ServiceStatus;
  vpn: Result<VpnStatus> | null;
}) {
  const running = transmission.state === 'up';
  const responding = vpn?.available ? vpn.connected : false;
  const healthy = running && responding;

  const detail = !running
    ? 'Container not running'
    : responding
      ? 'Container running · RPC responding'
      : 'Container running · RPC unreachable';

  const tags = vpn?.available ? [vpn.provider, vpn.server].filter(Boolean) : [];

  return (
    <div className="card elev-sm" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {healthy ? (
          <Shield size={20} color="var(--color-neutral-400)" weight="regular" />
        ) : (
          <ShieldWarning size={20} color="var(--ap-amber)" weight="regular" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 13 }}>
            Transmission
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {detail}
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span key={tag} className="tag tag-neutral">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
