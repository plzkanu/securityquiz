import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { mutateStore } from "@/lib/db";
import { DELETE_NON_ADMIN_USERS_CONFIRM_PHRASE } from "@/lib/admin-users-constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { confirmPhrase?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const phrase = typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : "";
  if (phrase !== DELETE_NON_ADMIN_USERS_CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `확인 문구가 일치하지 않습니다. 정확히 「${DELETE_NON_ADMIN_USERS_CONFIRM_PHRASE}」를 입력하세요.`,
      },
      { status: 400 }
    );
  }

  let removed = 0;
  let keptAdmins = 0;

  await mutateStore((store) => {
    const admins = store.users.filter((u) => u.role === "admin");
    if (admins.length === 0) {
      removed = -1;
      return { store, result: null };
    }

    const removeIds = new Set(store.users.filter((u) => u.role !== "admin").map((u) => u.id));
    removed = removeIds.size;
    keptAdmins = admins.length;

    const quizSubmissions = (store.quizSubmissions ?? []).filter((s) => !removeIds.has(s.userId));
    const quizQuestionDraws = (store.quizQuestionDraws ?? []).filter((d) => !removeIds.has(d.userId));

    return {
      store: {
        ...store,
        users: admins,
        quizSubmissions,
        quizQuestionDraws,
      },
      result: null,
    };
  });

  if (removed === -1) {
    return NextResponse.json(
      { error: "관리자 계정이 하나도 없어 이 작업을 수행할 수 없습니다. 데이터를 복구하거나 환경 변수로 최초 관리자를 만든 뒤 다시 시도하세요." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, removed, keptAdmins });
}
