import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { mutateStore } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { parseUserImportFile, type ImportedUserRow } from "@/lib/user-import";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "multipart 형식이 아닙니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일(file)이 필요합니다." }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const name = file.name || "upload";

  let rows: ImportedUserRow[];
  try {
    rows = parseUserImportFile(name, buf);
  } catch {
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "유효한 행이 없습니다. 형식: ID|PW|이름|소속부서[|소속회사] (엑셀은 A~D열 또는 A~E열, 한 셀 파이프 동일)",
      },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const fileSeen = new Set<string>();
  const valid: { row: (typeof rows)[0]; hash: string }[] = [];

  for (const row of rows) {
    if (row.password.length < 4) {
      errors.push(`${row.lineNum}행: 비밀번호는 4자 이상 (${row.username})`);
      continue;
    }
    if (fileSeen.has(row.username)) {
      errors.push(`${row.lineNum}행: 파일 내 아이디 중복 (${row.username})`);
      continue;
    }
    fileSeen.add(row.username);
    try {
      const hash = await hashPassword(row.password);
      valid.push({ row, hash });
    } catch {
      errors.push(`${row.lineNum}행: 비밀번호 처리 실패 (${row.username})`);
    }
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "등록할 수 있는 행이 없습니다.", errors }, { status: 400 });
  }

  const createdAt = new Date().toISOString();
  let added = 0;

  await mutateStore((store) => {
    const existing = new Set(store.users.map((u) => u.username));
    const newUsers: User[] = [];

    for (const { row, hash } of valid) {
      if (existing.has(row.username)) {
        errors.push(`${row.lineNum}행: 이미 등록된 아이디 (${row.username})`);
        continue;
      }
      existing.add(row.username);
      const co = row.company.trim() || "IND";
      newUsers.push({
        id: randomUUID(),
        username: row.username,
        passwordHash: hash,
        role: "user",
        createdAt,
        company: co,
        name: row.name.trim() || undefined,
        department: row.department.trim() || undefined,
      });
    }

    added = newUsers.length;
    return {
      store: { ...store, users: [...store.users, ...newUsers] },
      result: null,
    };
  });

  return NextResponse.json({
    ok: true,
    added,
    totalRows: rows.length,
    errors,
  });
}
