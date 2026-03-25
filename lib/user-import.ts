import * as XLSX from "xlsx";

export type ImportedUserRow = {
  lineNum: number;
  username: string;
  password: string;
  name: string;
  department: string;
};

function isLikelyHeader(username: string, password: string): boolean {
  const u = username.toLowerCase();
  const p = password.toLowerCase();
  if (u === "id" || u === "아이디" || u === "username" || u === "userid") return true;
  if (p === "pw" || p === "password" || p === "비밀번호") return true;
  return false;
}

/** 텍스트/CSV: 한 줄당 `ID|PW|이름|소속부서` */
export function parsePipeDelimitedText(text: string): ImportedUserRow[] {
  const rows: ImportedUserRow[] = [];
  const normalized = text.replace(/^\uFEFF/, "");
  let lineNum = 0;
  for (const line of normalized.split(/\r?\n/)) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("|").map((s) => s.trim());
    if (parts.length < 4) continue;
    const username = parts[0] ?? "";
    const password = parts[1] ?? "";
    const name = parts[2] ?? "";
    const department = parts.slice(3).join("|").trim();
    if (!username || !password) continue;
    if (isLikelyHeader(username, password)) continue;
    rows.push({ lineNum, username, password, name, department });
  }
  return rows;
}

/** 엑셀: A~D열이 ID,PW,이름,소속부서 이거나, 한 셀에 `ID|PW|이름|소속부서` 형식 */
export function parseExcelBuffer(buf: ArrayBuffer): ImportedUserRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const rows: ImportedUserRow[] = [];
  let lineNum = 0;
  for (const row of matrix) {
    lineNum++;
    if (!Array.isArray(row) || row.length === 0) continue;
    const cells = row.map((c) => String(c ?? "").trim());
    if (cells.every((c) => !c)) continue;

    let username: string;
    let password: string;
    let name: string;
    let department: string;

    const joinedFirst = cells[0] ?? "";
    if (joinedFirst.includes("|") && cells.filter(Boolean).length <= 1) {
      const parts = joinedFirst.split("|").map((s) => s.trim());
      if (parts.length < 4) continue;
      username = parts[0] ?? "";
      password = parts[1] ?? "";
      name = parts[2] ?? "";
      department = parts.slice(3).join("|").trim();
    } else if (cells.length >= 4) {
      username = cells[0] ?? "";
      password = cells[1] ?? "";
      name = cells[2] ?? "";
      department = cells[3] ?? "";
    } else {
      continue;
    }

    if (!username || !password) continue;
    if (isLikelyHeader(username, password)) continue;
    rows.push({ lineNum, username, password, name, department });
  }
  return rows;
}

export function parseUserImportFile(filename: string, buf: ArrayBuffer): ImportedUserRow[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    try {
      const text = new TextDecoder("utf-8").decode(buf);
      return parsePipeDelimitedText(text);
    } catch {
      return [];
    }
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseExcelBuffer(buf);
  }
  return parseExcelBuffer(buf);
}
