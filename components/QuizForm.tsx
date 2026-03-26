"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from "@/lib/quiz-availability";
import type { Question } from "@/lib/types";

export type QuestionDraft = {
  id?: string;
  kind: "choice" | "short";
  prompt: string;
  timeLimitSec: number;
  choices: string[];
  correctIndex: number;
  acceptableAnswers: string[];
  /** 오답 시 응시자에게 보일 안내 */
  wrongAnswerExplain: string;
};

type Props = {
  mode: "create" | "edit";
  quizId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialQuestions?: QuestionDraft[];
  /** ISO 문자열 또는 null — 풀이 기간 시작 */
  initialAvailableFrom?: string | null;
  initialAvailableUntil?: string | null;
  /** 비우면 전체 문항·등록 순서. 숫자면 응시자마다 해당 개수만큼 무작위 출제 */
  initialQuestionsPerAttempt?: number | null;
};

export function questionToDraft(q: Question): QuestionDraft {
  const explain = q.wrongAnswerExplain ?? "";
  if (q.kind === "short") {
    return {
      id: q.id,
      kind: "short",
      prompt: q.prompt,
      timeLimitSec: q.timeLimitSec,
      choices: ["", ""],
      correctIndex: 0,
      acceptableAnswers: q.acceptableAnswers.length > 0 ? [...q.acceptableAnswers] : [""],
      wrongAnswerExplain: explain,
    };
  }
  return {
    id: q.id,
    kind: "choice",
    prompt: q.prompt,
    timeLimitSec: q.timeLimitSec,
    choices: [...q.choices],
    correctIndex: q.correctIndex,
    acceptableAnswers: [""],
    wrongAnswerExplain: explain,
  };
}

function emptyQuestion(): QuestionDraft {
  return {
    kind: "choice",
    prompt: "",
    timeLimitSec: 0,
    choices: ["", ""],
    correctIndex: 0,
    acceptableAnswers: [""],
    wrongAnswerExplain: "",
  };
}

function clampTimeInput(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(3600, Math.floor(n));
}

