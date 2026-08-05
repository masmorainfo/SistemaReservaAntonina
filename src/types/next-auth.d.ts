import type { AdminRole } from "@/lib/auth/roles";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: AdminRole;
  }

  interface Session {
    user: {
      role: AdminRole;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` apenas reexporta `@auth/core/jwt`; a augmentation precisa
// apontar para o módulo onde a interface JWT é realmente declarada.
declare module "@auth/core/jwt" {
  interface JWT {
    role: AdminRole;
  }
}
