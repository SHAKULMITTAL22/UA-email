import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Microsoft from "next-auth/providers/microsoft-entra-id";
import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { providerId?: string } & DefaultSession["user"];
    handoffReady?: boolean;
  }
}

const providers = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  );
}

if (env.AUTH_MICROSOFT_ID && env.AUTH_MICROSOFT_SECRET) {
  providers.push(
    Microsoft({
      clientId: env.AUTH_MICROSOFT_ID,
      clientSecret: env.AUTH_MICROSOFT_SECRET,
      issuer: `https://login.microsoftonline.com/${env.AUTH_MICROSOFT_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: "openid email profile offline_access Mail.ReadWrite Mail.Send User.Read",
        },
      },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.providerId = account.provider;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      const providerId = (token as { providerId?: string }).providerId;
      session.user = { ...session.user, ...(providerId ? { providerId } : {}) };
      session.handoffReady = !!(token as { accessToken?: string }).accessToken;
      return session;
    },
  },
});
