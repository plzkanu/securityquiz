import { attemptQuestionCount, usesRandomAttempt } from "./quiz-draw";
import { migrateQuiz } from "./questions";
import type { AppStore, QuizSubmission, QuizSubmissionQuestionResult, User } from "./types";

export const REPORT_NO_DEPARTMENT = "(부서 없음)";

export function normalizeUserCompany(u: Pick<User, "company">): string {
  const c = u.company?.trim();
  return c ? c : "IND";
}

/**
 * 등록된 모든 계정(관리자 포함)의 소속 회사 코드를 모읍니다.
 * 응시 대상은 역할이 사용자인 사람뿐이지만, 셀렉트 후보는 회사 코드를 쓰는 모든 계정을 반영합니다.
 */
export function listReportCompanyCodes(store: AppStore): string[] {
  const set = new Set<string>();
  for (const u of store.users) {
    set.add(normalizeUserCompany(u));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

/** 쉼표·세미콜론 구분. 서버 환경 변수 `REPORT_COMPANY_CODES` (예: `ACME,BETA,IND`) */
export function reportCompanyCodesFromEnv(): string[] {
  const raw = process.env.REPORT_COMPANY_CODES?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeDistinctSortedCompanyCodes(...lists: (string[] | undefined)[]): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const x of list) {
      const t = x.trim();
      if (t) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

export function latestSubmissionByUser(
  quizId: string,
  submissions: QuizSubmission[]
): Map<string, QuizSubmission> {
  const map = new Map<string, QuizSubmission>();
  const filtered = submissions.filter((s) => s.quizId === quizId);
  filtered.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  for (const s of filtered) {
    map.set(s.userId, s);
  }
  return map;
}

export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

export type QuizReportUserRow = {
  userId: string;
  username: string;
  name?: string;
  department: string;
  /** 소속 회사 코드 */
  company: string;
  completed: boolean;
  correct?: number;
  total?: number;
  scorePercent?: number;
  submittedAt?: string;
  /** 제출에 저장된 문항별 정오답(1번부터 순서) */
  questionResults?: Array<QuizSubmissionQuestionResult & { order: number }>;
};

export type QuizReport = {
  quiz: {
    id: string;
    title: string;
    /** 등록된 문항 풀 크기 */
    questionCount: number;
    /** 정답 개수 히스토그램 % 표시용(응시당 출제 문항 수가 다를 때 최대값 기준) */
    histogramDenominator: number;
    /** 무작위 출제 설정 시 응시당 문항 수(미설정이면 풀 전체) */
    questionsPerAttempt: number | null;
  };
  summary: {
    targetUsers: number;
    completedUsers: number;
    notCompletedUsers: number;
    completionRatePercent: number;
  };
  byDepartment: Array<{
    department: string;
    targetCount: number;
    completedCount: number;
    notCompletedCount: number;
    completionRatePercent: number;
    avgScorePercent: number | null;
    maxScorePercent: number | null;
    minScorePercent: number | null;
  }>;
  /** 정답 개수(최신 응시 기준)별 인원 */
  correctCountHistogram: Array<{ correct: number; count: number }>;
  /** 점수(%) 구간별 인원 — 최신 응시 기준 */
  scoreBandHistogram: Array<{ label: string; count: number }>;
  userRows: QuizReportUserRow[];
  /** null이면 전 회사 합산, 문자열이면 해당 회사만 */
  companyFilter: string | null;
};

const SCORE_BANDS: { label: string }[] = [
  { label: "0~20%" },
  { label: "21~40%" },
  { label: "41~60%" },
  { label: "61~80%" },
  { label: "81~100%" },
];

function scoreBandIndex(p: number): number {
  if (p <= 20) return 0;
  if (p <= 40) return 1;
  if (p <= 60) return 2;
  if (p <= 80) return 3;
  return 4;
}

export type BuildQuizReportOptions = {
  /** 지정 시 해당 회사 코드에 속한 사용자만 대상으로 집계 */
  company?: string | null;
};

export function buildQuizReport(
  store: AppStore,
  quizId: string,
  options?: BuildQuizReportOptions
): QuizReport | null {
  const quizRaw = store.quizzes.find((q) => q.id === quizId);
  if (!quizRaw) return null;
  const quiz = migrateQuiz(quizRaw);
  const qCount = quiz.questions.length;
  const perAttempt = attemptQuestionCount(quiz);
  const randomMode = usesRandomAttempt(quiz);

  const submissions = store.quizSubmissions ?? [];
  const latestByUser = latestSubmissionByUser(quizId, submissions);

  const companyFilterRaw = options?.company?.trim();
  const companyFilter = companyFilterRaw && companyFilterRaw.length > 0 ? companyFilterRaw : null;

  let targetUsers = store.users.filter((u) => u.role === "user");
  if (companyFilter) {
    targetUsers = targetUsers.filter((u) => normalizeUserCompany(u) === companyFilter);
  }

  let maxSubTotal = 0;
  for (const u of targetUsers) {
    const sub = latestByUser.get(u.id);
    if (sub) maxSubTotal = Math.max(maxSubTotal, sub.total);
  }
  const histCap = maxSubTotal > 0 ? maxSubTotal : Math.max(qCount, 1);

  const userRows: QuizReportUserRow[] = targetUsers.map((u) => {
    const dept = u.department?.trim() || REPORT_NO_DEPARTMENT;
    const co = normalizeUserCompany(u);
    const sub = latestByUser.get(u.id);
    if (!sub) {
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        department: dept,
        company: co,
        completed: false,
      };
    }
    const qr = sub.questionResults;
    const questionResults =
      qr && qr.length > 0
        ? qr.map((r, i) => ({
            order: i + 1,
            questionId: r.questionId,
            kind: r.kind,
            correct: r.correct,
          }))
        : undefined;
    return {
      userId: u.id,
      username: u.username,
      name: u.name,
      department: dept,
      company: co,
      completed: true,
      correct: sub.correct,
      total: sub.total,
      scorePercent: scorePercent(sub.correct, sub.total),
      submittedAt: sub.submittedAt,
      questionResults,
    };
  });

  userRows.sort((a, b) => a.username.localeCompare(b.username, "ko"));

  const completedUsers = userRows.filter((r) => r.completed).length;
  const targetCount = targetUsers.length;
  const notCompletedUsers = targetCount - completedUsers;
  const completionRatePercent =
    targetCount > 0 ? Math.round((completedUsers / targetCount) * 1000) / 10 : 0;

  const deptKeys = new Set<string>();
  for (const u of targetUsers) {
    deptKeys.add(u.department?.trim() || REPORT_NO_DEPARTMENT);
  }
  const deptList = Array.from(deptKeys).sort((a, b) => {
    if (a === REPORT_NO_DEPARTMENT) return 1;
    if (b === REPORT_NO_DEPARTMENT) return -1;
    return a.localeCompare(b, "ko");
  });

  const byDepartment = deptList.map((department) => {
    const inDept = targetUsers.filter((u) => (u.department?.trim() || REPORT_NO_DEPARTMENT) === department);
    const t = inDept.length;
    let completed = 0;
    const scores: number[] = [];
    for (const u of inDept) {
      const sub = latestByUser.get(u.id);
      if (sub) {
        completed += 1;
        scores.push(scorePercent(sub.correct, sub.total));
      }
    }
    const notCompleted = t - completed;
    const completionRatePercentDept = t > 0 ? Math.round((completed / t) * 1000) / 10 : 0;
    let avgScorePercent: number | null = null;
    let maxScorePercent: number | null = null;
    let minScorePercent: number | null = null;
    if (scores.length > 0) {
      avgScorePercent = Math.round((scores.reduce((acc, s) => acc + s, 0) / scores.length) * 10) / 10;
      maxScorePercent = Math.max(...scores);
      minScorePercent = Math.min(...scores);
    }
    return {
      department,
      targetCount: t,
      completedCount: completed,
      notCompletedCount: notCompleted,
      completionRatePercent: completionRatePercentDept,
      avgScorePercent,
      maxScorePercent,
      minScorePercent,
    };
  });

  const correctCountMap = new Map<number, number>();
  for (let i = 0; i <= histCap; i++) correctCountMap.set(i, 0);
  for (const r of userRows) {
    if (r.completed && typeof r.correct === "number") {
      const c = r.correct;
      correctCountMap.set(c, (correctCountMap.get(c) ?? 0) + 1);
    }
  }
  const correctCountHistogram = Array.from({ length: histCap + 1 }, (_, correct) => ({
    correct,
    count: correctCountMap.get(correct) ?? 0,
  }));

  const bandCounts = SCORE_BANDS.map((b) => ({ label: b.label, count: 0 }));
  for (const r of userRows) {
    if (!r.completed || r.scorePercent === undefined) continue;
    const idx = scoreBandIndex(r.scorePercent);
    bandCounts[idx].count += 1;
  }
  const scoreBandHistogram = bandCounts;

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      questionCount: qCount,
      histogramDenominator: histCap,
      questionsPerAttempt: randomMode ? perAttempt : null,
    },
    summary: {
      targetUsers: targetCount,
      completedUsers,
      notCompletedUsers,
      completionRatePercent,
    },
    byDepartment,
    correctCountHistogram,
    scoreBandHistogram,
    userRows,
    companyFilter,
  };
}
