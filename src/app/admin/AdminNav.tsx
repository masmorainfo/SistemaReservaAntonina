"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function AdminNav() {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <nav>
      <Link href="/admin/mapa-do-dia">Mapa do Dia</Link>
      <Link href="/admin/eventos">Eventos</Link>
      <Link href="/admin/politica-cancelamento">Política de Cancelamento</Link>
      <button type="button" onClick={() => signOut({ callbackUrl: "/admin/login" })}>
        Sair
      </button>
    </nav>
  );
}
