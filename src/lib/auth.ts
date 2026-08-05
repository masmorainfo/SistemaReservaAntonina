import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { autenticarAdmin } from "@/lib/auth/authenticate";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway termina o TLS e faz proxy interno; sem isso o Auth.js rejeita
  // as requisições em produção por não confiar no cabeçalho Host.
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) {
          return null;
        }

        const sessao = await autenticarAdmin(
          credentials.email as string,
          credentials.senha as string
        );

        if (!sessao) {
          return null;
        }

        return {
          id: sessao.id,
          name: sessao.nome,
          email: sessao.email,
          role: sessao.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
      }
      return session;
    },
  },
});
