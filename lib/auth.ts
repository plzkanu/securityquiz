import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthSecretKey } from "./auth-secret";
import type { UserRole } from "./types";

const COOKIE = "quiz_session";

export type SessionPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey());
    const sub = payload.sub;
    const username = payload.username;
    const role = payload.role;
    if (typeof sub !== "string" || typeof username !== "string" || (role !== "admin" && role !== "user")) {
      return null;
    }
    return { sub, username, role };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

const sessionCookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

/**
 * Route Handler에서는 `cookies().set()`만으로 Set-Cookie가 빠지는 경우가 있어
 * 반드시 `NextResponse.cookies.set`으로 붙입니다.
 */
export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE, token, sessionCookieBase);
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export { COOKIE };
