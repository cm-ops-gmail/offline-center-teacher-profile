import { notFound } from 'next/navigation';
import { ProgramPage } from '@/features/programs/program-page';
import { isProgramId } from '@/features/ratings/programs';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isProgramId(id)) notFound();
  return <ProgramPage id={id} />;
}
