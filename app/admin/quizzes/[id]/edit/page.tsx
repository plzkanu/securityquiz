"use client";

import { questionToDraft, QuizForm, type QuestionDraft } from "@/components/QuizForm";
import type { Question } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditQuizPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    questions: QuestionDraft[];
    availableFrom: string | null;
    availableUntil: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/quizzes/${id}`);
      if (!res.ok) {
        if (!cancelled) setError("퀴즈를 찾을 수 없습니다.");
        return;
      }
      const data = (await res.json()) as {
        quiz: {
          title: string;
          description: string;
          questions: Question[];
          availableFrom?: string | null;
          availableUntil?: string | null;
        };
      };
      if (!cancelled) {
        setDraft({
          title: data.quiz.title,
          description: data.quiz.description,
          questions: data.quiz.questions.map((q) => questionToDraft(q)),
          availableFrom: data.quiz.availableFrom ?? null,
          availableUntil: data.quiz.availableUntil ?? null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">{error}</p>
        <Link href="/admin" className="text-sm text-blue-300 hover:underline">
          ← 관리로 돌아가기
        </Link>
      </div>
    );
  }

  if (!draft) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>;
  }

  return (
    <QuizForm
      mode="edit"
      quizId={id}
      initialTitle={draft.title}
      initialDescription={draft.description}
      initialQuestions={draft.questions}
      initialAvailableFrom={draft.availableFrom}
      initialAvailableUntil={draft.availableUntil}
    />
  );
}
