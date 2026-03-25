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
  /** 오답일 때 응시자에게 추가로 보여줄 안내(해설·근거 등). 관리자 작성 */
  wrongAnswerExplain?: string;
};

/** 주관식 — 허용 답안은 공백·대소문자 정규화 후 하나라도 일치하면 정답 */
export type QuestionShort = {
  id: string;
  kind: "short";
  prompt: string;
  /** 0이면 제한 없음 (초) */
  timeLimitSec: number;
  acceptableAnswers: string[];
  /** 오답일 때 응시자에게 추가로 보여줄 안내 */
  wrongAnswerExplain?: string;
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

/** 제출 시점 문항별 채점 (구 데이터에는 없을 수 있음) */
export type QuizSubmissionQuestionResult = {
  questionId: string;
  kind: "choice" | "short";
  correct: boolean;
};

/** 퀴즈 제출 1건 (사용자당 퀴즈당 1회만 허용) */
export type QuizSubmission = {
  id: string;
  quizId: string;
  userId: string;
  submittedAt: string;
  total: number;
  correct: number;
  /** 문항 순서는 제출 당시 퀴즈 문항 순서와 동일 */
  questionResults?: QuizSubmissionQuestionResult[];
  /** 제출 당시 답안 (객관식: 선택 인덱스, 미선택·무효는 -1 / 주관식: 입력 문자열). 구 데이터 없음 */
  answers?: Array<number | string>;
};

export type AppStore = {
  users: User[];
  quizzes: Quiz[];
  quizSubmissions: QuizSubmission[];
};
