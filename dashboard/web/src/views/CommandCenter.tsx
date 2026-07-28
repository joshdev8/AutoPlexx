import {
  ArrowDown,
  ArrowsClockwise,
  CheckCircle,
  DownloadSimple,
  Magnet,
  PlayCircle,
  PlusCircle,
  ShieldCheck,
  type Icon,
} from '@phosphor-icons/react';

import { Panel, PanelBody } from '../components/Panel';
import { usePolled } from '../hooks/usePolled';
import {
  MODE_HUE,
  REQUEST_HUE,
  UPCOMING_HUE,
  type ActivityItem,
  type Download,
  type RequestItem,
  type Result,
  type Stream,
  type UpcomingItem,
} from '../types';

/** A tinted tag driven by the `--h` custom property, per the design's `.ap-tag`. */
function Tag({ hue, children }: { hue: string; children: React.ReactNode }) {
  return (
    <span className="ap-tag" data-h="1" style={{ '--h': hue } as React.CSSProperties}>
      {children}
    </span>
  );
}

function Bar({ percent, hue, height = 5 }: { percent: number; hue: string; height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 6,
        background: 'var(--color-neutral-800)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '100%', borderRadius: 6, background: hue, width: `${percent}%` }} />
    </div>
  );
}

export function CommandCenter() {
  const streams = usePolled<Result<{ streams: Stream[]; count: number; bandwidth: string; transcodes: number }>>(
    '/api/streams',
    10_000,
  );
  const downloads = usePolled<Result<{ downloads: Download[]; active: number }>>('/api/downloads', 10_000);
  const upcoming = usePolled<Result<{ items: UpcomingItem[] }>>('/api/upcoming', 5 * 60_000);
  const requests = usePolled<Result<{ requests: RequestItem[]; pending: number }>>('/api/requests', 60_000);
  const activity = usePolled<Result<{ items: ActivityItem[] }>>('/api/activity', 60_000);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--space-4)' }}>
      <Panel
        title="Now Playing"
        source="Plex · Tautulli"
        span={8}
        icon={<PlayCircle size={18} color="var(--color-accent)" />}
        aside={
          streams.data?.available && streams.data.count > 0 ? (
            <span className="text-muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowDown size={12} />
              {streams.data.bandwidth}
            </span>
          ) : null
        }
      >
        <PanelBody data={streams.data} loading={streams.loading} error={streams.error}>
          {(value) =>
            value.streams.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                Nothing playing right now.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {value.streams.map((stream, index) => (
                  <StreamRow key={`${stream.title}-${index}`} stream={stream} />
                ))}
              </div>
            )
          }
        </PanelBody>
      </Panel>

      <Panel
        title="Downloads"
        span={4}
        icon={<DownloadSimple size={18} color="var(--color-accent)" />}
        aside={
          <span className="tag tag-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={12} />
            VPN
          </span>
        }
      >
        <PanelBody data={downloads.data} loading={downloads.loading} error={downloads.error}>
          {(value) =>
            value.downloads.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                No active downloads.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {value.downloads.map((download) => (
                  <DownloadRow key={download.label} download={download} />
                ))}
              </div>
            )
          }
        </PanelBody>
      </Panel>

      <Panel title="Upcoming" source="Sonarr" span={4}>
        <PanelBody data={upcoming.data} loading={upcoming.loading} error={upcoming.error}>
          {(value) =>
            value.items.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                Nothing airing in the next three weeks.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {value.items.map((item, index) => (
                  <UpcomingRow key={`${item.seriesTitle}-${item.code}-${index}`} item={item} />
                ))}
              </div>
            )
          }
        </PanelBody>
      </Panel>

      <Panel
        title="Requests"
        source="Seerr"
        span={4}
        aside={
          requests.data?.available && requests.data.pending > 0 ? (
            <span className="tag tag-outline">{requests.data.pending} pending</span>
          ) : null
        }
      >
        <PanelBody data={requests.data} loading={requests.loading} error={requests.error}>
          {(value) =>
            value.requests.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                No recent requests.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {value.requests.slice(0, 4).map((request, index) => (
                  <RequestRow key={`${request.title}-${index}`} request={request} />
                ))}
              </div>
            )
          }
        </PanelBody>
      </Panel>

      <Panel
        title="Activity"
        span={4}
        aside={
          <span className="text-muted" style={{ fontSize: 12 }}>
            Recent
          </span>
        }
      >
        <PanelBody data={activity.data} loading={activity.loading} error={activity.error}>
          {(value) =>
            value.items.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 13 }}>
                Nothing to report yet.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {value.items.map((item, index) => (
                  <ActivityRow key={`${item.at}-${index}`} item={item} />
                ))}
              </div>
            )
          }
        </PanelBody>
      </Panel>
    </div>
  );
}

