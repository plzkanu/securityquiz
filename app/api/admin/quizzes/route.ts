import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap, mutateStore } from "@/lib/db";
import { parseQuizAvailabilityFromBody } from "@/lib/quiz-availability";
import { migrateQuiz, parseQuestionsFromBody } from "@/lib/questions";
import type { Quiz } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const store = await loadStoreWithBootstrap();
  const quizzes = store.quizzes.map((q) => migrateQuiz(q));
  return NextResponse.json({ quizzes });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { title?: string; description?: string; questions?: unknown; availableFrom?: unknown; availableUntil?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const questions = parseQuestionsFromBody(body.questions);
  if (!title || !questions) {
    return NextResponse.json(
      { error: "제목과 유효한 문항이 필요합니다. (객관식은 선택지 2개 이상, 주관식은 허용 정답 1개 이상)" },
      { status: 400 }
    );
  }

  const win = parseQuizAvailabilityFromBody(body as Record<string, unknown>);
  if (!win.ok) {
    return NextResponse.json({ error: win.error }, { status: 400 });
  }

  const quiz: Quiz = {
    id: randomUUID(),
    title,
    description,
    questions,
    createdAt: new Date().toISOString(),
    createdBy: session.sub,
    availableFrom: win.availableFrom,
    availableUntil: win.availableUntil,
  };

  await mutateStore((store) => ({
    store: { ...store, quizzes: [...store.quizzes, quiz] },
    result: null,
  }));

  return NextResponse.json({ quiz });
}
