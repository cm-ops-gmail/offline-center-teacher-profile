import { OnlineTeacherProfile } from '@/features/online/online-teacher-profile';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OnlineTeacherProfile id={id} />;
}
