import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // Railway termina o TLS e faz proxy interno; sem isso o Auth.js rejeita
  // as requisições em produção por não confiar no cabeçalho Host.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        if (user.id) {
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
