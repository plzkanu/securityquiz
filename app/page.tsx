import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  if (session.role === "admin") {
    redirect("/admin");
  }
  redirect("/quizzes");
}
