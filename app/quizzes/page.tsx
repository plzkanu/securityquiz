"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatQuizAvailabilityForList } from "@/lib/quiz-availability";

type Row = {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  availableFrom: string | null;
  availableUntil: string | null;
};

export default function QuizzesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/quizzes");
      if (!res.ok) {
        setError("목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { quizzes: Row[] };
      setRows(data.quizzes);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">보안 퀴즈</h1>
      <p className="mt-2 text-[var(--muted)]">한 문항씩 진행합니다. 아래에서 퀴즈를 선택하세요.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!rows && <p className="mt-8 text-[var(--muted)]">불러오는 중…</p>}

      {rows && rows.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          아직 등록된 퀴즈가 없습니다. 관리자에게 문의하세요.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/quizzes/${r.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-blue-500/40 hover:bg-[#162030]"
              >
                <p className="font-semibold text-white">{r.title}</p>
                {r.description ? <p className="mt-1 text-sm text-[var(--muted)]">{r.description}</p> : null}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  문항 {r.questionCount}개 · 풀이 기간: {formatQuizAvailabilityForList(r.availableFrom, r.availableUntil)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
