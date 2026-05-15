import { NextRequest, NextResponse } from 'next/server';

async function isValidToken(token: string, secret: string): Promise<boolean> {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const message = new TextEncoder().encode(`${h}.${p}`);
    const padded = sig.replace(/-/g, '+').replace(/_/g, '/');
    const sigBytes = Uint8Array.from(
      atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)),
      (c) => c.charCodeAt(0),
    );

    return await crypto.subtle.verify('HMAC', key, sigBytes, message);
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Legacy routes — these were removed when tasks/expenses became per-trip sections.
  // Redirect any bookmarked URLs back to /trips to avoid stale 404s.
  if (pathname === '/tasks' || pathname.startsWith('/tasks/') ||
      pathname === '/expenses' || pathname.startsWith('/expenses/')) {
    return NextResponse.redirect(new URL('/trips', req.url));
  }

  const isProtected = ['/trips', '/profile'].some((p) =>
    pathname.startsWith(p),
  );

  if (!isProtected) return NextResponse.next();

  const rawToken =
    req.cookies.get('authjs.session-token')?.value ??
    req.cookies.get('__Secure-authjs.session-token')?.value ??
    req.cookies.get('next-auth.session-token')?.value ??
    req.cookies.get('__Secure-next-auth.session-token')?.value;

  const secret = process.env.AUTH_SECRET ?? '';
  const isLoggedIn = rawToken ? await isValidToken(rawToken, secret) : false;

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/trips/:path*',
    '/profile/:path*',
    '/tasks',
    '/tasks/:path*',
    '/expenses',
    '/expenses/:path*',
  ],
};
