import { randomUUID } from "crypto";
import type { Question, QuestionChoice, QuestionShort, Quiz } from "./types";

const MAX_TIME_SEC = 3600;

export function clampTimeLimitSec(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_TIME_SEC, Math.floor(n)));
}

export function normalizeShortAnswer(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function shortAnswerMatches(input: string, acceptable: string[]): boolean {
  const u = normalizeShortAnswer(input);
  if (!u) return false;
  return acceptable.some((a) => normalizeShortAnswer(a) === u);
}

/** 저장소에 남아 있는 구형 문항(JSON)을 현재 형식으로 맞춤 */
export function migrateQuestion(o: unknown): Question {
  if (!o || typeof o !== "object") {
    return {
      id: randomUUID(),
      kind: "choice",
      prompt: "",
      timeLimitSec: 0,
      choices: ["오류", "데이터"],
      correctIndex: 0,
    };
  }
  const r = o as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id ? r.id : randomUUID();
  const prompt = typeof r.prompt === "string" ? r.prompt : "";
  const timeLimitSec = clampTimeLimitSec(r.timeLimitSec);

  if (r.kind === "short") {
    const acceptableAnswers = Array.isArray(r.acceptableAnswers)
      ? r.acceptableAnswers.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
      : [];
    const explain =
      typeof r.wrongAnswerExplain === "string" && r.wrongAnswerExplain.trim()
        ? r.wrongAnswerExplain.trim()
        : undefined;
    return {
      id,
      kind: "short",
      prompt,
      timeLimitSec,
      acceptableAnswers: acceptableAnswers.length > 0 ? acceptableAnswers : ["(정답 미설정)"],
      ...(explain ? { wrongAnswerExplain: explain } : {}),
    };
  }

  const choices = Array.isArray(r.choices)
    ? r.choices.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const correctIndex = typeof r.correctIndex === "number" ? r.correctIndex : Number.NaN;
  const safeChoices = choices.length >= 2 ? choices : ["선택1", "선택2"];
  let idx = correctIndex;
  if (idx < 0 || idx >= safeChoices.length) idx = 0;
  const explain =
    typeof r.wrongAnswerExplain === "string" && r.wrongAnswerExplain.trim()
      ? r.wrongAnswerExplain.trim()
      : undefined;
  return {
    id,
    kind: "choice",
    prompt,
    timeLimitSec,
    choices: safeChoices,
    correctIndex: idx,
    ...(explain ? { wrongAnswerExplain: explain } : {}),
  };
}

export function migrateQuiz(quiz: Quiz): Quiz {
  const from = quiz.availableFrom;
  const until = quiz.availableUntil;
  const questions = quiz.questions.map((q) => migrateQuestion(q));
  const pool = questions.length;
  let questionsPerAttempt: number | null | undefined = quiz.questionsPerAttempt;
  if (questionsPerAttempt != null && questionsPerAttempt !== undefined) {
    const n = Math.floor(Number(questionsPerAttempt));
    if (!Number.isFinite(n) || n < 1 || pool === 0) questionsPerAttempt = undefined;
    else questionsPerAttempt = Math.min(n, pool);
  }
  return {
    ...quiz,
    availableFrom: typeof from === "string" && from ? from : null,
    availableUntil: typeof until === "string" && until ? until : null,
    questions,
    questionsPerAttempt: questionsPerAttempt === undefined ? undefined : questionsPerAttempt,
  };
}

export function parseQuestionsFromBody(raw: unknown): Question[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Question[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    const timeLimitSec = clampTimeLimitSec(o.timeLimitSec);
    const kind = o.kind === "short" ? "short" : "choice";
    const id = typeof o.id === "string" && o.id ? o.id : randomUUID();

    if (!prompt) return null;

    if (kind === "short") {
      let acceptable: string[] = [];
      if (Array.isArray(o.acceptableAnswers)) {
        acceptable = o.acceptableAnswers
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (acceptable.length === 0) return null;
      const explain =
        typeof o.wrongAnswerExplain === "string" && o.wrongAnswerExplain.trim()
          ? o.wrongAnswerExplain.trim()
          : undefined;
      const q: QuestionShort = {
        id,
        kind: "short",
        prompt,
        timeLimitSec,
        acceptableAnswers: acceptable,
        ...(explain ? { wrongAnswerExplain: explain } : {}),
      };
      out.push(q);
      continue;
    }

    const choices = Array.isArray(o.choices)
      ? o.choices.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      : [];
    const correctIndex = typeof o.correctIndex === "number" ? o.correctIndex : Number.NaN;
    if (choices.length < 2 || correctIndex < 0 || correctIndex >= choices.length) return null;
    const explain =
      typeof o.wrongAnswerExplain === "string" && o.wrongAnswerExplain.trim()
        ? o.wrongAnswerExplain.trim()
        : undefined;
    const q: QuestionChoice = {
      id,
      kind: "choice",
      prompt,
      timeLimitSec,
      choices,
      correctIndex,
      ...(explain ? { wrongAnswerExplain: explain } : {}),
    };
    out.push(q);
  }
  return out.length > 0 ? out : null;
}
