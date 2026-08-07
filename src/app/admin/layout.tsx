import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <SessionProvider session={session}>
      <AdminNav />
      {children}
    </SessionProvider>
  );
}
