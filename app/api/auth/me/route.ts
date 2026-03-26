import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { username: session.username, role: session.role, displayLabel: session.displayLabel },
  });
}
