import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { getSessionFromCookies } from "@/lib/auth";

export default async function QuizzesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  return (
    <>
      <Header displayLabel={session.displayLabel} role={session.role} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </>
  );
}
