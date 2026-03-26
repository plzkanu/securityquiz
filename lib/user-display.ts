import type { User } from "./types";

/** 헤더 등에 표시: 이름(소속부서). 이름 없으면 로그인 ID 사용. */
export function sessionDisplayLabel(user: Pick<User, "username" | "name" | "department">): string {
  const name = user.name?.trim() || user.username;
  const dept = user.department?.trim();
  if (dept) return `${name}(${dept})`;
  return name;
}