export function QuizForm({
  mode,
  quizId,
  initialTitle = "",
  initialDescription = "",
  initialQuestions,
  initialAvailableFrom = null,
  initialAvailableUntil = null,
  initialQuestionsPerAttempt = null,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [availableFromLocal, setAvailableFromLocal] = useState(() => isoToDatetimeLocalValue(initialAvailableFrom));
  const [availableUntilLocal, setAvailableUntilLocal] = useState(() => isoToDatetimeLocalValue(initialAvailableUntil));
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions && initialQuestions.length > 0 ? initialQuestions : [emptyQuestion()]
  );
  const [questionsPerAttemptInput, setQuestionsPerAttemptInput] = useState(
    initialQuestionsPerAttempt != null ? String(initialQuestionsPerAttempt) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addQuestion() {
    setQuestions((q) => [...q, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    setQuestions((q) => (q.length <= 1 ? q : q.filter((_, j) => j !== i)));
  }

  function patchQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((q) => q.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function setPrompt(i: number, prompt: string) {
    patchQuestion(i, { prompt });
  }

  function setKind(i: number, kind: "choice" | "short") {
    setQuestions((q) =>
      q.map((row, j) => {
        if (j !== i) return row;
        if (kind === "short") {
          return {
            ...row,
            kind: "short",
            acceptableAnswers: row.acceptableAnswers.length ? row.acceptableAnswers : [""],
            wrongAnswerExplain: row.wrongAnswerExplain ?? "",
          };
        }
        return {
          ...row,
          kind: "choice",
          choices: row.choices.length >= 2 ? row.choices : ["", ""],
          correctIndex: 0,
          wrongAnswerExplain: row.wrongAnswerExplain ?? "",
        };
      })
    );
  }

  function setChoice(i: number, ci: number, value: string) {
    setQuestions((q) =>
      q.map((row, j) => {
        if (j !== i) return row;
        const choices = [...row.choices];
        choices[ci] = value;
        return { ...row, choices };
      })
    );
  }

  function addChoice(i: number) {
    setQuestions((q) =>
      q.map((row, j) => (j === i ? { ...row, choices: [...row.choices, ""] } : row))
    );
  }

  function removeChoice(i: number, ci: number) {
    setQuestions((q) =>
      q.map((row, j) => {
        if (j !== i) return row;
        if (row.choices.length <= 2) return row;
        const choices = row.choices.filter((_, k) => k !== ci);
        let correctIndex = row.correctIndex;
        if (ci === correctIndex) correctIndex = 0;
        else if (ci < correctIndex) correctIndex -= 1;
        if (correctIndex >= choices.length) correctIndex = choices.length - 1;
        return { ...row, choices, correctIndex };
      })
    );
  }

  function setCorrect(i: number, correctIndex: number) {
    patchQuestion(i, { correctIndex });
  }

  function setAcceptableLine(i: number, li: number, value: string) {
    setQuestions((q) =>
      q.map((row, j) => {
        if (j !== i || row.kind !== "short") return row;
        const acceptableAnswers = [...row.acceptableAnswers];
        acceptableAnswers[li] = value;
        return { ...row, acceptableAnswers };
      })
    );
  }

  function addAcceptableLine(i: number) {
    setQuestions((q) =>
      q.map((row, j) => (j === i && row.kind === "short" ? { ...row, acceptableAnswers: [...row.acceptableAnswers, ""] } : row))
    );
  }

  function removeAcceptableLine(i: number, li: number) {
    setQuestions((q) =>
      q.map((row, j) => {
        if (j !== i || row.kind !== "short") return row;
        if (row.acceptableAnswers.length <= 1) return row;
        const acceptableAnswers = row.acceptableAnswers.filter((_, k) => k !== li);
        return { ...row, acceptableAnswers };
      })
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fromIso = datetimeLocalValueToIso(availableFromLocal);
    const untilIso = datetimeLocalValueToIso(availableUntilLocal);
    if ((availableFromLocal.trim() || availableUntilLocal.trim()) && (!fromIso || !untilIso)) {
      setError("풀이 기간을 쓸 때는 시작·종료를 모두 올바르게 입력하세요. 제한 없이 두려면 둘 다 비우세요.");
      return;
    }
    if (fromIso && untilIso && new Date(fromIso).getTime() >= new Date(untilIso).getTime()) {
      setError("종료 시각은 시작 시각보다 늦어야 합니다.");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      availableFrom: fromIso,
      availableUntil: untilIso,
      questions: questions.map((q) => {
        const timeLimitSec = clampTimeInput(q.timeLimitSec);
        const explain = (q.wrongAnswerExplain ?? "").trim();
        const explainField = explain ? { wrongAnswerExplain: explain } : {};
        if (q.kind === "short") {
          return {
            id: q.id,
            kind: "short" as const,
            prompt: q.prompt.trim(),
            timeLimitSec,
            acceptableAnswers: q.acceptableAnswers.map((s) => s.trim()).filter(Boolean),
            ...explainField,
          };
        }
        return {
          id: q.id,
          kind: "choice" as const,
          prompt: q.prompt.trim(),
          timeLimitSec,
          choices: q.choices.map((c) => c.trim()).filter(Boolean),
          correctIndex: q.correctIndex,
          ...explainField,
        };
      }),
    };

    for (const q of payload.questions) {
      if (!q.prompt) {
        setError("모든 문항에 질문을 입력하세요.");
        return;
      }
      if (q.kind === "short") {
        if (q.acceptableAnswers.length < 1) {
          setError("주관식 문항에는 허용 정답을 1개 이상 입력하세요.");
          return;
        }
      } else {
        if (q.choices.length < 2) {
          setError("객관식 문항에는 선택지를 2개 이상 입력하세요.");
          return;
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.choices.length) {
          setError("객관식 문항에서 정답을 선택하세요.");
          return;
        }
      }
    }

    if (!payload.title) {
      setError("퀴즈 제목을 입력하세요.");
      return;
    }

    const pool = payload.questions.length;
    const qpaTrim = questionsPerAttemptInput.trim();
    let questionsPerAttempt: number | null = null;
    if (qpaTrim !== "") {
      const n = Number.parseInt(qpaTrim, 10);
      if (!Number.isFinite(n) || n < 1 || n > pool) {
        setError(`출제 문항 수는 1~${pool} 사이 정수이거나 비워 두세요(전체 문항·순서 고정).`);
        return;
      }
      questionsPerAttempt = n;
    }

    setSaving(true);
    try {
      const url = mode === "create" ? "/api/admin/quizzes" : `/api/admin/quizzes/${quizId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, questionsPerAttempt }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{mode === "create" ? "퀴즈 등록" : "퀴즈 수정"}</h1>
        <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-white">
          ← 목록
        </Link>
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--muted)]">응시 시 출제 문항 수 (선택)</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, questions.length)}
            value={questionsPerAttemptInput}
            onChange={(e) => setQuestionsPerAttemptInput(e.target.value)}
            placeholder="비우면 전체 문항"
            className="mt-1 w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            숫자를 넣으면 등록한 문항 풀에서 응시자마다 그 개수만큼 무작위로 뽑아 출제합니다. 새로고침해도 같은 사람에게는 같은
            문항이 유지됩니다. 비우면 예전처럼 전체 문항이 등록 순서대로 나갑니다. 개수를 풀과 같게 하면 전체가 나가되 순서만
            사람마다 다릅니다.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] border-dashed bg-[var(--bg)]/50 p-3">
          <p className="text-sm font-medium text-white">풀이 가능 기간</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            사용자는 이 기간에만 퀴즈를 볼 수 있고 제출할 수 있습니다. 둘 다 비우면 상시 오픈(기존과 동일)입니다.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--muted)]">
              시작 일시
              <input
                type="datetime-local"
                value={availableFromLocal}
                onChange={(e) => setAvailableFromLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              종료 일시
              <input
                type="datetime-local"
                value={availableUntilLocal}
                onChange={(e) => setAvailableUntilLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">문항</h2>
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white"
          >
            문항 추가
          </button>
        </div>

        {questions.map((q, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium text-blue-300">문항 {i + 1}</span>
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                disabled={questions.length <= 1}
                className="text-xs text-red-300 hover:underline disabled:opacity-30"
              >
                삭제
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="text-xs text-[var(--muted)]">
                유형{" "}
                <select
                  value={q.kind}
                  onChange={(e) => setKind(i, e.target.value as "choice" | "short")}
                  className="ml-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                >
                  <option value="choice">객관식</option>
                  <option value="short">주관식</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                제한 시간(초)
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={q.timeLimitSec}
                  onChange={(e) => patchQuestion(i, { timeLimitSec: clampTimeInput(Number(e.target.value)) })}
                  className="w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--text)]"
                />
                <span className="text-[var(--muted)]">0 = 제한 없음</span>
              </label>
            </div>

            <textarea
              placeholder="질문 내용"
              value={q.prompt}
              onChange={(e) => setPrompt(i, e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />

            {q.kind === "choice" ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--muted)]">선택지 (정답에 체크)</p>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correctIndex === ci}
                      onChange={() => setCorrect(i, ci)}
                      className="h-4 w-4 border-[var(--border)] text-blue-600"
                    />
                    <input
                      value={c}
                      onChange={(e) => setChoice(i, ci, e.target.value)}
                      placeholder={`선택지 ${ci + 1}`}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeChoice(i, ci)}
                      disabled={q.choices.length <= 2}
                      className="text-xs text-[var(--muted)] hover:text-red-300 disabled:opacity-30"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addChoice(i)} className="text-xs text-blue-300 hover:underline">
                  선택지 추가
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[var(--muted)]">
                  허용 정답 (줄마다 하나. 공백·대소문자는 채점 시 무시하고 비교합니다)
                </p>
                {q.acceptableAnswers.map((line, li) => (
                  <div key={li} className="flex gap-2">
                    <input
                      value={line}
                      onChange={(e) => setAcceptableLine(i, li, e.target.value)}
                      placeholder={`정답 ${li + 1}`}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeAcceptableLine(i, li)}
                      disabled={q.acceptableAnswers.length <= 1}
                      className="text-xs text-[var(--muted)] hover:text-red-300 disabled:opacity-30"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addAcceptableLine(i)} className="text-xs text-blue-300 hover:underline">
                  허용 정답 줄 추가
                </button>
              </div>
            )}

            <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 p-3">
              <label className="text-xs font-medium text-amber-100/90">오답 시 응시자 안내 (선택)</label>
              <p className="mt-1 text-xs text-[var(--muted)]">
                이 문항이 <span className="text-amber-200/80">오답</span>으로 채점되면, 아래 내용이 정답·내 답과 함께
                표시됩니다. 해설·근거·보안 수칙 등을 적을 수 있습니다.
              </p>
              <textarea
                value={q.wrongAnswerExplain ?? ""}
                onChange={(e) => patchQuestion(i, { wrongAnswerExplain: e.target.value })}
                rows={3}
                placeholder="예: 올바른 조치는 ○○입니다. 내부 가이드 3장을 참고하세요."
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
