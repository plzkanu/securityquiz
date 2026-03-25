import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { mutateStore, loadStoreWithBootstrap } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { User, UserRole } from "@/lib/types";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const store = await loadStoreWithBootstrap();
  let list = store.users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    name: u.name,
    department: u.department,
  }));

  list.sort((a, b) => a.username.localeCompare(b.username, "ko"));

  if (q) {
    list = list.filter((u) => {
      const blob = [u.username, u.name ?? "", u.department ?? ""].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const start = (pageClamped - 1) * PAGE_SIZE;
  const users = list.slice(start, start + PAGE_SIZE);

  return NextResponse.json({
    users,
    total,
    page: pageClamped,
    limit: PAGE_SIZE,
    totalPages,
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { username?: string; password?: string; role?: string; name?: string; department?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" ? "admin" : "user";
  const displayName = typeof body.name === "string" ? body.name.trim() : "";
  const department = typeof body.department === "string" ? body.department.trim() : "";

  if (!username || !password || password.length < 4) {
    return NextResponse.json({ error: "아이디와 비밀번호(4자 이상)를 입력하세요." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  let duplicate = false;
  await mutateStore((store) => {
    if (store.users.some((u) => u.username === username)) {
      duplicate = true;
      return { store, result: null };
    }
    const user: User = {
      id,
      username,
      passwordHash,
      role: role as UserRole,
      createdAt,
      ...(displayName ? { name: displayName } : {}),
      ...(department ? { department } : {}),
    };
    return { store: { ...store, users: [...store.users, user] }, result: null };
  });

  if (duplicate) {
    return NextResponse.json({ error: "이미 있는 아이디입니다." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    user: { id, username, role, createdAt, name: displayName || undefined, department: department || undefined },
  });
}
