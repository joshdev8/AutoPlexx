import { Moon, Sun } from '@phosphor-icons/react';

import type { Theme } from '../hooks/useTheme';

interface Props {
  title: string;
  subtitle: string;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ title, subtitle, theme, onToggleTheme }: Props) {
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
      <div style={{ minWidth: 0 }}>
        <h4 style={{ margin: 0, fontSize: 21 }}>{title}</h4>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ flex: 1 }} />
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
