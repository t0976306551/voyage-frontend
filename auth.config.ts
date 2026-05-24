import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

// Edge-safe config: no Node.js-only imports (no crypto, no fs, etc.)
// authorize() uses fetch only — safe for Edge Runtime
export const authConfig: NextAuthConfig = {
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(
            `${process.env['NEXT_PUBLIC_API_URL']}/api/auth/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );
          const json = await res.json() as {
            data: { user: { id: string; email: string; name: string } } | null;
            error: { code: string } | null;
          };
          if (!res.ok || json.error || !json.data) return null;
          return {
            id: json.data.user.id,
            email: json.data.user.email,
            name: json.data.user.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, account, profile }) {
      // account 只在首次登入時存在；token refresh 時為 undefined，不重複呼叫 upsert
      // profile.sub guard：NextAuth v5 Google profile.sub 是 optional，缺失時跳過 upsert（B16）
      if (account?.provider === 'google' && profile?.email && profile?.sub) {
        try {
          // 使用 API_URL（無 NEXT_PUBLIC_），後端位址不暴露給瀏覽器 bundle
          const res = await fetch(
            `${process.env['API_URL']}/api/auth/google-upsert`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-token': process.env['INTERNAL_API_SECRET'] ?? '',
              },
              body: JSON.stringify({
                googleId: profile.sub,
                email: profile.email,
                name: profile.name,
                avatar: (profile as { picture?: string }).picture,
              }),
            },
          );

          if (res.ok) {
            const json = await res.json() as {
              data: { id: string; email: string; name: string } | null;
            };
            if (json.data?.id) {
              // 以後端 UUID 取代 Google numeric sub，讓後端所有 API 查詢正常
              token.sub   = json.data.id;
              token.name  = json.data.name;
              token.email = json.data.email;
            }
          } else {
            console.error('[auth] google-upsert returned', res.status, '— degraded mode active');
          }
        } catch (e) {
          console.error('[auth] google-upsert fetch failed, degraded mode active', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
};
