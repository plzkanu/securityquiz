import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap, mutateStore } from "@/lib/db";
import { parseQuizAvailabilityFromBody } from "@/lib/quiz-availability";
import { parseQuestionsPerAttemptFromAdminBody } from "@/lib/quiz-draw";
import { migrateQuiz, parseQuestionsFromBody } from "@/lib/questions";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = context.params;
  const store = await loadStoreWithBootstrap();
  const quiz = store.quizzes.find((q) => q.id === id);
  if (!quiz) return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  return NextResponse.json({ quiz: migrateQuiz(quiz) });
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = context.params;

  let body: {
    title?: string;
    description?: string;
    questions?: unknown;
    availableFrom?: unknown;
    availableUntil?: unknown;
    questionsPerAttempt?: unknown;
  };
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

  const qpa = parseQuestionsPerAttemptFromAdminBody(body as Record<string, unknown>, questions.length);
  if (!qpa.ok) {
    return NextResponse.json({ error: qpa.error }, { status: 400 });
  }

  const win = parseQuizAvailabilityFromBody(body as Record<string, unknown>);
  if (!win.ok) {
    return NextResponse.json({ error: win.error }, { status: 400 });
  }

  let updated = false;
  await mutateStore((store) => {
    const idx = store.quizzes.findIndex((q) => q.id === id);
    if (idx === -1) {
      return { store, result: null };
    }
    const prev = store.quizzes[idx];
    const nextQuiz = {
      ...prev,
      title,
      description,
      questions,
      availableFrom: win.availableFrom,
      availableUntil: win.availableUntil,
    };
    if (qpa.value !== undefined) nextQuiz.questionsPerAttempt = qpa.value;
    else delete nextQuiz.questionsPerAttempt;
    const quizzes = [...store.quizzes];
    quizzes[idx] = nextQuiz;
    const quizQuestionDraws = (store.quizQuestionDraws ?? []).filter((d) => d.quizId !== id);
    updated = true;
    return { store: { ...store, quizzes, quizQuestionDraws }, result: null };
  });

  if (!updated) return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = context.params;

  let removed = false;
  await mutateStore((store) => {
    const next = store.quizzes.filter((q) => q.id !== id);
    removed = next.length !== store.quizzes.length;
    const quizSubmissions = store.quizSubmissions.filter((s) => s.quizId !== id);
    const quizQuestionDraws = (store.quizQuestionDraws ?? []).filter((d) => d.quizId !== id);
    return { store: { ...store, quizzes: next, quizSubmissions, quizQuestionDraws }, result: null };
  });

  if (!removed) return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
