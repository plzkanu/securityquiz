import { randomInt } from "crypto";
import type { Question, Quiz } from "./types";

/** 응시 시 실제 출제 문항 수 */
export function attemptQuestionCount(quiz: Quiz): number {
  const pool = quiz.questions.length;
  if (pool === 0) return 0;
  const per = quiz.questionsPerAttempt;
  if (per == null || !Number.isFinite(per)) return pool;
  const n = Math.floor(per);
  if (n < 1) return pool;
  return Math.min(n, pool);
}

/** API 본문에서 출제 문항 수. 비우면 undefined(전체·고정 순서). */
export function parseQuestionsPerAttemptFromAdminBody(
  body: Record<string, unknown>,
  poolSize: number
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const raw = body.questionsPerAttempt;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: undefined };
  }
  const n = typeof raw === "number" ? Math.floor(raw) : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1 || n > poolSize) {
    return { ok: false, error: `출제 문항 수는 1~${poolSize} 사이 정수이거나 비워 두세요(전체 문항).` };
  }
  return { ok: true, value: n };
}

export function usesRandomAttempt(quiz: Quiz): boolean {
  return quiz.questionsPerAttempt != null && Number.isFinite(quiz.questionsPerAttempt);
}

function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** 풀에서 count개 무작위 추출(순서도 무작위). count === ids.length 이면 전체를 섞은 것과 동일 */
export function drawQuestionIds(poolIds: string[], count: number): string[] {
  if (count <= 0 || poolIds.length === 0) return [];
  const shuffled = shuffleIds(poolIds);
  return shuffled.slice(0, Math.min(count, poolIds.length));
}

export function isDrawValidForQuiz(questionIds: string[], quiz: Quiz): boolean {
  const set = new Set(quiz.questions.map((q) => q.id));
  const need = attemptQuestionCount(quiz);
  if (need === 0) return false;
  if (questionIds.length !== need) return false;
  return questionIds.every((id) => set.has(id));
}

export function questionsByIds(quiz: Quiz, ids: string[]): Question[] {
  const map = new Map(quiz.questions.map((q) => [q.id, q] as const));
  return ids.map((id) => map.get(id)).filter((q): q is Question => q != null);
}

export function toPublicQuestions(questions: Question[]) {
  return questions.map((q) => {
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
}
