# Soosan Site – GitHub + Replit 배포 가이드

정비원 이력관리 시스템과 **동일한 운영 흐름**입니다. 차이점은 이 저장소가 **Next.js(Node)** 이므로 Shell에서 `pip` 대신 **`npm install`** 을 쓰는 것뿐입니다.

## 흐름 요약

1. **로컬(Cursor)** 에서 코드 수정 후 **GitHub** 로 푸시  
2. **Replit Shell** 에서 GitHub 최신 코드로 동기화  
3. **Replit** 에서 **Republish**(또는 Deploy) 로 재배포  

배포 동작은 저장소 루트의 `.replit` 파일 **`[deployment]`** 섹션에 맞춰집니다. Replit은 **빌드**와 **실행**이 분리되므로 `build = ["npm","run","build"]` 와 `run = ["npm","run","start"]` 를 각각 두고, `run` 에서 `npm run build` 를 다시 넣지 않습니다(포트는 앱 3000, `externalPort` 80 은 Cloud Run 게이트웨이에 맞춘 값).

---

## 1단계: 로컬에서 코드 수정

Cursor에서 수정 후 저장합니다.

로컬 확인:

```powershell
npm install
npm run build
npm run start
```

### 로컬만 테스트할 때 (Replit 미사용)

- **Replit·Replit Database를 쓰지 않습니다.** `REPLIT_DB_URL` 이 없으면 저장소는 자동으로 프로젝트 루트 **`.data/store.json`** 을 사용합니다.
- 루트에 **`.env.local`** 을 두고 아래 표와 **같은 이름**으로 설정합니다: `AUTH_SECRET`, `INITIAL_ADMIN_PASSWORD`(및 선택 `INITIAL_ADMIN_USER`). 예시는 `.env.example` 참고.
- 개발 편의상 `npm run dev` 로 실행해도 동일합니다.

---

## 2단계: GitHub에 푸시

Cursor **터미널**에서:

```bash
git add .
git commit -m "변경 내용 설명"
git push origin main
```

- 기본 브랜치가 `master`라면 `git push origin master` 사용  
- 커밋 메시지는 실제 변경 내용으로 작성  

---

## 3단계: Replit에서 동기화 (매번 배포 전 실행)

Replit 왼쪽 **Tools** → **Shell** 을 연 뒤, 아래를 **순서대로** 실행합니다.

### 3-1. 최신 코드 가져오기 (필수)

```bash
git fetch origin main
git reset --hard origin/main
```

- 브랜치가 `master`면 `main` 대신 `master` 로 바꿉니다.

### 3-2. 패키지 설치 (필수)

동기화 후 **항상** 실행하는 것을 권장합니다.

```bash
npm install
```

`package-lock.json` 이 맞는 상태라면 재현성을 위해 아래도 가능합니다.

```bash
npm ci
```

### 3-3. 한 번에 실행하려면

```bash
git fetch origin main && git reset --hard origin/main && npm install
```

(`master` 브랜치면 `main` → `master`)

---

## 4단계: 재배포

1. Replit 오른쪽 상단 **Deploy** 영역에서 **Republish** (또는 **Deploy**) 클릭  
2. 배포가 끝난 뒤 제공되는 URL로 접속해 동작 확인  

---

## 처음 Replit에 올릴 때

1. Replit에서 **Create Repl** → **Import from GitHub** 로 이 저장소 연결  
2. 아래 **Secrets** 설정 후 배포  
3. 이후부터는 위 **3단계 → 4단계**만 반복하면 됩니다  

---

## Replit Secrets 설정

Replit **Tools** → **Secrets** 에 다음을 설정합니다.

| 이름 | 설명 |
|------|------|
| `AUTH_SECRET` | JWT·세션 서명용 비밀 값. **32바이트 이상** 난수 권장 (GitHub에 올리지 않음) |
| `INITIAL_ADMIN_PASSWORD` | **최초 1회** 관리자 계정 자동 생성용 비밀번호. 사용자가 없을 때만 적용됩니다. |
| `INITIAL_ADMIN_USER` | (선택) 최초 관리자 아이디. 기본값 `admin` |

로컬에서 생성 예시:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

이 프로젝트는 Replit 배포 시 **Replit Database**(사이트·관리자 JSON)와 **Replit Object Storage**(이미지)를 사용합니다. `REPL_ID` 등은 Replit이 자동으로 제공합니다.

---

## 반영이 안 될 때 체크리스트

| 확인 항목 | 조치 |
|-----------|------|
| Replit에서 `git status` 로 브랜치/파일 상태 확인 | `git fetch origin main && git reset --hard origin/main` 다시 실행 |
| 동기화 후 `npm install` 안 함 | `npm install` 실행 후 Republish |
| Republish만 하고 Shell에서 동기화 안 함 | **3단계 전체** 실행 후 다시 Republish |
| Replit이 예전 커밋을 가리킴 | GitHub 푸시 성공 여부 확인 후, Shell에서 `git log -1` 로 최신 커밋인지 확인 |
| 로그인/세션 이상 | Secrets에 `AUTH_SECRET` 설정 여부 확인 후 Republish |

---

## 요약: Replit에서 배포할 때마다

1. Shell 열기  
2. `git fetch origin main && git reset --hard origin/main && npm install` 실행 (`master` 브랜치면 이름 변경)  
3. **Republish** 클릭  

이 순서를 지키면 로컬에서 푸시한 내용이 Replit 배포에 반영됩니다.

---

## (참고) Vercel 배포

서버리스 환경에서는 로컬 파일·Replit 전용 스토리지와 동작이 다를 수 있습니다. 별도로 Vercel을 쓰는 경우에는 프로젝트 설정에서 `AUTH_SECRET` 과 빌드 명령을 맞추고, 데이터·업로드는 DB·Blob 등으로 이전해야 합니다.
