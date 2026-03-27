import type { QuizReportUserRow } from "./quiz-report";

/** 응시 완료이고 점수(%)가 minPercent 이상인 행만 */
export function eligibleByMinScore(rows: QuizReportUserRow[], minPercent: number): QuizReportUserRow[] {
  return rows.filter(
    (r) => r.completed && r.scorePercent !== undefined && r.scorePercent >= minPercent
  );
}

export function excludeUserIdsFromPool(
  pool: QuizReportUserRow[],
  excludedUserIds: ReadonlySet<string>
): QuizReportUserRow[] {
  return pool.filter((r) => !excludedUserIds.has(r.userId));
}

function randomIntBelow(n: number): number {
  if (n <= 0) throw new Error("randomIntBelow: n must be positive");
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]! % n;
  }
  return Math.floor(Math.random() * n);
}

/** items에서 count명(또는 그보다 적으면 전원)을 균등 무작위로 뽑음. 브라우저/Node 모두 동작 */
export function drawRandomSubset<T>(items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  const a = [...items];
  const k = Math.min(count, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + randomIntBelow(a.length - i);
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a.slice(0, k);
}
