export const fmt = (v: number | null | undefined, digits = 2): string => (v == null ? '—' : v.toFixed(digits));

export function fmtDelta(v: number | null | undefined, digits = 2): string {
  if (v == null) return '—';
  const s = Math.abs(v) < 0.005 ? (0).toFixed(digits) : Math.abs(v).toFixed(digits);
  return v > 0.005 ? `+${s}` : v < -0.005 ? `−${s}` : s;
}

export const pct = (n: number, d: number): string => (d ? `${Math.round((n / d) * 100)}%` : '—');

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
