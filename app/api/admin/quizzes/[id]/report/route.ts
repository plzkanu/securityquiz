import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap } from "@/lib/db";
import { buildQuizReport } from "@/lib/quiz-report";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = context.params;
  const store = await loadStoreWithBootstrap();
  const report = buildQuizReport(store, id);
  if (!report) {
    return NextResponse.json({ error: "없는 퀴즈입니다." }, { status: 404 });
  }
  return NextResponse.json({ report });
}
