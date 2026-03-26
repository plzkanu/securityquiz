import { NextResponse } from "next/server";
import { loadStoreWithBootstrap } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { attachSessionCookie, signSession } from "@/lib/auth";
import { sessionDisplayLabel } from "@/lib/user-display";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  const store = await loadStoreWithBootstrap();

  if (store.users.length === 0) {
    return NextResponse.json(
      {
        error:
          "등록된 계정이 없습니다. 프로젝트 루트 `.env.local`에 INITIAL_ADMIN_PASSWORD를 넣고 `npm run dev`를 다시 실행하세요. (이미 실행 중이었다면 서버를 한 번 종료 후 다시 시작해야 환경 변수가 반영됩니다.)",
        code: "NO_USERS",
      },
      { status: 401 }
    );
  }

  const user = store.users.find((u) => u.username === username);
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSession({
      sub: user.id,
      username: user.username,
      role: user.role,
      displayLabel: sessionDisplayLabel(user),
    });
  } catch {
    return NextResponse.json(
      { error: "서버에 AUTH_SECRET이 없거나 짧습니다. .env.local을 확인하세요." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    role: user.role,
    username: user.username,
  });
  attachSessionCookie(response, token);
  return response;
}
