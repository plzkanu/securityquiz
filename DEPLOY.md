# Soosan Site – GitHub + Replit 배포 가이드

정비원 이력관리 시스템과 **동일한 운영 흐름**입니다. 차이점은 이 저장소가 **Next.js(Node)** 이므로 Shell에서 `pip` 대신 **`npm install`** 을 쓰는 것뿐입니다.

## 흐름 요약

1. **로컬(Cursor)** 에서 코드 수정 후 **GitHub** 로 푸시  
2. **Replit Shell** 에서 `npm run replit-sync` 로 GitHub 최신 코드·의존성 반영  
3. **Replit** 에서 **Republish**(또는 Deploy) 로 재배포  

배포 동작은 저장소 루트의 `.replit` 파일 **`[deployment]`** 섹션에 맞춰집니다. Replit은 **빌드**와 **실행**이 분리됩니다. **`build`** 는 `npm run replit-deploy-build` 로, **`git fetch origin main && git reset --hard origin/main && npm install && npm run build`** 를 한 번에 수행한 뒤 이미지를 만듭니다. **`run`** 은 `npm run start` 만 실행하므로, `run` 안에 `npm run build` 를 넣지 않습니다.

프로덕션 `npm run start` 는 `scripts/start-prod.mjs` 로 **`0.0.0.0`** 에 바인딩하고, Replit이 넣어 주는 **`PORT`** 가 있으면 그 포트를 씁니다(없으면 3000). `.replit` 의 `localPort = 3000` / `externalPort = 80` 과 맞춰져 있습니다.

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

## 3단계: Replit에서 동기화 (개발 워크스페이스에서 미리 맞출 때)

**Republish(배포)** 할 때는 **빌드 단계에서 자동으로** `git fetch origin main` → `reset --hard origin/main` → `npm install` → `npm run build` 가 실행됩니다. 별도 Shell 동기화 없이 GitHub에 푸시한 뒤 **Deploy만** 눌러도 최신 `main` 이 반영됩니다.

로컬 Repl 편집기에서 **미리** 워크스페이스를 GitHub와 맞추고 싶을 때는 Shell에서:

```bash
npm run replit-sync
```

`replit-sync` 는 `origin/main` 으로 맞춘 뒤 `npm install` 까지만 합니다(빌드 없음). (브랜치가 `master`인 저장소라면 아래 수동 명령에서 `main` → `master` 로 바꿔 실행하세요.)

### 배포 빌드 스크립트와 맞추려면 (`package.json`)

- **`replit-deploy-build`**: 위 git 동기화 + `npm install` + **`npm run build`** — `.replit` 의 `[deployment] build` 에 연결됨  
- **`replit-sync`**: git 동기화 + `npm install` 만 — 개발용

### (참고) 수동으로 나눠 실행할 때

```bash
git fetch origin main
git reset --hard origin/main
npm install
```

`package-lock.json` 이 맞는 상태라면 `npm install` 대신 `npm ci` 를 써도 됩니다.

---

## 4단계: 재배포

1. GitHub `main` 에 푸시되어 있는지 확인  
2. Replit 오른쪽 상단 **Deploy** 영역에서 **Republish** (또는 **Deploy**) 클릭 — 빌드 시 자동으로 `main` 동기화·`npm install`·`next build` 가 수행됩니다  
3. 배포가 끝난 뒤 제공되는 URL로 접속해 동작 확인  

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
| `REPLIT_DB_URL` | **직접 넣지 않는 것이 일반적입니다.** Repl에 Key-Value Replit Database를 연결하면 Replit이 주입합니다. 배포 환경에도 전달되는지는 아래 **「Replit Database」** 절 참고. |

로컬에서 생성 예시:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Replit Database (Key-Value) 쓰기

이 앱의 저장소는 **`@replit/database`** 와 환경 변수 **`REPLIT_DB_URL`** 입니다. 사용자·퀴즈·제출 내역이 JSON 한 덩어리로 이 DB에 저장됩니다.

- **PostgreSQL** 용 **`DATABASE_URL`** 과는 **다릅니다**. 이 저장소 코드는 SQL DB에 연결하지 않습니다.
- 로컬 PC(Cursor)에서는 보통 `REPLIT_DB_URL` 이 없으므로 **`.data/store.json`** 을 씁니다. Replit에서만 KV DB를 쓰면 됩니다.

### Q. Replit **Database** 화면에 “테이블이 없다”고만 나옴

Replit **Database** 도구의 **Overview / Tables** 는 **SQL(관계형) DB** 스키마를 보여 줍니다. 이 앱은 SQL 테이블을 만들지 않고, **Key-Value 저장소**에 키 **`security_quiz_app`** 하나에 JSON 전체를 넣습니다. 그래서 **테이블이 0개인 것이 정상**이며, 데이터가 없는 뜻이 아닙니다.

