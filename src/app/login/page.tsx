import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card rise flex w-full max-w-sm flex-col gap-6 p-6 sm:p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="10 Minute School" width={44} height={44} className="size-11 rounded-xl object-contain" />
          <div>
            <p className="eyebrow mb-1">English Centre</p>
            <h1 className="text-lg font-bold text-foreground">Teacher Performance</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to see ratings and upload forms.</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
