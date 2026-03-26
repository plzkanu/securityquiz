import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap, mutateStore } from "@/lib/db";
import {
  attemptQuestionCount,
  drawQuestionIds,
  isDrawValidForQuiz,
  questionsByIds,
  toPublicQuestions,
  usesRandomAttempt,
} from "@/lib/quiz-draw";
import { isQuizAvailableNow } from "@/lib/quiz-availability";
import { buildQuizResultDetails } from "@/lib/quiz-result-details";
import { migrateQuiz } from "@/lib/questions";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = context.params;
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

  const mine = (store.quizSubmissions ?? []).filter((s) => s.quizId === id && s.userId === session.sub);
  if (mine.length > 0) {
    mine.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    const latest = mine[mine.length - 1]!;
    const stored = latest.answers;
    const attemptIds = latest.attemptQuestionIds;
    const ordered = attemptIds?.length ? questionsByIds(quiz, attemptIds) : quiz.questions;
    const details =
      Array.isArray(stored) && stored.length === ordered.length
        ? buildQuizResultDetails(ordered, stored)
        : null;
    return NextResponse.json({
      alreadyCompleted: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: toPublicQuestions(ordered),
      },
      submission: {
        total: latest.total,
        correct: latest.correct,
        submittedAt: latest.submittedAt,
        details,
      },
    });
  }

  let orderedQuestions;
  if (usesRandomAttempt(quiz) && attemptQuestionCount(quiz) > 0) {
    const need = attemptQuestionCount(quiz);
    const poolIds = quiz.questions.map((q) => q.id);
    const drawIds = await mutateStore((s) => {
      const draws = s.quizQuestionDraws ?? [];
      const existing = draws.find((d) => d.userId === session.sub && d.quizId === id);
      if (existing && isDrawValidForQuiz(existing.questionIds, quiz)) {
        return { store: s, result: existing.questionIds };
      }
      const ids = drawQuestionIds(poolIds, need);
      const nextDraws = draws.filter((d) => !(d.userId === session.sub && d.quizId === id));
      nextDraws.push({
        userId: session.sub,
        quizId: id,
        questionIds: ids,
        createdAt: new Date().toISOString(),
      });
      return { store: { ...s, quizQuestionDraws: nextDraws }, result: ids };
    });
    orderedQuestions = questionsByIds(quiz, drawIds);
  } else {
    orderedQuestions = quiz.questions;
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questions: toPublicQuestions(orderedQuestions),
    },
  });
}