- 앱에서 사용자·퀴즈를 등록한 뒤에도 SQL **Tables** 에는 아무것도 안 보일 수 있습니다.
- 저장 여부는 사이트에서 목록이 유지되는지, 또는 (고급) KV 조회 도구가 있으면 키 목록으로 확인합니다.

### 1) Repl에서 Key-Value DB 켜기

1. Replit 워크스페이스 왼쪽 **Tools** 를 열고, 검색창에 **Database** / **Replit Database** 등으로 검색해 **키–값(Key-Value) 형태**의 Replit DB를 Repl에 연결합니다. (UI는 플랫폼 업데이트로 이름이 바뀔 수 있습니다.)
2. 연결되면 Replit이 **`REPLIT_DB_URL`** 을 워크스페이스 환경에 넣어 줍니다. **이 값은 GitHub에 넣지 마세요.**

### 2) 배포(Deploy) 환경에도 같은 URL이 필요한지 확인

배포된 사이트는 **빌드/실행 컨테이너**에서 돌아갑니다. 워크스페이스에만 `REPLIT_DB_URL` 이 있고 **배포 Secrets/환경 변수에는 없으면**, 프로덕션에서는 파일 저장으로 떨어지거나(또는 비어 있는 저장소로 동작) 데이터가 유지되지 않을 수 있습니다.

- **Deploy** 패널의 **Secrets**(또는 Production 환경 변수)에 **`REPLIT_DB_URL`** 이 포함되는지 확인하세요.
- Replit이 **개발용 DB / 프로덕션용 DB** 를 나누는 경우, 프로덕션용 DB를 배포에 연결한 뒤 그쪽에서 발급된 URL이 들어가야 합니다. ([Production databases](https://docs.replit.com/cloud-services/storage-and-databases/production-databases) 등 최신 문서 참고)

### 3) 동작 확인 (Shell)

값 자체는 노출하지 말고, **설정 여부만** 확인합니다.

```bash
# Linux Shell (Replit)
test -n "$REPLIT_DB_URL" && echo "REPLIT_DB_URL is set" || echo "REPLIT_DB_URL is MISSING"
```

`MISSING` 이면 워크스페이스에서 DB 연결을 다시 확인한 뒤, 배포 Secrets도 점검합니다.

### 4) 로컬 데이터를 Replit DB로 옮기기

로컬에서 `.data/store.json` 으로 이미 쓰던 데이터가 있으면, Replit KV에는 자동 이전이 없습니다. 운영 전에 **관리 화면에서 사용자·퀴즈를 다시 등록**하거나, 필요하면 별도 마이그레이션 스크립트를 만듭니다.

---

## 반영이 안 될 때 체크리스트

| 확인 항목 | 조치 |
|-----------|------|
| Replit에서 `git status` 로 브랜치/파일 상태 확인 | `npm run replit-sync` 다시 실행 (또는 동일한 fetch/reset 수동 실행) |
| 동기화 후 `npm install` 안 함 | `npm install` 실행 후 Republish |
| Republish만 하고 Shell에서 동기화 안 함 | **3단계 전체** 실행 후 다시 Republish |
| Replit이 예전 커밋을 가리킴 | GitHub 푸시 성공 여부 확인 후, Shell에서 `git log -1` 로 최신 커밋인지 확인 |
| 로그인/세션 이상 | Secrets에 `AUTH_SECRET` 설정 여부 확인 후 Republish |
| 퀴즈/사용자가 재시작 후 사라짐 | 워크스페이스·**배포** 환경 모두에 `REPLIT_DB_URL` 이 있는지 Shell 테스트로 확인 |

---

## 요약: Replit에서 배포할 때마다

1. 로컬(Cursor)에서 변경 후 **GitHub `main`** 에 푸시  
2. **Republish** 클릭 — 빌드가 `origin/main` 기준으로 동기화·설치·빌드합니다  

Repl 워크스페이스 파일도 미리 맞추고 싶으면 Shell에서 `npm run replit-sync` 를 추가로 실행하면 됩니다.

### 기본 브랜치가 `master` 인 경우

`package.json` 의 `replit-sync` / `replit-deploy-build` 안의 `main` 을 `master` 로 바꾸거나, Shell에서만 수동으로 `git fetch origin master && git reset --hard origin/master` 를 사용하세요.

---

## (참고) Vercel 배포

서버리스 환경에서는 로컬 파일·Replit 전용 스토리지와 동작이 다를 수 있습니다. 별도로 Vercel을 쓰는 경우에는 프로젝트 설정에서 `AUTH_SECRET` 과 빌드 명령을 맞추고, 데이터·업로드는 DB·Blob 등으로 이전해야 합니다.