function StreamRow({ stream }: { stream: Stream }) {
  const hue = MODE_HUE[stream.mode];
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'center',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 64,
          flex: 'none',
          borderRadius: 'var(--radius-sm)',
          background:
            'repeating-linear-gradient(135deg, var(--color-neutral-800) 0 7px, var(--color-surface) 7px 14px)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 4,
          fontSize: 8,
          color: 'var(--color-neutral-500)',
        }}
      >
        {stream.mono}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {stream.title}
          </span>
          <span className="text-muted" style={{ fontSize: 11 }}>
            {stream.meta}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '6px 0' }}>
          <span className="tag tag-neutral">{stream.user}</span>
          {stream.quality && <span className="tag tag-outline">{stream.quality}</span>}
          <Tag hue={hue}>{stream.mode}</Tag>
          {stream.device && (
            <span className="text-muted" style={{ fontSize: 11, alignSelf: 'center' }}>
              {stream.device}
            </span>
          )}
        </div>
        <Bar percent={stream.percent} hue={hue} />
      </div>
      <div
        className="text-muted"
        style={{ flex: 'none', textAlign: 'right', fontSize: 11, lineHeight: 1.5 }}
      >
        {stream.elapsed}
        <br />
        {stream.total}
      </div>
    </div>
  );
}

const SOURCE_HUE: Record<Download['source'], string> = {
  SONARR: 'var(--ap-cyan)',
  RADARR: 'var(--ap-amber)',
  OTHER: 'var(--color-neutral-500)',
};

function DownloadRow({ download }: { download: Download }) {
  // Near-complete downloads go green regardless of source, matching the design.
  const hue = download.percent > 90 ? 'var(--ap-green)' : SOURCE_HUE[download.source];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 6 }}>
        <Tag hue={SOURCE_HUE[download.source]}>{download.source}</Tag>
        <span
          style={{
            fontSize: 13,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={download.label}
        >
          {download.label}
        </span>
      </div>
      <Bar percent={download.percent} hue={hue} height={7} />
      <div
        className="text-muted"
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11 }}
      >
        <span>
          {download.percent}% · {download.speed}
        </span>
        <span>ETA {download.eta}</span>
      </div>
    </div>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const hue = UPCOMING_HUE[item.status];
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <div style={{ width: 38, flex: 'none', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 16, color: hue }}>
          {item.day}
        </div>
        <div className="text-muted" style={{ fontSize: 9, textTransform: 'uppercase' }}>
          {item.month}
        </div>
      </div>
      <div style={{ width: 2, alignSelf: 'stretch', borderRadius: 2, background: hue }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.seriesTitle}
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          {item.code}
          {item.network && ` · ${item.network}`}
        </div>
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: RequestItem }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 50,
          flex: 'none',
          borderRadius: 'var(--radius-sm)',
          background:
            'repeating-linear-gradient(135deg, var(--color-neutral-800) 0 6px, var(--color-bg) 6px 12px)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {request.title}
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          {request.kind} · {request.user}
          {request.when && ` · ${request.when}`}
        </div>
      </div>
      <Tag hue={REQUEST_HUE[request.status]}>{request.status}</Tag>
    </div>
  );
}

const ACTIVITY_ICON: Record<ActivityItem['kind'], { Icon: Icon; hue: string }> = {
  grab: { Icon: Magnet, hue: 'var(--ap-cyan)' },
  download: { Icon: CheckCircle, hue: 'var(--ap-green)' },
  upgrade: { Icon: ArrowsClockwise, hue: 'var(--ap-violet)' },
  other: { Icon: PlusCircle, hue: 'var(--ap-amber)' },
};

/** "8m" / "4h" / "3d", matching the design's compact feed timestamps. */
function shortAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { Icon, hue } = ACTIVITY_ICON[item.kind];
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          flex: 'none',
          borderRadius: 'var(--radius-sm)',
          background: `color-mix(in srgb, ${hue} 16%, transparent)`,
          color: hue,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="text-muted"
          style={{
            fontSize: 12,
            color: 'var(--color-neutral-300)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={item.text}
        >
          {item.text}
        </div>
      </div>
      <span className="text-muted" style={{ flex: 'none', fontSize: 11 }}>
        {shortAgo(item.at)}
      </span>
    </div>
  );
}
