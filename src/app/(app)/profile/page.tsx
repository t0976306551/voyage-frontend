import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/');

  const token = await getServerToken();
  if (!token) redirect('/');

  return (
    <ProfileClient
      name={session.user.name ?? ''}
      email={session.user.email ?? '未設定 Email'}
      image={session.user.image ?? null}
      token={token}
    />
  );
}
