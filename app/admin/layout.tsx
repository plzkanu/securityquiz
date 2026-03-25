import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getSessionFromCookies } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    redirect("/login");
  }
  return (
    <>
      <Header username={session.username} role="admin" />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
