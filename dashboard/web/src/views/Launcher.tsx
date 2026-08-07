import { ArrowUpRight } from '@phosphor-icons/react';

import { ServiceIcon } from '../components/ServiceIcon';
import { StatusDot } from '../components/StatusDot';
import { HUE_VAR, STATE_LABEL, launchUrl, type ServiceGroup, type ServiceStatus } from '../types';

interface Props {
  services: ServiceStatus[];
  groups: readonly { id: ServiceGroup; label: string }[];
  /** Whether container state is trustworthy — see `launchUrl`. */
  stateKnown: boolean;
}

/** The grouped grid of service tiles — the "open everything from one place" view. */
export function Launcher({ services, groups, stateKnown }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {groups.map((group) => {
        const items = services.filter((service) => service.group === group.id);
        if (items.length === 0) return null;

        return (
          <section key={group.id}>
            <h6 style={{ margin: '0 0 var(--space-4)', color: 'var(--color-neutral-500)' }}>
              {group.label}
            </h6>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              {items.map((service) => (
                <ServiceTile key={service.id} service={service} stateKnown={stateKnown} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ServiceTile({ service, stateKnown }: { service: ServiceStatus; stateKnown: boolean }) {
  const color = HUE_VAR[service.hue];
  // Services with nothing to open — no UI port, or not installed — render as a
  // plain card rather than a dead link.
  const href = launchUrl(service, stateKnown);

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <ServiceIcon id={service.id} mono={service.mono} hue={service.hue} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 15 }}>
            {service.name}
          </div>
          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            {service.port === null ? 'no web UI' : `:${service.port}`}
          </div>
        </div>
        <StatusDot state={service.state} detail={service.status} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {service.state === 'up' ? service.blurb : STATE_LABEL[service.state]}
        </span>
        {href && (
          <span style={{ fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 3 }}>
            Open
            <ArrowUpRight size={12} weight="regular" />
          </span>
        )}
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="card elev-sm" style={{ gap: 'var(--space-4)', opacity: 0.75 }}>
        {body}
      </div>
    );
  }

  return (
    <a
      className="card elev-sm ap-launch"
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        gap: 'var(--space-4)',
        textDecoration: 'none',
        color: 'var(--color-text)',
        transition: 'box-shadow .15s',
      }}
    >
      {body}
    </a>
  );
}
