import React, { useEffect, useMemo, useState } from 'react';
import { definePlugin } from '../__core__';
import { useThemeStore } from './store';

// Lightweight toggle using emoji if react-toggle-dark-mode is unavailable
const ToggleIcon: React.FC<{ checked: boolean; onChange: (v: boolean) => void; title?: string }>= ({ checked, onChange, title }) => {
  return (
    <button
      title={title}
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 16, border: '1px solid var(--border, #ddd)',
        background: 'var(--bg, transparent)', cursor: 'pointer', transition: 'transform 200ms ease'
      }}
    >
      <span style={{ transform: `translateX(${checked ? 1 : -1}px)`, transition: 'transform 200ms ease' }}>
        {checked ? '🌙' : '☀️'}
      </span>
    </button>
  );
};

const presets: Array<{ id: string; name: string; light: string; dark: string }> = [
  { id: 'default', name: 'Default', light: '#0066cc', dark: '#4d94ff' },
  { id: 'ocean', name: 'Ocean Blue', light: '#0077be', dark: '#1e90ff' },
  { id: 'forest', name: 'Forest Green', light: '#2d7a3e', dark: '#4ade80' },
  { id: 'sunset', name: 'Sunset Orange', light: '#ff6b35', dark: '#ff8c42' },
  { id: 'purple', name: 'Purple Haze', light: '#7c3aed', dark: '#a78bfa' },
  { id: 'mono', name: 'Monochrome', light: '#000000', dark: '#ffffff' },
];

function applyPreset(presetId: string, theme: 'light'|'dark') {
  const p = presets.find(p => p.id === presetId) || presets[0];
  document.documentElement.style.setProperty('--theme-accent', theme === 'dark' ? p.dark : p.light);
}

