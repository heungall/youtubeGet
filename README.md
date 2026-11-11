# YouTube Keyword Archive

공개 유튜브 영상의 대표/디테일 키워드와 서머리를 관리하는 내부 도구입니다. **Google 로그인, YouTube 키워드 검색·채널 수집, 사용자별 영상 저장·조회**를 구현했습니다. 콘텐츠 편집·선정은 다음 단계입니다.

## 현재 상태 — 2026-11-11

| 항목 | 상태 |
|---|---|
| Google 로그인 버튼·PKCE 콜백·로그아웃·세션 갱신 | 코드 구현 및 로컬 검증 완료 |
| 사용자별 영상/채널/캠페인 수 조회 | 코드 구현, 실제 원격 계정 조회 확인 필요 |
| 영상 라이브러리 | 제목 검색·자막 표시 필터·50개 단위 페이지 이동 구현 |
| DB 구조 | 11개 테이블·RLS·복합 외래키·13개 대표 카테고리 시드 구현 |
| Vercel 첫 배포, Supabase 프로젝트/초기 SQL, Vercel Supabase 환경변수 | 사용자 완료 확인 |
| 실제 Google 공급자 연결·계정 로그인·두 계정 접근 분리 | 아직 검증하지 않음 — T-024 |
| YouTube 검색·채널 수집·영상 저장/갱신 | `/collect`, 50개씩 원자 저장·중복 갱신·커서 이어받기 구현. 실제 API 9회 응답 확인, 원격 DB 적용 필요 |
| 보관 기한 처리 | 29일 갱신 기한 및 매시간 삭제 SQL. 정기 작업 설정 전 수집 차단 |
| 영상 상세 편집·자막 입력·분석·월별 선정·CSV | 미구현 — 후속 TODO |

배포만으로 영상이 자동 수집되지는 않습니다. 새 SQL 적용 후 **YouTube 수집**에서 직접 시작합니다. 아래 완료 상태는 전체 MVP나 원격 DB 통합 검증 완료를 뜻하지 않습니다.

## 문서 안내

| 목적 | 문서 |
|---|---|
| Google 로그인 연결 및 문제 해결 | [Google 로그인 설정](doc/Google로그인설정.md) |
| YouTube 수집용 SQL·키·보관 기한·사용 방법 | [YouTube 연동 설정](doc/YouTube연동설정.md) |
| 전체 MVP 기능과 수용 기준 | [요구사항정의서](doc/요구사항정의서.md) |
| 인증·DB 설계와 검증 범위 | [개발 기반](doc/개발기반.md) |
| 다음 작업·차단 요인 | [todo.md](todo.md) |
| 과거 작업과 정책 변경 근거 | [history.md](history.md) |
| 개발·보안·기록 규칙 | [AGENT.md](AGENT.md) |

## 로컬 실행

Node.js 22.13 이상(현재 검증 환경: 24.14), npm을 사용합니다.

`.env.local`이 없는 최초 실행에 환경변수 예제를 복사합니다. 이미 파일이 있다면 기존 값을 유지하고 필요한 항목만 추가합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000`에서 앱을 볼 수 있습니다. 환경변수가 없으면 연결 설정 안내가 표시됩니다. Supabase 설정 후에는 로그인해야 대시보드·라이브러리에 접근할 수 있습니다. 샘플 영상을 실제 데이터로 표시하지 않습니다.

## 환경변수

실제 값은 `.env.local` 또는 Vercel 서버 환경변수에 둡니다. 저장소에는 값이 비어 있는 [.env.example](.env.example)만 포함합니다.

| 이름 | 현재 필요 여부 | 설정값·위치 |
|---|---|---|
| `SUPABASE_URL` | 로그인·DB 조회 필수 | Supabase 프로젝트 URL |
| `SUPABASE_PUBLISHABLE_KEY` | 로그인·DB 조회 필수 | publishable key 또는 legacy anon key. secret/service-role 키는 거부 |
| `APP_URL` | 선택 | 고정 앱 origin. 예: `https://your-app.vercel.app`. 경로·쿼리 없이 지정 |
| `YOUTUBE_API_KEY` | YouTube 수집 필수 | 서버용 YouTube Data API v3 키. Google OAuth 키와 별개 |

`APP_URL`이 비어 있으면 로그인 요청 Origin, 다음으로 플랫폼의 `VERCEL_URL`을 사용합니다. 개발 환경에서만 마지막 대체값으로 `http://localhost:3000`을 사용합니다. `VERCEL_URL`은 플랫폼이 제공하므로 별도 필수 설정이 아닙니다.

Google Client ID/Secret은 Supabase의 Google 공급자 설정에 입력합니다. 앱의 Google 비밀번호나 `GOOGLE_CLIENT_SECRET` 환경변수는 필요하지 않습니다. publishable key는 비밀키와 구분되지만 현재 앱에서는 서버에서 관리합니다. YouTube 키·secret/service-role 키를 `NEXT_PUBLIC_` 변수나 저장소에 넣지 않습니다.

## 로그인 준비

1. Google OAuth 클라이언트를 만들고 Client ID/Secret을 Supabase의 Google 공급자에 등록해 활성화합니다.
2. Supabase Site URL은 실제 앱 주소, Redirect URLs는 `https://실제앱주소/auth/callback`으로 설정합니다. Google 콘솔의 redirect URI에는 **Supabase의 `/auth/v1/callback` 주소**를 등록합니다.
3. Google 계정의 첫 가입을 허용할 수 있도록 Supabase 가입 설정을 확인합니다. 앱에서 직접 비밀번호 계정을 만들거나 메일 초대를 수락할 필요가 없습니다.
4. `/login`에서 **Google 계정으로 계속하기**를 누르고, 돌아온 뒤 `/settings`에서 DB 연결 성공을 확인합니다.

