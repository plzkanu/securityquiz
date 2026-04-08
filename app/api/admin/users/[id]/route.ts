import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { mutateStore } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { User, UserRole } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = context.params;

  let body: {
    username?: string;
    password?: string;
    role?: string;
    name?: string;
    department?: string;
    company?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return NextResponse.json({ error: "아이디를 입력하세요." }, { status: 400 });
  }

  const role = body.role === "admin" ? "admin" : "user";
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 0 && password.length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이거나, 바꾸지 않으려면 비워 두세요." }, { status: 400 });
  }

  const displayName = typeof body.name === "string" ? body.name.trim() : "";
  const department = typeof body.department === "string" ? body.department.trim() : "";
  const companyRaw = typeof body.company === "string" ? body.company.trim() : "";
  const company = companyRaw || "IND";

  let newHash: string | undefined;
  if (password.length > 0) {
    newHash = await hashPassword(password);
  }

  type PatchResult = "ok" | "not_found" | "duplicate" | "last_admin";
  const patchOutcome: { value: PatchResult } = { value: "ok" };

  await mutateStore((store) => {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      patchOutcome.value = "not_found";
      return { store, result: null };
    }

    if (store.users.some((u) => u.username === username && u.id !== id)) {
      patchOutcome.value = "duplicate";
      return { store, result: null };
    }

    const prev = store.users[idx];
    const otherAdmins = store.users.filter((u) => u.role === "admin" && u.id !== id).length;
    if (prev.role === "admin" && role === "user" && otherAdmins === 0) {
      patchOutcome.value = "last_admin";
      return { store, result: null };
    }

    const next: User = {
      ...prev,
      username,
      role: role as UserRole,
      company,
      passwordHash: newHash ?? prev.passwordHash,
    };
    if (displayName) next.name = displayName;
    else delete next.name;
    if (department) next.department = department;
    else delete next.department;

    const users = [...store.users];
    users[idx] = next;
    return { store: { ...store, users }, result: null };
  });

  if (patchOutcome.value === "not_found") {
    return NextResponse.json({ error: "없는 사용자입니다." }, { status: 404 });
  }
  if (patchOutcome.value === "duplicate") {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }
  if (patchOutcome.value === "last_admin") {
    return NextResponse.json(
      { error: "관리자가 한 명뿐이면 역할을 사용자로 바꿀 수 없습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id,
      username,
      role,
      company,
      name: displayName || undefined,
      department: department || undefined,
    },
  });
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = context.params;

  if (session.sub === id) {
    return NextResponse.json({ error: "로그인 중인 본인 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  type DelResult = "ok" | "not_found" | "last_admin";
  const delOutcome: { value: DelResult } = { value: "ok" };

  await mutateStore((store) => {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      delOutcome.value = "not_found";
      return { store, result: null };
    }

    const target = store.users[idx];
    const otherAdmins = store.users.filter((u) => u.role === "admin" && u.id !== id).length;
    if (target.role === "admin" && otherAdmins === 0) {
      delOutcome.value = "last_admin";
      return { store, result: null };
    }

    const users = store.users.filter((u) => u.id !== id);
    const quizSubmissions = (store.quizSubmissions ?? []).filter((s) => s.userId !== id);
    const quizQuestionDraws = (store.quizQuestionDraws ?? []).filter((d) => d.userId !== id);

    return {
      store: {
        ...store,
        users,
        quizSubmissions,
        quizQuestionDraws,
      },
      result: null,
    };
  });

  if (delOutcome.value === "not_found") {
    return NextResponse.json({ error: "없는 사용자입니다." }, { status: 404 });
  }
  if (delOutcome.value === "last_admin") {
    return NextResponse.json(
      { error: "유일한 관리자는 삭제할 수 없습니다. 다른 관리자를 만든 뒤 삭제하세요." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
