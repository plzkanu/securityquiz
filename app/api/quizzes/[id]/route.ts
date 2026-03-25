import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap } from "@/lib/db";
import { isQuizAvailableNow } from "@/lib/quiz-availability";
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
    return NextResponse.json({
      alreadyCompleted: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: [],
      },
      submission: {
        total: latest.total,
        correct: latest.correct,
        submittedAt: latest.submittedAt,
      },
    });
  }

  const publicQuestions = quiz.questions.map((q) => {
    if (q.kind === "choice") {
      return {
        id: q.id,
        kind: "choice" as const,
        prompt: q.prompt,
        timeLimitSec: q.timeLimitSec,
        choices: q.choices,
      };
    }
    return {
      id: q.id,
      kind: "short" as const,
      prompt: q.prompt,
      timeLimitSec: q.timeLimitSec,
    };
  });

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questions: publicQuestions,
    },
  });
}
