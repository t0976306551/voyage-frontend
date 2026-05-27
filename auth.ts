import NextAuth from 'next-auth';
import { createHmac, timingSafeEqual } from 'crypto';
import { authConfig } from './auth.config';

function b64(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function d64(str: string): Buffer {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(pad + '='.repeat((4 - (pad.length % 4)) % 4), 'base64');
}

export const { handlers, auth } = NextAuth({
  ...authConfig,
  jwt: {
    encode: async ({ secret, token, maxAge }) => {
      const s = Array.isArray(secret) ? secret[0] : (secret as string);
      if (!s) throw new Error('AUTH_SECRET is not set');
      const exp = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
      const header = b64(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
      const payload = b64(Buffer.from(JSON.stringify({ ...token, exp })));
      const sig = b64(createHmac('sha256', s).update(`${header}.${payload}`).digest());
      return `${header}.${payload}.${sig}`;
    },
    decode: async ({ secret, token }) => {
      if (!token) return null;
      try {
        const s = Array.isArray(secret) ? secret[0] : (secret as string);
        if (!s) return null;
        const [h, p, sig] = token.split('.');
        if (!h || !p || !sig) return null;
        const header = JSON.parse(d64(h).toString('utf8')) as { alg?: string };
        if (header.alg !== 'HS256') return null;
        const expected = b64(createHmac('sha256', s).update(`${h}.${p}`).digest());
        const eb = Buffer.from(expected, 'base64url');
        const ab = Buffer.from(sig, 'base64url');
        if (eb.length !== ab.length || !timingSafeEqual(eb, ab)) return null;
        return JSON.parse(d64(p).toString('utf8')) as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  },
});
