import { STATE_COLOR, STATE_LABEL, type ServiceState } from '../types';

interface Props {
  state: ServiceState;
  size?: number;
  /** Docker's own status line, surfaced as the tooltip when available. */
  detail?: string | null;
}

/**
 * The service status indicator. Carries an accessible label as well as a color,
 * since state must not be conveyed by hue alone.
 */
export function StatusDot({ state, size = 8, detail }: Props) {
  const label = STATE_LABEL[state];
  return (
    <span
      className="ap-dot"
      data-state={state}
      role="img"
      aria-label={label}
      title={detail ? `${label} — ${detail}` : label}
      style={{ width: size, height: size, background: STATE_COLOR[state] }}
    />
  );
}
