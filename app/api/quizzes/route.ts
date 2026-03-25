import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap } from "@/lib/db";
import { isQuizAvailableNow } from "@/lib/quiz-availability";
import { migrateQuiz } from "@/lib/questions";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const store = await loadStoreWithBootstrap();
  const now = new Date();
  const quizzes = store.quizzes
    .map((q) => migrateQuiz(q))
    .filter((q) => isQuizAvailableNow(q, now))
    .map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      questionCount: q.questions.length,
      createdAt: q.createdAt,
      availableFrom: q.availableFrom,
      availableUntil: q.availableUntil,
    }));
  return NextResponse.json({ quizzes });
}
