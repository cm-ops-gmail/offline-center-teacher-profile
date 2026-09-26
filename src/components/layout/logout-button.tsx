'use client';
import { LogOut } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';

export function LogoutButton() {
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.assign('/login');
  };
  return (
    <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" title="Sign out">
      <LogOut className="size-4" />
    </Button>
  );
}
