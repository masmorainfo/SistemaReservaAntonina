import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { autenticarAdmin } from "@/lib/auth/authenticate";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
});
