'use client';
import { Dashboard } from '@/features/dashboard/dashboard';
import type { ProgramId } from '@/features/ratings/types';

export function ProgramPage({ id }: { id: ProgramId }) {
  return <Dashboard lockedProgram={id} />;
}