function detectTheme(auto: boolean, fallback: 'light'|'dark'|'auto'): 'light'|'dark' {
  if (auto || fallback === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return (fallback as 'light'|'dark');
}

const ThemeSwitcher: React.FC = () => {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const colorPreset = useThemeStore(s => s.colorPreset);
  const setColorPreset = useThemeStore(s => s.setColorPreset);
  const dnsAccent = useThemeStore(s => s.dnsAccent);

  const effectiveTheme = useMemo(() => detectTheme(theme === 'auto', theme), [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-color-preset', colorPreset);
    applyPreset(colorPreset, effectiveTheme);
  }, [effectiveTheme, colorPreset]);

  useEffect(() => {
    if (!dnsAccent) return;
    document.documentElement.style.setProperty('--theme-dns-accent', dnsAccent);
  }, [dnsAccent]);

  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'auto') applyPreset(colorPreset, detectTheme(true, 'auto')); };
    m.addEventListener?.('change', handler);
    return () => m.removeEventListener?.('change', handler);
  }, [theme, colorPreset]);

  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <ToggleIcon
        title={`Toggle theme (current: ${effectiveTheme})`}
        checked={effectiveTheme === 'dark'}
        onChange={(isDark) => setTheme(isDark ? 'dark' : 'light')}
      />
      <select
        aria-label="Theme mode"
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        style={{ height: 28 }}
      >
        <option value="auto">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <button onClick={() => setOpen(o => !o)} style={{ height: 28 }}>Presets</button>
      {open && (
        <div style={{ position: 'absolute', marginTop: 40, padding: 8, background: 'var(--popover-bg, #fff)', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 9999 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 140px)', gap: 8 }}>
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => { setColorPreset(p.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer', background: colorPreset === p.id ? 'rgba(0,0,0,0.04)' : 'transparent'
                }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 8, background: p.light, outline: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
                <span style={{ width: 16, height: 16, borderRadius: 8, background: p.dark, outline: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LegacyOverlay: React.FC = () => {
  const { legacyConfigs, oldestIssues, favoriteOverlays, toggleFavorite } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  const accent = getDnsAccentColor();

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, width: 320, background: 'var(--overlay-bg, #111)', color: '#fff', borderRadius: 12, boxShadow: '0 12px 24px rgba(0,0,0,0.24)', overflow: 'hidden', border: `1px solid ${accent ?? 'var(--theme-accent, #4d94ff)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: accent ?? 'var(--theme-accent, #4d94ff)' }}>
        <strong>Legacy Overlay</strong>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <button onClick={() => setCollapsed(c => !c)} style={{ color: '#111', background: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)' }}>
          <section>
            <h4 style={{ margin: '6px 0' }}>Legacy Config</h4>
            {legacyConfigs.length === 0 && <div style={{ opacity: 0.7 }}>No legacy config found.</div>}
            {legacyConfigs.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name} <span style={{ opacity: 0.7 }}>v{c.version}</span></div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Last: {new Date(c.lastModified).toLocaleDateString()} · {c.status}</div>
                </div>
                <button onClick={() => toggleFavorite(c.id)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 6, padding: '2px 6px' }}>
                  {favoriteOverlays.find(f => f.id === c.id)?.starred ? '★' : '☆'}
                </button>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 8 }}>
            <h4 style={{ margin: '6px 0' }}>Oldest unresolved issues</h4>
            {oldestIssues.length === 0 && <div style={{ opacity: 0.7 }}>No incidents</div>}
            {oldestIssues.map(i => (
              <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '4px 0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{i.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Severity: {i.severity} · {i.age}d</div>
                </div>
                <span style={{ alignSelf: 'center', padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', fontSize: 12 }}>#{i.id}</span>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 8 }}>
            <h4 style={{ margin: '6px 0' }}>Accent</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: 'var(--theme-accent)' }} />
              <div style={{ width: 16, height: 16, borderRadius: 8, background: 'var(--theme-dns-accent)' }} />
              <span style={{ fontSize: 12, opacity: 0.7 }}>{accent ?? 'n/a'}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

function getDnsAccentColor(): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-dns-accent').trim();
  return v || null;
}

const ThemeSettings: React.FC = () => {
  const { favoriteOverlays, reorderFavorites } = useThemeStore();
  const [items, setItems] = useState(favoriteOverlays);

  useEffect(() => setItems(favoriteOverlays), [favoriteOverlays]);

  return (
    <div style={{ padding: 12 }}>
      <h3>Theme & Overlay Settings</h3>
      <p style={{ opacity: 0.8 }}>Star/favorite overlays and reorder them. Legacy overlays appear first.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {[...items].sort((a,b) => a.order - b.order).map((f, idx) => (
          <li key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
            <span>{f.starred ? '★' : '☆'} {f.name}</span>
            <button disabled={idx===0} onClick={() => {
              const arr = [...items];
              [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
              setItems(arr); reorderFavorites(arr);
            }}>↑</button>
            <button disabled={idx===items.length-1} onClick={() => {
              const arr = [...items];
              [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]];
              setItems(arr); reorderFavorites(arr);
            }}>↓</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default definePlugin({
  id: 'theme',
  name: 'Advanced Theme Manager',
  description: 'Animated theme toggler, legacy overlay, DNS accent, config panel',
  version: '1.0.0',
  settings: {
    enabled: { type: 'boolean', default: true, label: 'Enable Advanced Theme Manager' },
  },
  async onLoad() {
    // Try fetch DNS accent from a well-known endpoint
    try {
      const res = await fetch(`${location.origin}/.well-known/theme-config.json`).catch(() => null);
      if (res?.ok) {
        const json = await res.json();
        if (json?.accentColor) document.documentElement.style.setProperty('--theme-dns-accent', json.accentColor);
      }
    } catch {}
  },
  ui: [
    { id: 'theme-switcher', component: ThemeSwitcher, mount: 'toolbar', order: 100 },
    { id: 'legacy-overlay', component: LegacyOverlay, mount: 'floating', order: 10 },
    { id: 'theme-settings', component: ThemeSettings, mount: 'settings-panel', order: 5 },
  ],
});
