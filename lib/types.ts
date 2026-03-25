export type UserRole = "admin" | "user";

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  /** 표시용 이름 (엑셀 일괄 등록 등) */
  name?: string;
  /** 소속 부서 */
  department?: string;
};

/** 객관식 */
export type QuestionChoice = {
  id: string;
  kind: "choice";
  prompt: string;
  /** 0이면 제한 없음 (초) */
  timeLimitSec: number;
  choices: string[];
  correctIndex: number;
};

/** 주관식 — 허용 답안은 공백·대소문자 정규화 후 하나라도 일치하면 정답 */
export type QuestionShort = {
  id: string;
  kind: "short";
  prompt: string;
  /** 0이면 제한 없음 (초) */
  timeLimitSec: number;
  acceptableAnswers: string[];
};

export type Question = QuestionChoice | QuestionShort;

export type Quiz = {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
  createdBy: string;
  /** ISO 8601, 풀이 가능 시작(포함). null/없음이면 시작 제한 없음 */
  availableFrom?: string | null;
  /** ISO 8601, 풀이 가능 종료(포함). null/없음이면 종료 제한 없음 */
  availableUntil?: string | null;
};

/** 퀴즈 제출 1건 (사용자당 퀴즈당 1회만 허용) */
export type QuizSubmission = {
  id: string;
  quizId: string;
  userId: string;
  submittedAt: string;
  total: number;
  correct: number;
};

export type AppStore = {
  users: User[];
  quizzes: Quiz[];
  quizSubmissions: QuizSubmission[];
};
