import type { Quiz } from "./types";

function rawAvailabilityField(v: unknown): string {
  if (v == null) return "";
  if (typeof v !== "string") return "";
  return v.trim();
}

export function parseQuizAvailabilityFromBody(body: Record<string, unknown>):
  | { ok: true; availableFrom: string | null; availableUntil: string | null }
  | { ok: false; error: string } {
  const rawFrom = rawAvailabilityField(body.availableFrom);
  const rawUntil = rawAvailabilityField(body.availableUntil);

  if (!rawFrom && !rawUntil) {
    return { ok: true, availableFrom: null, availableUntil: null };
  }
  if (!rawFrom || !rawUntil) {
    return {
      ok: false,
      error: "풀이 기간을 쓸 때는 시작·종료를 모두 입력하세요. 제한 없이 두려면 둘 다 비우세요.",
    };
  }

  const t0 = new Date(rawFrom).getTime();
  const t1 = new Date(rawUntil).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1)) {
    return { ok: false, error: "풀이 기간의 날짜·시간이 올바르지 않습니다." };
  }
  if (t0 >= t1) {
    return { ok: false, error: "종료 시각은 시작 시각보다 늦어야 합니다." };
  }

  return {
    ok: true,
    availableFrom: new Date(rawFrom).toISOString(),
    availableUntil: new Date(rawUntil).toISOString(),
  };
}

/** null/미설정이면 해당 끝은 제한 없음. 레거시 퀴즈(둘 다 없음)는 항상 허용. */
export function isQuizAvailableNow(quiz: Quiz, now = new Date()): boolean {
  const t = now.getTime();
  const from = quiz.availableFrom;
  const until = quiz.availableUntil;

  if (from) {
    const ft = new Date(from).getTime();
    if (Number.isNaN(ft) || t < ft) return false;
  }
  if (until) {
    const ut = new Date(until).getTime();
    if (Number.isNaN(ut) || t > ut) return false;
  }
  return true;
}

export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalValueToIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
