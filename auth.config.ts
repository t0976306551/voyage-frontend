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
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.sub;
      return session;
    },
  },
};
