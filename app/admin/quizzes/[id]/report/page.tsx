"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { QuizReport } from "@/lib/quiz-report";

export default function AdminQuizReportPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [report, setReport] = useState<QuizReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [openDetailUserId, setOpenDetailUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/quizzes/${id}/report`);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "현황을 불러오지 못했습니다.");
      setReport(null);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { report: QuizReport };
    setReport(data.report);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clearAllSubmissions() {
    if (!id) return;
    const n = report?.summary.completedUsers ?? 0;
    const msg =
      n > 0
        ? `이 퀴즈의 응시 기록 ${n}건을 모두 삭제합니다. 삭제 후 사용자는 다시 제출할 수 있습니다. 계속할까요?`
        : "현재 저장된 응시 기록이 없습니다. 그래도 제출 데이터를 비울까요?";
    if (!confirm(msg)) return;
    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch(`/api/admin/quizzes/${id}/submissions`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; removed?: number };
      if (!res.ok) {
        setResetMessage(data.error || "초기화에 실패했습니다.");
        return;
      }
      setResetMessage(`응시 기록 ${data.removed ?? 0}건을 삭제했습니다.`);
      await load();
    } catch {
      setResetMessage("초기화 중 오류가 발생했습니다.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">{error || "데이터가 없습니다."}</p>
        <Link href="/admin" className="text-sm text-blue-300 hover:underline">
          ← 관리자 홈
        </Link>
      </div>
    );
  }

  const maxHist = Math.max(1, ...report.correctCountHistogram.map((h) => h.count));
  const maxBand = Math.max(1, ...report.scoreBandHistogram.map((h) => h.count));

  const searchQ = userSearch.trim().toLowerCase();
  const filteredUserRows = !searchQ
    ? report.userRows
    : report.userRows.filter((u) => {
        const blob = [u.username, u.name ?? "", u.department].join(" ").toLowerCase();
        return blob.includes(searchQ);
      });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">퀴즈 응시 현황</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{report.quiz.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">문항 수 {report.quiz.questionCount}개</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={resetting}
            onClick={() => void clearAllSubmissions()}
            className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200/90 hover:border-amber-500/50 hover:text-white disabled:opacity-50"
          >
            {resetting ? "처리 중…" : "응시 기록 전체 초기화"}
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white"
          >
            ← 관리자 홈
          </Link>
        </div>
      </div>

      {resetMessage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted)]">
          {resetMessage}
        </p>
      )}

      <p className="rounded-lg border border-blue-500/25 bg-blue-950/20 px-4 py-3 text-sm text-blue-100/90">
        대상은 <strong className="text-white">역할이 &quot;사용자&quot;인 계정</strong>만 포함됩니다. 사용자당 퀴즈당{" "}
        <strong className="text-white">1회 제출</strong>만 허용됩니다. 제출이 곧 관리자 접수(저장)됩니다.
      </p>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-white">전체 요약</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">대상 인원</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{report.summary.targetUsers}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">응시 완료</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-green-300">{report.summary.completedUsers}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">미응시</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">{report.summary.notCompletedUsers}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">완료율</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-blue-200">
              {report.summary.completionRatePercent}%
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-white">부서별 대상·응시 현황</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">부서</th>
                <th className="py-2 pr-4 font-medium tabular-nums">대상</th>
                <th className="py-2 pr-4 font-medium tabular-nums">완료</th>
                <th className="py-2 pr-4 font-medium tabular-nums">미완료</th>
                <th className="py-2 font-medium tabular-nums">완료율</th>
              </tr>
            </thead>
            <tbody>
              {report.byDepartment.map((row) => (
                <tr key={row.department} className="border-b border-[var(--border)]/80 text-[var(--text)]">
                  <td className="py-2 pr-4 text-white">{row.department}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.targetCount}</td>
                  <td className="py-2 pr-4 tabular-nums text-green-300/90">{row.completedCount}</td>
                  <td className="py-2 pr-4 tabular-nums text-amber-200/80">{row.notCompletedCount}</td>
                  <td className="py-2 tabular-nums">{row.completionRatePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-white">부서별 점수 통계</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">응시 완료자만으로 평균·최고·최저(점수 %)를 계산합니다.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">부서</th>
                <th className="py-2 pr-4 font-medium tabular-nums">응시자 수</th>
                <th className="py-2 pr-4 font-medium tabular-nums">평균</th>
                <th className="py-2 pr-4 font-medium tabular-nums">최고</th>
                <th className="py-2 font-medium tabular-nums">최저</th>
              </tr>
            </thead>
            <tbody>
              {report.byDepartment.map((row) => (
                <tr key={row.department} className="border-b border-[var(--border)]/80 text-[var(--text)]">
                  <td className="py-2 pr-4 text-white">{row.department}</td>
                  <td className="py-2 pr-4 tabular-nums">{row.completedCount}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {row.avgScorePercent !== null ? `${row.avgScorePercent}%` : "—"}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {row.maxScorePercent !== null ? `${row.maxScorePercent}%` : "—"}
                  </td>
                  <td className="py-2 tabular-nums">
                    {row.minScorePercent !== null ? `${row.minScorePercent}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-white">정답 개수별 인원</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">막대 길이는 해당 인원 수의 상대 비율입니다.</p>
        <ul className="mt-4 space-y-2">
          {report.correctCountHistogram.map((h) => (
            <li key={h.correct} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 tabular-nums text-[var(--muted)]">
                {h.correct}개 ({report.quiz.questionCount ? Math.round((h.correct / report.quiz.questionCount) * 100) : 0}%)
              </span>
              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-[var(--bg)]">
                <div
                  className="h-full rounded bg-blue-600/80 transition-[width]"
                  style={{ width: `${(h.count / maxHist) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-white">{h.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold text-white">점수 구간별 인원</h2>
        <ul className="mt-4 space-y-2">
          {report.scoreBandHistogram.map((h) => (
            <li key={h.label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-[var(--muted)]">{h.label}</span>
              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-[var(--bg)]">
                <div
                  className="h-full rounded bg-emerald-600/75 transition-[width]"
                  style={{ width: `${(h.count / maxBand) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-white">{h.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-white">대상자별 현황</h2>
          <label className="flex w-full flex-col gap-1 sm:w-72">
            <span className="text-xs text-[var(--muted)]">사용자 검색 (아이디·이름·부서)</span>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setOpenDetailUserId(null);
              }}
              placeholder="검색…"
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:border-blue-500/50 focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          제출 완료인 경우 <span className="text-[var(--text)]">문항별</span>에서 문항별 정·오답을 확인할 수 있습니다.
        </p>
        <div className="mt-4 max-h-[520px] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-[var(--card)]">
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">아이디</th>
                <th className="py-2 pr-3 font-medium">이름</th>
                <th className="py-2 pr-3 font-medium">부서</th>
                <th className="py-2 pr-3 font-medium">상태</th>
                <th className="py-2 pr-3 font-medium tabular-nums">점수</th>
                <th className="py-2 pr-3 font-medium">제출 시각</th>
                <th className="py-2 font-medium">문항별</th>
              </tr>
            </thead>
            <tbody>
              {filteredUserRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
                    검색 조건에 맞는 사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredUserRows.map((u) => (
                  <Fragment key={u.userId}>
                    <tr className="border-b border-[var(--border)]/60">
                      <td className="py-2 pr-3 text-white">{u.username}</td>
                      <td className="py-2 pr-3 text-[var(--muted)]">{u.name ?? "—"}</td>
                      <td className="py-2 pr-3 text-[var(--muted)]">{u.department}</td>
                      <td className="py-2 pr-3">
                        {u.completed ? (
                          <span className="text-green-300/90">완료</span>
                        ) : (
                          <span className="text-amber-200/80">미응시</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {u.completed && u.correct !== undefined && u.total !== undefined ? (
                          <>
                            {u.correct}/{u.total} ({u.scorePercent}%)
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-[var(--muted)]">
                        {u.submittedAt ? new Date(u.submittedAt).toLocaleString("ko-KR") : "—"}
                      </td>
                      <td className="py-2">
                        {u.completed ? (
                          <button
                            type="button"
                            aria-expanded={openDetailUserId === u.userId}
                            onClick={() =>
                              setOpenDetailUserId((id) => (id === u.userId ? null : u.userId))
                            }
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-blue-200/90 hover:border-blue-500/40 hover:text-white"
                          >
                            {openDetailUserId === u.userId ? "접기" : "보기"}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </tr>
                    {openDetailUserId === u.userId && u.completed ? (
                      <tr className="border-b border-[var(--border)]/60 bg-[var(--bg)]/50">
                        <td colSpan={7} className="px-3 py-3">
                          {u.questionResults && u.questionResults.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                              {u.questionResults.map((r) => (
                                <li
                                  key={r.questionId}
                                  className={`rounded-md border px-2.5 py-1 text-xs tabular-nums ${
                                    r.correct
                                      ? "border-emerald-800/60 bg-emerald-950/35 text-emerald-200/95"
                                      : "border-red-900/50 bg-red-950/30 text-red-200/90"
                                  }`}
                                >
                                  {r.order}번{" "}
                                  <span className="font-medium">{r.correct ? "정답" : "오답"}</span>
                                  <span className="ml-1 text-[var(--muted)]">
                                    ({r.kind === "choice" ? "객관식" : "주관식"})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-[var(--muted)]">
                              문항별 기록이 없습니다. 이전에 제출된 데이터는 합산 점수만 저장되어 있습니다. 문항별
                              득점은 이후 제출부터 표시됩니다.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
