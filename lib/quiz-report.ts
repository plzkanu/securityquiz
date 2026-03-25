import { migrateQuiz } from "./questions";
import type { AppStore, QuizSubmission, QuizSubmissionQuestionResult } from "./types";

export const REPORT_NO_DEPARTMENT = "(부서 없음)";

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
  completed: boolean;
  correct?: number;
  total?: number;
  scorePercent?: number;
  submittedAt?: string;
  /** 제출에 저장된 문항별 정오답(1번부터 순서) */
  questionResults?: Array<QuizSubmissionQuestionResult & { order: number }>;
};

export type QuizReport = {
  quiz: { id: string; title: string; questionCount: number };
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

export function buildQuizReport(store: AppStore, quizId: string): QuizReport | null {
  const quizRaw = store.quizzes.find((q) => q.id === quizId);
  if (!quizRaw) return null;
  const quiz = migrateQuiz(quizRaw);
  const qCount = quiz.questions.length;

  const submissions = store.quizSubmissions ?? [];
  const latestByUser = latestSubmissionByUser(quizId, submissions);

  const targetUsers = store.users.filter((u) => u.role === "user");

  const userRows: QuizReportUserRow[] = targetUsers.map((u) => {
    const dept = u.department?.trim() || REPORT_NO_DEPARTMENT;
    const sub = latestByUser.get(u.id);
    if (!sub) {
      return {
        userId: u.id,
        username: u.username,
        name: u.name,
        department: dept,
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
  for (let i = 0; i <= qCount; i++) correctCountMap.set(i, 0);
  for (const r of userRows) {
    if (r.completed && typeof r.correct === "number") {
      const c = r.correct;
      correctCountMap.set(c, (correctCountMap.get(c) ?? 0) + 1);
    }
  }
  const correctCountHistogram = Array.from({ length: qCount + 1 }, (_, correct) => ({
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
    quiz: { id: quiz.id, title: quiz.title, questionCount: qCount },
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
  };
}
