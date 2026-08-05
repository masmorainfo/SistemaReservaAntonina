import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { autenticarAdmin } from "@/lib/auth/authenticate";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
