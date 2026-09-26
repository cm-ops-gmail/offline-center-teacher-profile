'use client';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not sign in. Try again.');
      // Only ever go back to a page inside this app.
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Username
        <input className="field h-10 px-3" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <span className="relative">
          <input className="field h-10 w-full px-3 pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-[13px] text-[color:var(--critical-text)]">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy || !username || !password} className="gap-2">
        {busy && <Loader2 className="size-4 animate-spin" />} Sign in
      </Button>
    </form>
  );
}
