import { shortAnswerMatches } from "./questions";
import type { Question } from "./types";

export type QuizResultDetailChoice = {
  questionId: string;
  kind: "choice";
  correct: boolean;
  selectedIndex: number | null;
  /** 선택지 문구 (미선택이면 null) */
  selectedLabel: string | null;
  correctChoiceIndex: number;
  correctChoiceText: string;
  /** 오답 시 노출할 관리자 안내 (빈 문자열 가능) */
  wrongAnswerExplain: string;
};

export type QuizResultDetailShort = {
  questionId: string;
  kind: "short";
  correct: boolean;
  userAnswer: string;
  referenceAnswer: string;
  wrongAnswerExplain: string;
};

export type QuizResultDetail = QuizResultDetailChoice | QuizResultDetailShort;

function explainFromQuestion(q: Question): string {
  return q.wrongAnswerExplain?.trim() ?? "";
}

/** 제출 요청 answers를 저장용으로 정규화. 길이 불일치 시 null */
export function normalizeAnswersForStorage(quiz: Question[], answers: unknown[]): (number | string)[] | null {
  if (!Array.isArray(answers) || answers.length !== quiz.length) return null;
  return quiz.map((q, i) => {
    const raw = answers[i];
    if (q.kind === "choice") {
      const idx = typeof raw === "number" && Number.isInteger(raw) ? raw : Number.NaN;
      if (Number.isNaN(idx) || idx < 0 || idx >= q.choices.length) return -1;
      return idx;
    }
    return typeof raw === "string" ? raw : "";
  });
}

/** 채점 및 클라이언트 표시용 상세 (저장된 answers 또는 방금 정규화한 배열) */
export function buildQuizResultDetails(quiz: Question[], storedAnswers: (number | string)[]): QuizResultDetail[] {
  return quiz.map((q, i) => {
    const raw = storedAnswers[i];
    if (q.kind === "choice") {
      const idx = typeof raw === "number" && Number.isInteger(raw) ? raw : -1;
      const valid = idx >= 0 && idx < q.choices.length;
      const selectedIndex = valid ? idx : null;
      const ok = valid && idx === q.correctIndex;
      const correctChoiceText = q.choices[q.correctIndex] ?? "";
      return {
        questionId: q.id,
        kind: "choice" as const,
        correct: ok,
        selectedIndex,
        selectedLabel: valid ? q.choices[idx]! : null,
        correctChoiceIndex: q.correctIndex,
        correctChoiceText,
        wrongAnswerExplain: explainFromQuestion(q),
      };
    }
    const userAnswer = typeof raw === "string" ? raw : "";
    const ok = shortAnswerMatches(userAnswer, q.acceptableAnswers);
    return {
      questionId: q.id,
      kind: "short" as const,
      correct: ok,
      userAnswer,
      referenceAnswer: q.acceptableAnswers[0] ?? "",
      wrongAnswerExplain: explainFromQuestion(q),
    };
  });
}

export function scoreFromDetails(details: QuizResultDetail[]): { correct: number; total: number } {
  const total = details.length;
  const correct = details.filter((d) => d.correct).length;
  return { correct, total };
}
