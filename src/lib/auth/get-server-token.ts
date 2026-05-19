import { cookies } from 'next/headers';

export async function getServerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get('authjs.session-token')?.value ??
    cookieStore.get('__Secure-authjs.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value ??
    cookieStore.get('__Secure-next-auth.session-token')?.value ??
    null
  );
}
