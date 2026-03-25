import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

function loginUrl(request: NextRequest) {
  const u = new URL("/login", request.url);
  u.searchParams.set("from", request.nextUrl.pathname);
  return u;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("quiz_session")?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith("/admin")) {
    if (!session) return NextResponse.redirect(loginUrl(request));
    if (session.role !== "admin") return NextResponse.redirect(new URL("/quizzes", request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/quizzes")) {
    if (!session) return NextResponse.redirect(loginUrl(request));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/quizzes/:path*"],
};
