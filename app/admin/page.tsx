"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QuizRow = {
  id: string;
  title: string;
  description: string;
  questions: { id: string }[];
  createdAt: string;
  availableFrom?: string | null;
  availableUntil?: string | null;
};

function quizPeriodLabel(q: QuizRow): string {
  if (!q.availableFrom && !q.availableUntil) return "풀이 기간: 상시";
  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR");
  return `풀이 기간: ${q.availableFrom ? fmt(q.availableFrom) : "—"} ~ ${q.availableUntil ? fmt(q.availableUntil) : "—"}`;
}

function isQuizOpenNow(q: QuizRow): boolean {
  const now = Date.now();
  if (q.availableFrom) {
    const t = new Date(q.availableFrom).getTime();
    if (!Number.isNaN(t) && now < t) return false;
  }
  if (q.availableUntil) {
    const t = new Date(q.availableUntil).getTime();
    if (!Number.isNaN(t) && now > t) return false;
  }
  return true;
}

export default function AdminHomePage() {
  const [tab, setTab] = useState<"quizzes" | "users">("quizzes");
  const [quizzes, setQuizzes] = useState<QuizRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQuizzes = useCallback(async () => {
    const res = await fetch("/api/admin/quizzes");
    if (!res.ok) {
      setError("퀴즈 목록을 불러오지 못했습니다.");
      return;
    }
    const data = (await res.json()) as { quizzes: QuizRow[] };
    setQuizzes(data.quizzes);
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === "quizzes") void loadQuizzes();
  }, [tab, loadQuizzes]);

  async function removeQuiz(id: string) {
    if (!confirm("이 퀴즈를 삭제할까요?")) return;
    const res = await fetch(`/api/admin/quizzes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("삭제에 실패했습니다.");
      return;
    }
    void loadQuizzes();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">관리자</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("quizzes")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "quizzes" ? "bg-blue-600 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            퀴즈
          </button>
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "users" ? "bg-blue-600 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            사용자
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {tab === "quizzes" && (
        <section className="mt-8">
          <div className="mb-4 flex justify-end">
            <Link
              href="/admin/quizzes/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              새 보안 퀴즈 등록
            </Link>
          </div>
          {!quizzes && <p className="text-[var(--muted)]">불러오는 중…</p>}
          {quizzes && quizzes.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
              등록된 퀴즈가 없습니다. 위 버튼으로 추가하세요.
            </p>
          )}
          {quizzes && quizzes.length > 0 && (
            <ul className="space-y-3">
              {quizzes.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{q.title}</p>
                    {q.description ? <p className="mt-1 text-sm text-[var(--muted)]">{q.description}</p> : null}
                    <p className="mt-1 text-xs text-[var(--muted)]">문항 {q.questions.length}개</p>
                    <p className="mt-1 text-xs text-amber-200/80">{quizPeriodLabel(q)}</p>
                    {!isQuizOpenNow(q) && (
                      <p className="mt-1 text-xs text-red-300/90">지금은 사용자에게 노출·풀이 불가(기간 외)</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/quizzes/${q.id}/report`}
                      className="rounded-md border border-emerald-800/50 bg-emerald-950/25 px-3 py-1.5 text-sm text-emerald-200/90 hover:border-emerald-500/40 hover:text-white"
                    >
                      응시 현황
                    </Link>
                    <Link
                      href={`/admin/quizzes/${q.id}/edit`}
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:border-blue-500/50 hover:text-white"
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeQuiz(q.id)}
                      className="rounded-md border border-red-900/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "users" && <UsersPanel />}
    </div>
  );
}

type UserRow = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  name?: string;
  department?: string;
  company?: string;
};

function UsersPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [company, setCompany] = useState("IND");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [msg, setMsg] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<{
    users: UserRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  } | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editCompany, setEditCompany] = useState("IND");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUserList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (activeQuery.trim()) params.set("q", activeQuery.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        setListError("사용자 목록을 불러오지 못했습니다.");
        setListData(null);
        return;
      }
      const data = (await res.json()) as {
        users: UserRow[];
        total: number;
        page: number;
        totalPages: number;
        limit: number;
      };
      setListData(data);
      if (data.page !== page) setPage(data.page);
    } catch {
      setListError("사용자 목록을 불러오지 못했습니다.");
      setListData(null);
    } finally {
      setListLoading(false);
    }
  }, [page, activeQuery]);

  useEffect(() => {
    void fetchUserList();
  }, [fetchUserList]);

  function applySearch() {
    setActiveQuery(filterInput.trim());
    setPage(1);
  }

  function refreshList() {
    void fetchUserList();
  }

  function openEdit(u: UserRow) {
    setEditingId(u.id);
    setEditUsername(u.username);
    setEditPassword("");
    setEditDisplayName(u.name ?? "");
    setEditDepartment(u.department ?? "");
    setEditCompany((u.company ?? "IND").trim() || "IND");
    setEditRole(u.role === "admin" ? "admin" : "user");
    setEditMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMsg(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername,
          password: editPassword,
          role: editRole,
          name: editDisplayName,
          department: editDepartment,
          company: editCompany.trim() || "IND",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditMsg(data.error || "저장 실패");
        return;
      }
      setEditingId(null);
      refreshList();
    } catch {
      setEditMsg("저장 중 오류가 발생했습니다.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteUser(u: UserRow) {
    if (
      !confirm(
        `"${u.username}" 계정을 삭제할까요?\n이 사용자의 퀴즈 응시·출제 기록도 함께 삭제되며, 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(data.error || "삭제에 실패했습니다.");
        return;
      }
      if (editingId === u.id) cancelEdit();
      refreshList();
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        role,
        ...(displayName.trim() ? { name: displayName.trim() } : {}),
        ...(department.trim() ? { department: department.trim() } : {}),
        company: company.trim() || "IND",
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(data.error || "등록 실패");
      return;
    }
    setUsername("");
    setPassword("");
    setDisplayName("");
    setDepartment("");
    setCompany("IND");
    setRole("user");
    setMsg("등록했습니다.");
    refreshList();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        added?: number;
        totalRows?: number;
        errors?: string[];
      };
      if (!res.ok) {
        setImportMsg(data.error || "업로드 실패");
        return;
      }
      const errs = data.errors?.length ? ` / 경고·건너뜀: ${data.errors.length}건` : "";
      setImportMsg(`${data.added ?? 0}명 등록 (${data.totalRows ?? 0}행 처리)${errs}`);
      if (data.errors?.length) {
        setImportMsg(
          (prev) =>
            `${prev}\n${data.errors!.slice(0, 8).join("\n")}${data.errors!.length > 8 ? "\n…" : ""}`
        );
      }
      refreshList();
    } catch {
      setImportMsg("업로드 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="mt-8 space-y-8">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-lg font-semibold text-white">엑셀·CSV 일괄 등록</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          한 줄(또는 엑셀 한 행)당{" "}
          <code className="text-blue-300">ID|PW|이름|소속부서</code> 또는{" "}
          <code className="text-blue-300">ID|PW|이름|소속부서|소속회사</code> 입니다. 엑셀은 A~D열(또는 E열에 회사 코드) 또는 A열 한 칸에
          파이프 구분입니다. 회사 코드를 생략하면 <code className="text-blue-300">IND</code>로 저장됩니다. 모두 일반 &quot;사용자&quot;
          역할로 등록됩니다.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-blue-500/50 bg-blue-950/30 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-950/50">
            {importing ? "처리 중…" : "파일 선택 (.xlsx, .xls, .csv, .txt)"}
            <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" disabled={importing} onChange={(ev) => void onImportFile(ev)} />
          </label>
        </div>
        {importMsg && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)]">
            {importMsg}
          </pre>
        )}
      </div>

      <form
        onSubmit={(e) => void addUser(e)}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <h2 className="text-lg font-semibold text-white">사용자 추가</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">일반 직원 계정은 역할을 &quot;사용자&quot;로 두면 됩니다.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <input
            type="password"
            placeholder="비밀번호 (4자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <input
            placeholder="이름 (선택)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <input
            placeholder="소속 부서 (선택)"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <input
            placeholder="소속 회사 코드 (기본 IND)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        <button
          type="submit"
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          추가
        </button>
        {msg && <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p>}
      </form>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-lg font-semibold text-white">사용자 조회</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          아이디·이름·소속 부서·소속 회사에 포함된 글자로 검색한 뒤, 목록에서 수정·삭제할 수 있습니다. 페이지당 20명입니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            placeholder="검색어"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applySearch();
              }
            }}
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <button
            type="button"
            onClick={() => applySearch()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            조회
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">계정 목록</h2>
        {listError && <p className="mt-2 text-sm text-red-400">{listError}</p>}
        {listLoading && !listData && <p className="mt-2 text-[var(--muted)]">불러오는 중…</p>}
        {listData && (
          <>
            <p className="mt-2 text-xs text-[var(--muted)]">
              전체 {listData.total}명 · {listData.page} / {listData.totalPages} 페이지
            </p>
            <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
              {listData.users.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">조건에 맞는 사용자가 없습니다.</li>
              ) : (
                listData.users.map((u) => (
                  <li key={u.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <span className="font-medium text-white">{u.username}</span>
                        {(u.name || u.department || u.company) && (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {[u.name, u.department, u.company].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]/80">
                          등록 {new Date(u.createdAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[var(--muted)]">{u.role === "admin" ? "관리자" : "사용자"}</span>
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:border-blue-500/50 hover:text-white"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === u.id}
                          onClick={() => void deleteUser(u)}
                          className="rounded-md border border-red-900/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                        >
                          {deletingId === u.id ? "삭제 중…" : "삭제"}
                        </button>
                      </div>
                    </div>
                    {editingId === u.id && (
                      <form
                        onSubmit={(e) => void saveEdit(e)}
                        className="mt-3 border-t border-[var(--border)] pt-3"
                      >
                        <p className="mb-2 text-xs text-[var(--muted)]">
                          비밀번호는 바꿀 때만 입력하세요. 비우면 기존 비밀번호가 유지됩니다.
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <input
                            required
                            placeholder="아이디"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          />
                          <input
                            type="password"
                            placeholder="새 비밀번호 (선택)"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            autoComplete="new-password"
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          />
                          <input
                            placeholder="이름 (선택)"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          />
                          <input
                            placeholder="소속 부서 (선택)"
                            value={editDepartment}
                            onChange={(e) => setEditDepartment(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          />
                          <input
                            placeholder="소속 회사 코드 (기본 IND)"
                            value={editCompany}
                            onChange={(e) => setEditCompany(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
                          >
                            <option value="user">사용자</option>
                            <option value="admin">관리자</option>
                          </select>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={editSaving}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            {editSaving ? "저장 중…" : "저장"}
                          </button>
                          <button
                            type="button"
                            disabled={editSaving}
                            onClick={() => cancelEdit()}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-50"
                          >
                            취소
                          </button>
                        </div>
                        {editMsg && <p className="mt-2 text-sm text-red-400">{editMsg}</p>}
                      </form>
                    )}
                  </li>
                ))
              )}
            </ul>
            {listData.totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={listData.page <= 1 || listLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-30"
                >
                  이전
                </button>
                <span className="text-sm text-[var(--muted)]">
                  {listData.page} / {listData.totalPages}
                </span>
                <button
                  type="button"
                  disabled={listData.page >= listData.totalPages || listLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-30"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
