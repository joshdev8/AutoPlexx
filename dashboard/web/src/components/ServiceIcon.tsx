import { HUE_VAR, type Hue } from '../types';

interface Props {
  mono: string;
  hue: Hue;
  size?: number;
}

/** The tinted monogram tile that stands in for each service's logo. */
export function ServiceIcon({ mono, hue, size = 24 }: Props) {
  const color = HUE_VAR[hue];
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: size >= 36 ? 'var(--radius-md)' : 'var(--radius-sm)',
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-heading)',
        fontWeight: 500,
        fontSize: size >= 36 ? 14 : 10,
      }}
    >
      {mono}
    </span>
  );
}
