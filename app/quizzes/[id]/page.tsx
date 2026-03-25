"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { QuizResultDetail } from "@/lib/quiz-result-details";
import { useCallback, useEffect, useRef, useState } from "react";

type PublicQuestionChoice = {
  id: string;
  kind: "choice";
  prompt: string;
  timeLimitSec: number;
  choices: string[];
};

type PublicQuestionShort = {
  id: string;
  kind: "short";
  prompt: string;
  timeLimitSec: number;
};

type PublicQuestion = PublicQuestionChoice | PublicQuestionShort;

type QuizPublic = {
  id: string;
  title: string;
  description: string;
  questions: PublicQuestion[];
};

/** 객관식: number | null, 주관식: string */
type AnswerSlot = number | null | string;

function QuizResultReviewList({
  quiz,
  details,
  heading,
}: {
  quiz: QuizPublic;
  details: QuizResultDetail[];
  heading: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-base font-semibold text-white">{heading}</h2>
      <ul className="mt-3 space-y-4 text-sm">
        {quiz.questions.map((qq, i) => {
          const d = details[i];
          if (!d) return null;
          return (
            <li key={qq.id} className="border-b border-[var(--border)]/80 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={d.correct ? "text-green-400" : "text-red-300"}>{d.correct ? "○" : "×"}</span>
                <span className="text-[var(--muted)]">문항 {i + 1}</span>
                <span className="text-xs text-[var(--muted)]">({qq.kind === "choice" ? "객관식" : "주관식"})</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[var(--text)]">{qq.prompt}</p>
              {d.kind === "choice" ? (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-[var(--muted)]">
                    내가 선택한 답:{" "}
                    <span className="text-[var(--text)]">{d.selectedLabel ?? "선택 없음"}</span>
                  </p>
                  {!d.correct ? (
                    <>
                      <p className="text-[var(--muted)]">
                        정답: <span className="text-emerald-200/90">{d.correctChoiceText}</span>
                      </p>
                      {d.wrongAnswerExplain ? (
                        <div className="mt-2 rounded-md border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-sm">
                          <p className="text-xs font-medium text-amber-200/90">안내</p>
                          <p className="mt-1 whitespace-pre-wrap text-[var(--text)]">{d.wrongAnswerExplain}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-green-200/85">
                      정답입니다. ({d.correctChoiceText})
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-[var(--muted)]">
                    내가 입력한 답:{" "}
                    <span className="text-[var(--text)]">{d.userAnswer.trim() ? d.userAnswer : "(미입력)"}</span>
                  </p>
                  {!d.correct ? (
                    <>
                      <p className="text-[var(--muted)]">
                        참고 정답: <span className="text-emerald-200/90">{d.referenceAnswer || "—"}</span>
                      </p>
                      {d.wrongAnswerExplain ? (
                        <div className="mt-2 rounded-md border border-amber-800/40 bg-amber-950/25 px-3 py-2 text-sm">
                          <p className="text-xs font-medium text-amber-200/90">안내</p>
                          <p className="mt-1 whitespace-pre-wrap text-[var(--text)]">{d.wrongAnswerExplain}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-green-200/85">정답으로 인정된 답안입니다.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function TakeQuizPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerSlot[]>([]);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    total: number;
    correct: number;
    details: QuizResultDetail[];
  } | null>(null);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const [noticeDeclined, setNoticeDeclined] = useState(false);
  const [priorSubmission, setPriorSubmission] = useState<{
    total: number;
    correct: number;
    submittedAt: string;
    details: QuizResultDetail[] | null;
  } | null>(null);

  const quizRef = useRef(quiz);
  const indexRef = useRef(index);
  const answersRef = useRef(answers);
  quizRef.current = quiz;
  indexRef.current = index;
  answersRef.current = answers;

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    const res = await fetch(`/api/quizzes/${id}`);
    if (!res.ok) {
      let msg = "퀴즈를 불러올 수 없습니다.";
      try {
        const err = (await res.json()) as {
          error?: string;
          code?: string;
          availableFrom?: string | null;
          availableUntil?: string | null;
        };
        if (err.error) msg = err.error;
        if (err.code === "OUT_OF_WINDOW" && (err.availableFrom || err.availableUntil)) {
          const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR");
          msg += ` (${err.availableFrom ? fmt(err.availableFrom) : "—"} ~ ${err.availableUntil ? fmt(err.availableUntil) : "—"})`;
        }
      } catch {
        /* ignore */
      }
      setLoadError(msg);
      return;
    }
    const data = (await res.json()) as {
      quiz: QuizPublic;
      alreadyCompleted?: boolean;
      submission?: {
        total: number;
        correct: number;
        submittedAt: string;
        details?: QuizResultDetail[] | null;
      };
    };
    setSubmitError(null);
    if (data.alreadyCompleted && data.submission) {
      setPriorSubmission({
        total: data.submission.total,
        correct: data.submission.correct,
        submittedAt: data.submission.submittedAt,
        details: data.submission.details ?? null,
      });
      setQuiz(data.quiz);
      setAnswers([]);
      setIndex(0);
      setResult(null);
      setRemainingSec(null);
      setNoticeAcknowledged(true);
      setNoticeDeclined(false);
      return;
    }
    setPriorSubmission(null);
    setQuiz(data.quiz);
    setAnswers(data.quiz.questions.map((qq) => (qq.kind === "choice" ? null : "")));
    setIndex(0);
    setResult(null);
    setRemainingSec(null);
    setNoticeAcknowledged(false);
    setNoticeDeclined(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = quiz?.questions[index];
  const total = quiz?.questions.length ?? 0;
  const isLast = index >= total - 1;

  const submitPayload = useCallback(() => {
    const Q = quizRef.current;
    if (!Q) return;
    const payload = answersRef.current.map((a, i) => {
      const qq = Q.questions[i];
      if (qq.kind === "choice") {
        return typeof a === "number" ? a : -1;
      }
      return typeof a === "string" ? a : "";
    });
    return { quizId: Q.id, payload };
  }, []);

  const runSubmit = useCallback(async () => {
    const built = submitPayload();
    if (!built) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/quizzes/${built.quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: built.payload }),
      });
      if (!res.ok) {
        try {
          const err = (await res.json()) as {
            error?: string;
            code?: string;
            availableFrom?: string | null;
            availableUntil?: string | null;
          };
          if (err.code === "OUT_OF_WINDOW") {
            const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR");
            setSubmitError(
              `${err.error || "기간이 아닙니다."} (${err.availableFrom ? fmt(err.availableFrom) : "—"} ~ ${err.availableUntil ? fmt(err.availableUntil) : "—"})`
            );
          } else if (err.code === "ALREADY_SUBMITTED") {
            setSubmitError(err.error || "이미 제출한 퀴즈입니다.");
          } else {
            setSubmitError(err.error || "채점에 실패했습니다.");
          }
        } catch {
          setSubmitError("채점에 실패했습니다.");
        }
        return;
      }
      const data = (await res.json()) as {
        total: number;
        correct: number;
        details: QuizResultDetail[];
      };
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  }, [submitPayload]);

  const handleTimeUpRef = useRef<() => void>(() => {});

  useEffect(() => {
    handleTimeUpRef.current = () => {
      const Q = quizRef.current;
      const idx = indexRef.current;
      if (!Q || result) return;
      const qq = Q.questions[idx];
      if (qq.kind === "choice" && answersRef.current[idx] === null) {
        /* 미선택 → 오답 처리 위해 그대로 null 유지 */
      }
      const last = idx >= Q.questions.length - 1;
      if (last) {
        void runSubmit();
      } else {
        setIndex((i) => i + 1);
      }
    };
  }, [result, runSubmit]);

  useEffect(() => {
    if (!quiz || result || !noticeAcknowledged) {
      setRemainingSec(null);
      return;
    }
    const qq = quiz.questions[index];
    const limit = qq.timeLimitSec;
    if (!limit || limit <= 0) {
      setRemainingSec(null);
      return;
    }
    setRemainingSec(limit);
    const tick = setInterval(() => {
      setRemainingSec((r) => {
        if (r === null) return r;
        if (r <= 1) {
          clearInterval(tick);
          queueMicrotask(() => handleTimeUpRef.current());
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [index, quiz, result, noticeAcknowledged]);

  function selectChoice(ci: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = ci;
      return next;
    });
  }

  function setShortText(value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function canGoNext(): boolean {
    if (!q) return false;
    if (q.kind === "choice") return answers[index] !== null;
    return true;
  }

  function goNext() {
    if (!canGoNext()) return;
    if (!isLast) setIndex((i) => i + 1);
  }

  async function submit() {
    if (!quiz) return;
    const blocked = quiz.questions.some((qq, i) => qq.kind === "choice" && answers[i] === null);
    if (blocked) return;
    await runSubmit();
  }

  if (loadError && !quiz) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-red-400">{loadError}</p>
        <Link href="/quizzes" className="text-sm text-blue-300 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  if (!quiz) {
    return <p className="text-[var(--muted)]">불러오는 중…</p>;
  }

  if (priorSubmission) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">{quiz.title}</h1>
        {quiz.description ? <p className="text-sm text-[var(--muted)]">{quiz.description}</p> : null}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-lg text-[var(--text)]">이미 이 퀴즈를 제출하셨습니다. 재응시할 수 없습니다.</p>
          <p className="mt-4 text-lg text-[var(--text)]">
            기록된 점수:{" "}
            <span className="font-semibold text-blue-300">
              {priorSubmission.correct}
            </span>{" "}
            / {priorSubmission.total} 정답
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            제출 시각: {new Date(priorSubmission.submittedAt).toLocaleString("ko-KR")}
          </p>
        </div>
        {priorSubmission.details && priorSubmission.details.length === quiz.questions.length ? (
          <QuizResultReviewList quiz={quiz} details={priorSubmission.details} heading="문항별 채점 내역" />
        ) : (
          <p className="text-sm text-[var(--muted)]">
            이 제출에는 문항별 답안·해설이 저장되어 있지 않습니다. 이후 제출분부터 오답 해설·정답 안내가 표시됩니다.
          </p>
        )}
        <Link
          href="/quizzes"
          className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-white"
        >
          퀴즈 목록으로
        </Link>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">결과</h1>
        <p className="text-lg text-[var(--text)]">
          <span className="font-semibold text-blue-300">{result.correct}</span> / {result.total} 정답
        </p>
        <QuizResultReviewList quiz={quiz} details={result.details} heading="문항별 채점 내역" />
        <Link
          href="/quizzes"
          className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] hover:text-white"
        >
          퀴즈 목록으로
        </Link>
      </div>
    );
  }

  if (!noticeAcknowledged) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">{quiz.title}</h1>
          {quiz.description ? <p className="mt-1 text-sm text-[var(--muted)]">{quiz.description}</p> : null}
        </div>

        <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 p-6">
          <h2 className="text-lg font-semibold text-amber-100">시작 전 주의사항</h2>
          <ul className="mt-4 list-inside list-decimal space-y-3 text-sm text-[var(--text)]">
            <li>중간에 중단할 수 없습니다.</li>
            <li>
              시작 후 강제 종료(브라우저 닫기, PC 종료 등) 시 해당 시점까지 풀이한 내용만 저장됩니다.
            </li>
            <li>
              문항마다 제한 시간이 있습니다. 제한 시간 내에 풀이하지 못하면 다음 문항으로 자동으로 이동합니다.
            </li>
          </ul>

          <p className="mt-6 text-sm font-medium text-white">확인하셨습니까?</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setNoticeDeclined(false);
                setNoticeAcknowledged(true);
              }}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              예
            </button>
            <button
              type="button"
              onClick={() => {
                setNoticeDeclined(true);
                setNoticeAcknowledged(false);
              }}
              className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm text-[var(--muted)] hover:text-white"
            >
              아니오
            </button>
          </div>
          {noticeDeclined ? (
            <p className="mt-4 text-sm text-amber-200/90">
              퀴즈를 시작하지 않았습니다. 진행하려면 &quot;예&quot;를 선택하세요.
            </p>
          ) : (
            <p className="mt-4 text-xs text-[var(--muted)]">
              예를 선택하면 문제 풀이가 진행됩니다. 아니오를 선택하면 퀴즈를 시작하지 않습니다.
            </p>
          )}
        </div>

        <Link href="/quizzes" className="inline-block text-sm text-[var(--muted)] hover:text-white">
          ← 목록으로
        </Link>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">{quiz.title}</h1>
        <p className="text-[var(--muted)]">이 퀴즈에는 문항이 없습니다.</p>
        <Link href="/quizzes" className="text-sm text-blue-300 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const limit = q.timeLimitSec;
  const showTimer = limit > 0 && remainingSec !== null;
  const urgent = showTimer && remainingSec <= Math.min(10, Math.ceil(limit * 0.15));

  const choiceBlocked = q.kind === "choice" && answers[index] === null;
  const submitBlocked =
    submitting || quiz.questions.some((qq, i) => qq.kind === "choice" && answers[i] === null);

  return (
    <div className="space-y-6">
      {submitError && (
        <p className="whitespace-pre-wrap rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {submitError}
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{quiz.title}</h1>
          {quiz.description ? <p className="mt-1 text-sm text-[var(--muted)]">{quiz.description}</p> : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--muted)]">
            {index + 1} / {total}
          </p>
          {showTimer ? (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 font-mono text-lg font-semibold tabular-nums ${
                urgent
                  ? "border-red-500/60 bg-red-950/40 text-red-200"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-100"
              }`}
            >
              남은 시간 {remainingSec}초
            </div>
          ) : limit <= 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">이 문항은 시간 제한 없음</p>
          ) : null}
        </div>
      </div>

      {limit > 0 && (
        <p className="text-xs text-[var(--muted)]">
          이 문항은 <span className="text-amber-200/90">{limit}초</span> 안에 풀어야 합니다. 시간이 지나면 자동으로 다음 문항으로 넘어가며, 마지막 문항이면 제출됩니다.
        </p>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--bg)] px-2 py-0.5 text-xs text-blue-300">
            {q.kind === "choice" ? "객관식" : "주관식"}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[var(--text)]">{q.prompt}</p>

        {q.kind === "choice" ? (
          <div className="mt-6 space-y-2">
            {q.choices.map((c, ci) => (
              <button
                key={ci}
                type="button"
                onClick={() => selectChoice(ci)}
                className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                  answers[index] === ci
                    ? "border-blue-500 bg-blue-950/40 text-white"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-blue-500/40"
                }`}
              >
                <span className="mr-2 font-mono text-[var(--muted)]">{ci + 1}.</span>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <label htmlFor={`short-${q.id}`} className="text-sm text-[var(--muted)]">
              답안 입력
            </label>
            <input
              id={`short-${q.id}`}
              type="text"
              value={typeof answers[index] === "string" ? answers[index] : ""}
              onChange={(e) => setShortText(e.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)] outline-none focus:border-blue-500"
              placeholder="답을 입력하세요"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitBlocked}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40"
          >
            {submitting ? "채점 중…" : "제출"}
          </button>
        )}
      </div>

      {choiceBlocked && isLast && (
        <p className="text-xs text-amber-200/80">객관식 문항에서 선택 후 제출할 수 있습니다.</p>
      )}
    </div>
  );
}
