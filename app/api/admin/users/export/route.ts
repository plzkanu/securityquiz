import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { loadStoreWithBootstrap } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const store = await loadStoreWithBootstrap();
  const sorted = [...store.users].sort((a, b) => a.username.localeCompare(b.username, "ko"));

  const header = ["아이디", "역할", "이름", "소속부서", "소속회사", "등록일시", "내부ID"];
  const rows: string[][] = sorted.map((u) => [
    u.username,
    u.role === "admin" ? "관리자" : "사용자",
    u.name ?? "",
    u.department ?? "",
    u.company?.trim() || "IND",
    u.createdAt,
    u.id,
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "사용자");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);
  const day = new Date().toISOString().slice(0, 10);
  const filename = `users-export-${day}.xlsx`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
