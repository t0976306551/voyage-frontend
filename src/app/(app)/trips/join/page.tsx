import { redirect } from 'next/navigation';
import { getServerToken } from '@/lib/auth/get-server-token';
import { tripsApi } from '@/lib/api/trips.api';
import InvalidCode from './InvalidCode';
import JoinConfirmDialog from '../_components/JoinConfirmDialog';

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { code } = await searchParams;

  if (!code) redirect('/trips');

  const token = await getServerToken();
  if (!token) redirect('/');

  let preview;
  try {
    preview = await tripsApi.getTripPreviewByCode(code.trim().toUpperCase(), token);
  } catch {
    return <InvalidCode />;
  }

  return (
    <JoinConfirmDialog
      preview={preview}
      token={token}
      joinMode="code"
      inviteCode={code.trim().toUpperCase()}
    />
  );
}
