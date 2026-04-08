"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  drawRandomSubset,
  eligibleByMinScore,
  excludeUserIdsFromPool,
} from "@/lib/quiz-lottery";
import type { QuizReport, QuizReportUserRow } from "@/lib/quiz-report";

type ReportDetailTab =
  | "deptCompletion"
  | "deptScores"
  | "histograms"
  | "users"
  | "lottery";

const REPORT_TABS: { id: ReportDetailTab; label: string }[] = [
  { id: "deptCompletion", label: "부서별 대상·응시" },
  { id: "deptScores", label: "부서별 점수 통계" },
  { id: "histograms", label: "정답 개수·구간별 인원" },
  { id: "users", label: "대상자별 현황" },
  { id: "lottery", label: "점수 기준 랜덤 추첨" },
];

export default function AdminQuizReportPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [report, setReport] = useState<QuizReport | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [customCompanyDraft, setCustomCompanyDraft] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [openDetailUserId, setOpenDetailUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<ReportDetailTab>("deptCompletion");

  const [lotteryMinPercent, setLotteryMinPercent] = useState(80);
  const [lotteryDrawCount, setLotteryDrawCount] = useState(1);
  const [lotteryExcludedIds, setLotteryExcludedIds] = useState<string[]>([]);
  const [lotteryWinners, setLotteryWinners] = useState<QuizReportUserRow[] | null>(null);
  const [lotteryNotice, setLotteryNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setFetching(true);
    setError(null);
    const qs =
      selectedCompany === "all" ? "" : `?company=${encodeURIComponent(selectedCompany)}`;
    const res = await fetch(`/api/admin/quizzes/${id}/report${qs}`, { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "현황을 불러오지 못했습니다.");
      setFetching(false);
      return;
    }
    const data = (await res.json()) as { report: QuizReport; companies?: string[] };
    setReport(data.report);
    setCompanies(data.companies ?? []);
    setFetching(false);
  }, [id, selectedCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setLotteryExcludedIds([]);
    setLotteryWinners(null);
    setLotteryNotice(null);
  }, [selectedCompany]);

  useEffect(() => {
    if (!report) return;
    const eligible = eligibleByMinScore(report.userRows, lotteryMinPercent);
    const ids = new Set(eligible.map((r) => r.userId));
    setLotteryExcludedIds((prev) => prev.filter((id) => ids.has(id)));
  }, [report, lotteryMinPercent]);

  const toggleLotteryExcluded = useCallback((userId: string) => {
    setLotteryExcludedIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]
    );
    setLotteryWinners(null);
    setLotteryNotice(null);
  }, []);

  const runLottery = useCallback(() => {
    if (!report) return;
    const n = Math.floor(Number(lotteryDrawCount));
    if (!Number.isFinite(n) || n < 1) {
      setLotteryNotice("추첨 인원은 1 이상의 정수로 입력하세요.");
      setLotteryWinners(null);
      return;
    }
    const elig = eligibleByMinScore(report.userRows, lotteryMinPercent);
    const pool = excludeUserIdsFromPool(elig, new Set(lotteryExcludedIds));
    if (pool.length === 0) {
      setLotteryNotice("추첨 가능한 인원이 없습니다. 최소 점수 또는 제외 설정을 확인하세요.");
      setLotteryWinners(null);
      return;
    }
    setLotteryNotice(null);
    setLotteryWinners(drawRandomSubset(pool, n));
  }, [report, lotteryDrawCount, lotteryMinPercent, lotteryExcludedIds]);

  const companySelectOptions = useMemo(() => {
    const s = new Set(companies);
    if (selectedCompany !== "all") s.add(selectedCompany);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ko"));
  }, [companies, selectedCompany]);

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

  if (fetching && !report) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>;
  }

  if (!report) {
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

  const lotteryEligible = eligibleByMinScore(report.userRows, lotteryMinPercent);
  const lotteryPool = excludeUserIdsFromPool(lotteryEligible, new Set(lotteryExcludedIds));

  const searchQ = userSearch.trim().toLowerCase();
  const filteredUserRows = !searchQ
    ? report.userRows
    : report.userRows.filter((u) => {
        const blob = [u.username, u.name ?? "", u.department, u.company].join(" ").toLowerCase();
        return blob.includes(searchQ);
      });

  const scopeLabel = fetching
    ? selectedCompany === "all"
      ? "전체 회사"
      : `회사 ${selectedCompany}`
    : report.companyFilter === null
      ? "전체 회사"
      : `회사 ${report.companyFilter}`;

  return (
    <div className={`space-y-10${fetching ? " opacity-70" : ""}`} aria-busy={fetching || undefined}>
      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200/95" role="alert">
          {error}
        </p>
      ) : null}
      {fetching ? (
        <p className="text-sm text-amber-200/90" role="status">
          현황을 불러오는 중…
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--muted)]">퀴즈 응시 현황</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{report.quiz.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            문항 풀 {report.quiz.questionCount}개
            {report.quiz.questionsPerAttempt != null
              ? ` · 응시당 ${report.quiz.questionsPerAttempt}개 무작위 출제`
              : ""}
            {" · "}
            <span className="text-blue-200/90">조회: {scopeLabel}</span>
          </p>
          <div className="mt-3 flex w-full max-w-md flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">소속 회사</span>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none"
              >
                <option value="all">전체 (모든 회사)</option>
                {companySelectOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[var(--muted)]">
              목록은 등록된 계정의 소속회사·환경 변수 <code className="text-blue-200/90">REPORT_COMPANY_CODES</code>
              로 채워집니다. 사용자 일괄 등록 시 엑셀 <strong className="text-[var(--text)]">E열</strong>(또는 E가 비면{" "}
              <strong className="text-[var(--text)]">F열</strong>)에 회사 코드를 넣어야 합니다. 빈 칸은 모두{" "}
              <code className="text-blue-200/90">IND</code>로 저장됩니다.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">목록에 없는 코드로 조회</span>
                <input
                  type="text"
                  value={customCompanyDraft}
                  onChange={(e) => setCustomCompanyDraft(e.target.value)}
                  placeholder="예: ACME"
                  className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:border-blue-500/50 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const code = customCompanyDraft.trim();
                  if (!code) return;
                  setSelectedCompany(code);
                }}
                className="rounded-md border border-blue-600/50 bg-blue-950/40 px-3 py-2 text-sm text-blue-100 hover:border-blue-400/50 hover:text-white"
              >
                이 코드로 조회
              </button>
            </div>
          </div>
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
        대상은 <strong className="text-white">역할이 &quot;사용자&quot;인 계정</strong>만 포함됩니다. 위에서{" "}
        <strong className="text-white">소속 회사</strong>를 고르면 해당 회사 소속만 집계·추첨 대상에 넣을 수 있습니다
        (전체 선택 시 모든 회사). 사용자당 퀴즈당 <strong className="text-white">1회 제출</strong>만 허용됩니다. 제출이
        곧 관리자 접수(저장)됩니다.
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

      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="응시 현황 상세"
          className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {REPORT_TABS.map((t) => {
            const selected = detailTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`report-tab-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setDetailTab(t.id)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "border-blue-500/55 bg-blue-600 text-white"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-blue-500/35 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {detailTab === "deptCompletion" && (
          <section
            role="tabpanel"
            aria-labelledby="report-tab-deptCompletion"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
          >
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
        )}

        {detailTab === "deptScores" && (
          <section
            role="tabpanel"
            aria-labelledby="report-tab-deptScores"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
          >
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
        )}

        {detailTab === "histograms" && (
          <section
            role="tabpanel"
            aria-labelledby="report-tab-histograms"
            className="space-y-6"
          >
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="text-lg font-semibold text-white">정답 개수별 인원</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">막대 길이는 해당 인원 수의 상대 비율입니다.</p>
              <ul className="mt-4 space-y-2">
                {report.correctCountHistogram.map((h) => (
                  <li key={h.correct} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 tabular-nums text-[var(--muted)]">
                      {h.correct}개 (
                      {report.quiz.histogramDenominator
                        ? Math.round((h.correct / report.quiz.histogramDenominator) * 100)
                        : 0}
                      %)
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
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
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
            </div>
          </section>
        )}

        {detailTab === "users" && (
          <section
            role="tabpanel"
            aria-labelledby="report-tab-users"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-lg font-semibold text-white">대상자별 현황</h2>
              <label className="flex w-full flex-col gap-1 sm:w-72">
                <span className="text-xs text-[var(--muted)]">사용자 검색 (아이디·이름·부서·회사)</span>
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
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="sticky top-0 z-[1] bg-[var(--card)]">
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">아이디</th>
                    <th className="py-2 pr-3 font-medium">이름</th>
                    <th className="py-2 pr-3 font-medium">부서</th>
                    <th className="py-2 pr-3 font-medium">회사</th>
                    <th className="py-2 pr-3 font-medium">상태</th>
                    <th className="py-2 pr-3 font-medium tabular-nums">점수</th>
                    <th className="py-2 pr-3 font-medium">제출 시각</th>
                    <th className="py-2 font-medium">문항별</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUserRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[var(--muted)]">
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
                          <td className="py-2 pr-3 text-[var(--muted)]">{u.company}</td>
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
                            <td colSpan={8} className="px-3 py-3">
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
        )}

        {detailTab === "lottery" && (
          <section
            role="tabpanel"
            aria-labelledby="report-tab-lottery"
            className="rounded-lg border border-violet-900/35 bg-[var(--card)] p-6"
          >
            <h2 className="text-lg font-semibold text-white">점수 기준 랜덤 추첨</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              응시 완료자만 대상입니다. 위에서 선택한 <strong className="text-[var(--text)]">소속 회사</strong> 범위 안의
              사용자만 풀에 포함됩니다. 지정한 점수(%) 이상인 사람 중에서, 아래에서 &quot;추첨에서 제외&quot;로 표시한
              사람을 뺀 뒤 무작위로 뽑습니다.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">최소 점수 (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={Number.isFinite(lotteryMinPercent) ? lotteryMinPercent : 0}
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    setLotteryMinPercent(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);
                    setLotteryWinners(null);
                    setLotteryNotice(null);
                  }}
                  className="w-28 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-white tabular-nums focus:border-violet-500/50 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">추첨 인원</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={lotteryDrawCount}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    setLotteryDrawCount(Number.isFinite(v) && v >= 1 ? v : 1);
                    setLotteryWinners(null);
                    setLotteryNotice(null);
                  }}
                  className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-white tabular-nums focus:border-violet-500/50 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runLottery()}
                  className="rounded-lg border border-violet-600/55 bg-violet-950/45 px-4 py-2 text-sm text-violet-100 hover:border-violet-400/50 hover:text-white"
                >
                  추첨 실행
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLotteryExcludedIds([]);
                    setLotteryWinners(null);
                    setLotteryNotice(null);
                  }}
                  disabled={lotteryExcludedIds.length === 0}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  제외 전체 해제
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLotteryWinners(null);
                    setLotteryNotice(null);
                  }}
                  disabled={!lotteryWinners?.length && !lotteryNotice}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  결과·안내 지우기
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--text)]">
              점수 기준 충족{" "}
              <span className="font-semibold tabular-nums text-white">{lotteryEligible.length}</span>명 · 제외 후 풀{" "}
              <span className="font-semibold tabular-nums text-white">{lotteryPool.length}</span>명
              {lotteryDrawCount > lotteryPool.length && lotteryPool.length > 0 ? (
                <span className="ml-2 text-amber-200/90">
                  (요청 {lotteryDrawCount}명 → 풀 인원만큼만 추첨됩니다)
                </span>
              ) : null}
            </p>
            {lotteryNotice ? (
              <p className="mt-2 text-sm text-amber-200/90">{lotteryNotice}</p>
            ) : null}
            {lotteryWinners && lotteryWinners.length > 0 ? (
              <div className="mt-4 rounded-md border border-emerald-800/45 bg-emerald-950/25 p-4">
                <p className="text-sm font-medium text-emerald-100/95">추첨 결과</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
                  {lotteryWinners.map((u) => (
                    <li key={u.userId}>
                      <span className="text-white">{u.username}</span>
                      {u.name ? <span className="text-[var(--muted)]"> ({u.name})</span> : null}
                      <span className="text-[var(--muted)]"> · {u.department}</span>
                      <span className="text-[var(--muted)]"> · {u.company}</span>
                      <span className="tabular-nums text-blue-200/85">
                        {" "}
                        · {u.correct}/{u.total} ({u.scorePercent}%)
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {lotteryEligible.length === 0 ? (
              <p className="mt-4 text-sm text-amber-200/85">이 최소 점수를 만족하는 응시 완료자가 없습니다.</p>
            ) : (
              <div className="mt-4 max-h-56 overflow-auto rounded-md border border-[var(--border)]">
                <ul className="divide-y divide-[var(--border)]/60 text-sm">
                  {lotteryEligible.map((u) => {
                    const excluded = lotteryExcludedIds.includes(u.userId);
                    return (
                      <li
                        key={u.userId}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 ${
                          excluded ? "bg-[var(--bg)]/80 opacity-70" : ""
                        }`}
                      >
                        <label className="flex cursor-pointer items-center gap-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={excluded}
                            onChange={() => toggleLotteryExcluded(u.userId)}
                            className="rounded border-[var(--border)]"
                          />
                          <span className="text-xs text-[var(--muted)]">추첨에서 제외</span>
                        </label>
                        <span className="font-medium text-white">{u.username}</span>
                        <span className="text-[var(--muted)]">{u.name ?? "—"}</span>
                        <span className="text-[var(--muted)]">{u.department}</span>
                        <span className="text-[var(--muted)]">{u.company}</span>
                        <span className="ml-auto tabular-nums text-blue-200/90">
                          {u.correct}/{u.total} ({u.scorePercent}%)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
