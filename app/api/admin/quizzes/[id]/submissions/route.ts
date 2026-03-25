import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { mutateStore } from "@/lib/db";

export const runtime = "nodejs";

/** 이 퀴즈에 대한 모든 제출(응시) 기록을 삭제합니다. 퀴즈 본문은 유지됩니다. */
export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = context.params;

  type Outcome = { ok: false } | { ok: true; removed: number };
  const outcome = await mutateStore<Outcome>((store) => {
    const quizExists = store.quizzes.some((q) => q.id === id);
    if (!quizExists) {
      return { store, result: { ok: false } };
    }
    const subs = store.quizSubmissions ?? [];
    const removed = subs.filter((s) => s.quizId === id).length;
    const quizSubmissions = subs.filter((s) => s.quizId !== id);
    return { store: { ...store, quizSubmissions }, result: { ok: true, removed } };
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, removed: outcome.removed });
}
