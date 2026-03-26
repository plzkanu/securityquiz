/**
 * 저장소: `REPLIT_DB_URL` 이 있으면 Replit Database, 없으면 로컬 파일 `.data/store.json`.
 * 로컬 개발 시 Replit 을 쓰지 않아도 됩니다.
 */
import Client from "@replit/database";
import { promises as fs } from "fs";
import path from "path";
import { ensureBootstrapAdmin } from "./bootstrap";
import type { AppStore, QuizQuestionDraw, QuizSubmission, User, Quiz } from "./types";

const STORE_KEY = "security_quiz_app";
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "store.json");

function emptyStore(): AppStore {
  return { users: [], quizzes: [], quizSubmissions: [] };
}

function normalizeStore(raw: unknown): AppStore {
  if (!raw || typeof raw !== "object") return emptyStore();
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.users) || !Array.isArray(o.quizzes)) return emptyStore();
  const quizSubmissions = Array.isArray(o.quizSubmissions) ? (o.quizSubmissions as QuizSubmission[]) : [];
  const quizQuestionDraws = Array.isArray(o.quizQuestionDraws) ? (o.quizQuestionDraws as QuizQuestionDraw[]) : [];
  return {
    users: o.users as User[],
    quizzes: o.quizzes as Quiz[],
    quizSubmissions,
    quizQuestionDraws,
  };
}

async function readLocal(): Promise<AppStore> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf-8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

async function writeLocal(store: AppStore): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), "utf-8");
}

let replitClient: Client | null = null;

function getReplitClient(): Client | null {
  if (!process.env.REPLIT_DB_URL) return null;
  if (!replitClient) replitClient = new Client();
  return replitClient;
}

/** `@replit/database` get() returns `{ ok, value }`, not the value directly. */
function storeFromReplitValue(value: unknown): AppStore {
  if (value == null) return emptyStore();
  if (typeof value === "string") {
    try {
      return normalizeStore(JSON.parse(value));
    } catch {
      return emptyStore();
    }
  }
  return normalizeStore(value);
}

export async function loadStore(): Promise<AppStore> {
  const client = getReplitClient();
  if (client) {
    const res = await client.get(STORE_KEY);
    if (!res.ok) return emptyStore();
    return storeFromReplitValue(res.value);
  }
  return readLocal();
}

/** Loads store and persists first admin when INITIAL_ADMIN_PASSWORD is set. */
export async function loadStoreWithBootstrap(): Promise<AppStore> {
  let store = await loadStore();
  const before = store.users.length;
  store = await ensureBootstrapAdmin(store);
  if (store.users.length !== before) {
    await saveStore(store);
  }
  return store;
}

export async function saveStore(store: AppStore): Promise<void> {
  const client = getReplitClient();
  if (client) {
    // Client.set() already JSON.stringify's; pass the object (not a pre-stringified blob).
    const res = await client.set(STORE_KEY, store);
    if (!res.ok) {
      throw new Error(
        typeof res.error === "object" && res.error && "message" in res.error
          ? String((res.error as { message: string }).message)
          : "Replit Database set failed"
      );
    }
    return;
  }
  await writeLocal(store);
}

/**
 * Run read-modify-write atomically best-effort (single key on Replit).
 */
export async function mutateStore<T>(
  fn: (store: AppStore) => { store: AppStore; result: T }
): Promise<T> {
  const store = await loadStoreWithBootstrap();
  const { store: next, result } = fn(store);
  await saveStore(next);
  return result;
}