화면별 설정값과 확인 방법은 [Google 로그인 설정](doc/Google로그인설정.md)에 정리했습니다. Google Client Secret은 Supabase 공급자 설정에만 저장하며 앱 환경변수로 사용하지 않습니다. `APP_URL`은 고정 콜백 도메인이 필요할 때 지정하는 선택 서버 변수입니다.

이전에 비밀번호 계정을 생성했거나 초대 메일을 받았더라도 현재 절차는 Google 로그인입니다. 메일의 Accept를 누르거나 비밀번호를 새로 정할 필요가 없습니다. 기존 사용자/데이터는 삭제하지 않습니다.

로그인 뒤 `/`는 본인 저장 현황, `/collect`는 검색·채널 수집 및 재시도, `/library`는 본인의 최신 공개 영상을 50개씩 표시합니다. 라이브러리 검색 범위는 제목이며 자막 표시 필터를 제공합니다. 메타데이터는 재수집으로 갱신하고 만료 데이터는 Supabase 정기 작업으로 삭제합니다.

## YouTube 수집 시작

기존 프로젝트는 Supabase SQL Editor에서 [추가 마이그레이션 002](supabase/migrations/202611110002_youtube_collection.sql) → [정기 삭제 설정](supabase/maintenance.sql) 순서로 적용합니다. `maintenance_ready=true`를 확인한 뒤 새 앱을 배포하고 `/collect`에서 검색어 또는 채널 `@핸들`을 입력합니다. 초기 `001`은 다시 실행하지 않습니다. 자세한 절차와 오류는 [YouTube 연동 설정](doc/YouTube연동설정.md)을 참고하세요.

세션 갱신은 Next.js 16의 `src/proxy.ts`에서 처리하며, 서버에서 검증된 claims로 데이터 접근을 제한합니다. 로그인 응답과 사용자 화면은 공유 캐시를 사용하지 않습니다. [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

## 검증 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check`는 린트·타입 검사·테스트를 순서대로 실행합니다. `npm start`는 프로덕션 빌드 후 실행합니다.

이번 수집 작업에서 **11개 파일·148개 테스트, 린트·타입 검사·프로덕션 빌드와 로컬 6개 화면 HTTP 검사**가 통과했습니다. 실제 YouTube API 9회 호출은 성공했으며 원격 Supabase 저장·Google 계정 검증·Cron 실제 실행과는 구분합니다. 상세 결과는 `history.md`에 기록합니다.

DB 테스트는 PGlite의 실제 PostgreSQL 엔진에 마이그레이션을 적용하고 인증 역할을 전환해 RLS, 사용자 간 참조 차단, upsert, 월별 중복 방지, 분석 출처 제약을 확인합니다. 테스트 데이터는 메모리 DB 안에만 생성됩니다. Supabase Auth 자체와 호스팅 환경을 검증하는 통합 테스트는 별도로 필요합니다.

## DB 구성

마이그레이션: [001 초기 구조](supabase/migrations/202611110001_initial_archive.sql), [002 YouTube 수집](supabase/migrations/202611110002_youtube_collection.sql), [보관 기한 정기 작업](supabase/maintenance.sql).

사용자가 Supabase 프로젝트 생성과 초기 SQL 적용을 완료했다고 확인했습니다(2026-11-11). 동일 SQL을 다시 실행할 필요는 없습니다. 다음 명령은 **아직 적용하지 않은 신규 프로젝트**에서만 사용합니다. SQL Editor로 직접 적용했다면 CLI 마이그레이션 이력과의 동기화를 먼저 확인합니다.

```powershell
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

실제 프로젝트에서 `supabase gen types typescript`로 전체 DB 타입을 생성하는 작업은 남아 있습니다. 현재 조회 결과 타입은 저장소 마이그레이션을 기준으로 명시한 DTO이며 원격 생성 결과가 아닙니다. 공개 키만으로는 소유 데이터에 접근할 수 없으며, 로그인 사용자 세션이 필요합니다.

## 구조와 개발 범위

- `src/app`: Google 로그인·서버 액션·OAuth 콜백, 대시보드, YouTube 수집, 영상 조회, 키워드 사전, 연동 설정, 개인정보 처리 안내.
- `src/components/ui`: shadcn/ui 방식으로 소스 관리하는 공통 버튼.
- `src/lib`: 고정 분류, 상태 모델, 서버 설정, 세션 검증, Supabase 조회·수집 저장, YouTube 서버 요청 및 쿠키 갱신.
- `src/proxy.ts`: 보호 화면 접근 제한과 세션 갱신. 서버 조회도 별도로 인증을 확인합니다.
- `supabase/migrations`: 스키마, 인덱스, RLS, 고정 카테고리 시드.
- `tests`: Google 로그인/콜백/로그아웃, PKCE 쿠키·세션 교환, 접근 제한, SDK 조회 요청, SQL RLS 테스트. Auth/HTTP 응답 모의 테스트는 실제 원격 연동 테스트와 구분합니다.
- [아키텍처 결정](doc/개발기반.md), [요구사항](doc/요구사항정의서.md), [작업 목록](todo.md), [개발 이력](history.md).

다음 순서: **추가 SQL·Cron 적용 → 실제 Google 로그인·수집·재접속 검증(T-024/T-033) → 상세·분류/요약 편집(T-007/T-008) → 월별 선정·CSV(T-009)**. 최초 Vercel 배포와 새 코드 운영 반영은 별도로 확인합니다.
