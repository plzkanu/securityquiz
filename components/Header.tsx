"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  /** 이름(소속부서) 등 로그인자 표시용 */
  displayLabel: string;
  role: "admin" | "user";
};

export function Header({ displayLabel, role }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white hover:text-blue-300">
          보안 퀴즈
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          {role === "admin" && (
            <Link href="/admin" className="hover:text-white">
              관리
            </Link>
          )}
          <Link href="/quizzes" className="hover:text-white">
            퀴즈 풀기
          </Link>
          <span className="hidden sm:inline">·</span>
          <span className="text-[var(--text)]">{displayLabel}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:border-blue-500/50 hover:text-white"
          >
            로그아웃
          </button>
        </nav>
      </div>
    </header>
  );
}
