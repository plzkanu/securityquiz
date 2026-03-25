import { randomUUID } from "crypto";
import type { AppStore } from "./types";
import { hashPassword } from "./password";

/**
 * If there are no users and INITIAL_ADMIN_PASSWORD is set, create the first admin.
 */
export async function ensureBootstrapAdmin(store: AppStore): Promise<AppStore> {
  if (store.users.length > 0) return store;
  const pwd = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (!pwd) return store;
  const username = (process.env.INITIAL_ADMIN_USER || "admin").trim() || "admin";
  const passwordHash = await hashPassword(pwd);
  const admin = {
    id: randomUUID(),
    username,
    passwordHash,
    role: "admin" as const,
    createdAt: new Date().toISOString(),
  };
  return { ...store, users: [admin], quizSubmissions: store.quizSubmissions ?? [] };
}
