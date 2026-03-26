import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap, mutateStore } from "@/lib/db";
import { attemptQuestionCount, isDrawValidForQuiz, questionsByIds, usesRandomAttempt } from "@/lib/quiz-draw";
import { isQuizAvailableNow } from "@/lib/quiz-availability";
import { buildQuizResultDetails, normalizeAnswersForStorage, scoreFromDetails } from "@/lib/quiz-result-details";
import { migrateQuiz } from "@/lib/questions";
import type { Question, QuizSubmission } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = context.params;

  let body: { answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "answers 배열이 필요합니다." }, { status: 400 });
  }
  const answers = body.answers as unknown[];

  const store = await loadStoreWithBootstrap();
  const quizRaw = store.quizzes.find((q) => q.id === id);
  if (!quizRaw) {
    return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  }

  const quiz = migrateQuiz(quizRaw);

  if (!isQuizAvailableNow(quiz)) {
    return NextResponse.json(
      {
        error: "지금은 이 퀴즈를 풀 수 있는 기간이 아닙니다.",
        code: "OUT_OF_WINDOW",
        availableFrom: quiz.availableFrom,
        availableUntil: quiz.availableUntil,
      },
      { status: 403 }
    );
  }

  let orderedQuestions: Question[];
  if (usesRandomAttempt(quiz) && attemptQuestionCount(quiz) > 0) {
    const draws = store.quizQuestionDraws ?? [];
    const draw = draws.find((d) => d.userId === session.sub && d.quizId === id);
    if (!draw || !isDrawValidForQuiz(draw.questionIds, quiz)) {
      return NextResponse.json(
        { error: "출제 문항이 만료되었거나 없습니다. 퀴즈 목록에서 다시 들어와 주세요." },
        { status: 400 }
      );
    }
    orderedQuestions = questionsByIds(quiz, draw.questionIds);
  } else {
    orderedQuestions = quiz.questions;
  }

  const normalizedAnswers = normalizeAnswersForStorage(orderedQuestions, answers);
  if (!normalizedAnswers) {
    return NextResponse.json({ error: "모든 문항에 답해야 합니다." }, { status: 400 });
  }

  if ((store.quizSubmissions ?? []).some((s) => s.quizId === id && s.userId === session.sub)) {
    return NextResponse.json(
      { error: "이미 제출한 퀴즈입니다. 재응시할 수 없습니다.", code: "ALREADY_SUBMITTED" },
      { status: 409 }
    );
  }

  const details = buildQuizResultDetails(orderedQuestions, normalizedAnswers);
  const { correct, total } = scoreFromDetails(details);
  const attemptQuestionIds = orderedQuestions.map((q) => q.id);

  const saved = await mutateStore((s) => {
    if ((s.quizSubmissions ?? []).some((x) => x.quizId === id && x.userId === session.sub)) {
      return { store: s, result: false };
    }
    const draws = (s.quizQuestionDraws ?? []).filter((d) => !(d.userId === session.sub && d.quizId === id));
    const submission: QuizSubmission = {
      id: randomUUID(),
      quizId: id,
      userId: session.sub,
      submittedAt: new Date().toISOString(),
      total,
      correct,
      answers: normalizedAnswers,
      attemptQuestionIds,
      questionResults: details.map((d) => ({
        questionId: d.questionId,
        kind: d.kind,
        correct: d.correct,
      })),
    };
    const quizSubmissions = [...(s.quizSubmissions ?? []), submission];
    return { store: { ...s, quizSubmissions, quizQuestionDraws: draws }, result: true };
  });
  if (!saved) {
    return NextResponse.json(
      { error: "이미 제출한 퀴즈입니다. 재응시할 수 없습니다.", code: "ALREADY_SUBMITTED" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    total,
    correct,
    details,
  });
}
