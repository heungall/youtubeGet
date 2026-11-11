# history.md — 개발 History

이 파일은 프로젝트의 **작업별 개발 이력**을 보존한다. 시간순으로 누적 작성하며 과거 기록을 임의 삭제하지 않는다. 모든 작업마다 `todo.md`도 함께 갱신한다. (세부 규칙: `AGENT.md`)

현재 로그인 정책은 **T-030의 Google OAuth**다. 이전 날짜의 이메일·비밀번호 로그인, 메일 초대, 환경변수 미확인 문구는 당시 상태를 기록한 것이며 현재 설정 안내가 아니다. 현재 사용 절차는 [README](README.md)와 [Google 로그인 설정](doc/Google로그인설정.md), 전체 목표는 [요구사항정의서](doc/요구사항정의서.md), 최신 진행 상태는 [todo.md](todo.md)를 따른다.

## 2026-11-11 — 프로젝트 요구사항 및 개발 규칙 문서 초안
- 작업 ID/연관 TODO: `T-001`
- 목적: 유튜브 키워드 아카이브 MVP 범위와 개발·기록 규칙 명문화
- 변경 사항: 요구사항정의서, AGENT 지침, 개발 이력 및 TODO 템플릿 작성
- 변경 파일: `요구사항정의서.md`, `AGENT.md`, `history.md`, `todo.md`
- 실행한 검증 및 결과: 문서 생성 및 파일 존재 확인 예정. 기능 테스트 미실행(애플리케이션 구현 전)
- 결정 사항/근거: 대표 카테고리 13개 고정, 다중 분류 허용, 자막 표시 여부와 원문 확보 상태 분리, 선택 영상 분석 우선
- 이슈·제약: 실제 자막 자동 추출 경로와 무료 요금제 조건은 PoC/운영 전 재검증 필요
- 다음 작업: 저장소 초기화, DB 스키마 및 수집 API 구현

## 2026-11-11 10:26 KST — 프로젝트 실행 기반 및 사용자 소유 DB 마이그레이션
- 작업 ID/연관 TODO: `T-002`, `T-003`; 부분 진행 `T-006`, `T-007`, `T-010`, `T-018`, `T-020`; 신규 `T-023`, `T-024`, `T-025`
- 목적: 문서만 있는 저장소에서 로컬 실행과 SQL 검증이 가능한 개발 기반을 만들고 실제 수집 연동의 출발점을 마련한다.
- 변경 사항:
  - Next.js 16.4.6, React 19.3.1, TypeScript, Tailwind 4, shadcn/ui 방식의 공통 버튼과 구성 파일, 서버 전용 Supabase 헬퍼, 환경변수 예제 추가.
  - 대시보드/영상 라이브러리 안내/13개 키워드 사전/연동 설정 화면 작성. 연동 전 안내를 명시하고 실제 데이터나 샘플 수집 결과를 표시하지 않음.
  - 11개 테이블, 상태 enum, 대표 카테고리 시드, 인덱스, 중복 방지, 소유권 RLS 및 사용자 간 참조 차단 복합 FK 마이그레이션 작성.
  - 메타데이터 갱신/자막 보관 기한, 분석 출처·신뢰 수준·버전·입력 해시, 자동 제안/확정 구분 필드 준비.
  - README, 아키텍처 결정 및 공식 정책 근거 작성. 요구사항 v0.2에 사용자 범위 유일키·소유권 설계를 명시.
- 변경 파일: `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, Next/TypeScript/ESLint/PostCSS/Vitest/shadcn 설정, `src/app/*`, `src/components/*`, `src/lib/*`, `supabase/migrations/202611110001_initial_archive.sql`, `tests/*`, `README.md`, `doc/개발기반.md`, `doc/요구사항정의서.md`, `history.md`, `todo.md`.
- 실행한 검증 및 결과:
  - Node 24.14.0 / npm 11.9.0에서 의존성 설치 성공. 직접 의존성의 설치 패키지 라이선스 확인, 도입 이유/비용 영향 기록.
  - `npm run lint`: 통과(최종 경고 없음). 최초 PostCSS 익명 default-export 경고 수정.
  - `npm run typecheck`: 통과. `npm test`: 2개 파일 44개 테스트 통과.
  - PGlite PostgreSQL에서 마이그레이션 적용, 13개 시드 일치, 10개 소유 테이블의 타인 조회/수정/삭제 차단, 전체 11개 테이블 익명 접근 차단, 타인 참조 차단, upsert, 월별 중복, 키워드 정규화, 분석 출처 제약 검증.
  - `npm run build`: 프로덕션 빌드 성공. 로컬 프로덕션 서버에서 `/`, `/library`, `/keywords`, `/settings` HTTP 200, 각 h1과 보안 헤더 확인.
  - `.next/static`에 서버 API 키 환경변수명 포함 여부 검색: 미검출. 실제 비밀값은 사용하지 않음.
  - 설치 시 전체 audit 7건(moderate) 발견. ESLint 10 전환 시 플러그인 peer 충돌 및 audit 9건 확인해 채택하지 않음. ESLint 9.39.5와 typescript-estree의 minimatch 11.0.1 이상 부분 override 후 설치 audit 0건. `npm audit --omit=dev`도 0건.
  - 테스트용 임시 환경변수를 포함한 로컬 서버 실행 명령이 도구 정책에 거부되어 실행되지 않음. 환경변수 변경 없이 서버를 실행하여 페이지 응답 검증을 완료함.
  - 원격 Supabase/실제 YouTube API 호출, 브라우저 시각 검수, 배포: 미실행(이번 기반 구성 범위 외, 외부 프로젝트·실제 키 미구성).
- 결정 사항/근거: MVP 우선으로 T-002/T-003을 구현. 기본 소유권은 Auth 사용자별로 분리하고 YouTube ID 중복을 소유자 범위에서 차단한다. 조직 권한은 추가하지 않는다. Sites 지침은 현재 저장소 로컬 작업 경로로 적용하며 요구사항의 Vercel 배포는 후속 작업으로 둔다. 공식 YouTube 데이터 보관 정책의 30일 갱신과 Vercel Hobby 비상업 제한을 운영 전제에 반영한다.
- 이슈·제약: 실제 인증·세션 갱신·DB 생성 타입·검색·수집·저장 UI는 미구현이다. PGlite Auth 경계는 최소 대체 구성으로, 실제 Supabase Auth/RLS 통합 검증을 대체하지 않는다. 보관 기한 필드는 자동 갱신/삭제를 실행하지 않는다. ESLint 9 지원 종료 경고는 남아 T-025로 추적한다.
- 다음 작업: T-018/T-024 로그인 및 Supabase 실연동 준비, T-004/T-005 YouTube 서버 모듈·upsert·커서 저장, 운영 전 T-023 갱신/삭제 경로 구현.

## 2026-11-11 10:28 KST — Vercel 배포용 초기 개발 기반 커밋
- 작업 ID/연관 TODO: `T-026`
- 목적: 사용자의 요청에 따라 초기 앱·DB·문서를 Git 커밋으로 묶어 Vercel 배포에 사용할 수 있게 한다.
- 변경 사항: T-002/T-003 구현과 관련 문서를 커밋 대상으로 정리하고 작업 기록을 갱신한다. 애플리케이션 코드는 이전 검증 이후 변경하지 않는다.
- 변경 파일: 이전 작업의 신규/수정 파일 전체, `history.md`, `todo.md`.
- 실행한 검증 및 결과: `git diff --check` 통과. 실제 키/JWT/개인키 패턴 검색에서 미검출. `.env.local`, `.next`, `node_modules` 제외 규칙 확인. 린트·타입 검사·44개 테스트·빌드의 이전 통과 결과를 사용하며 코드 변경이 없어 재실행하지 않음.
- 결정 사항/근거: 요청 범위에 따라 로컬 커밋을 생성한다. 커밋 메시지는 `feat: initialize keyword archive app and Supabase schema`로 정한다.
- 이슈·제약: 원격 push와 Vercel 배포는 수행하지 않는다. 실제 DB/API 연동 전 기본 화면이며 미구현 기능은 기존 TODO에 유지한다.
- 다음 작업: 사용자의 Vercel 배포 후 로그인 및 실제 Supabase·YouTube API 연동을 이어간다.

## 2026-11-11 10:56 KST — 원격 반영 확인 및 다음 작업 안내
- 작업 ID/연관 TODO: `T-027`, `T-015`, `T-024`
- 목적: 사용자의 다음 단계 질문에 현재 Git 상태와 개발 범위에 맞는 배포/연동 순서를 안내한다.
- 변경 사항: 원격 main에 초기 구현 커밋이 반영되었음을 확인하고 T-015의 다음 행동을 구체화한다.
- 변경 파일: `history.md`, `todo.md`. 사용자 수정 상태의 `AGENT.md`는 보존한다.
- 실행한 검증 및 결과: `git ls-remote origin refs/heads/main`과 로컬 HEAD가 `6e1a4b011a2d702d0b6d55b4a26a58db7eb77ed3`로 일치. Vercel 공식 Git 연동/빌드 설정 문서 확인. 애플리케이션 코드 변경이 없어 기능 테스트 재실행하지 않음.
- 결정 사항/근거: 추가 push 단계 없이 Vercel 저장소 Import 및 첫 화면 배포 확인을 먼저 안내한다. 이후 Supabase/Auth 실연동, YouTube 검색·수집 순서로 개발한다.
- 이슈·제약: Vercel 프로젝트/배포 상태는 확인하지 않았다. 현재 기본 화면은 환경변수 없이 배포 가능하지만 영상 검색·영구 저장 기능은 미구현이다.
- 다음 작업: T-015 첫 배포 확인, T-024 Supabase 및 로그인 연결, T-004/T-005 실제 영상 수집·저장 구현.

## 2026-11-11 12:19 KST — Supabase 로그인·세션 및 사용자별 조회 연결
- 작업 ID/연관 TODO: `T-028`; 부분 구현 `T-007`, `T-010`, `T-024`; 사용자 확인 반영 `T-015`, 로그인 방식 결정 `T-018`
- 목적: 사용자가 완료한 Vercel 첫 배포와 Supabase 프로젝트/SQL 적용에 이어 로그인과 실제 DB 조회 코드를 연결한다.
- 변경 사항:
  - 내부 이메일·비밀번호 로그인/로그아웃 서버 액션, 입력 검증, 진행/실패 안내 및 로그인 후 앱 내부 복귀 주소 제한 구현. 공개 회원가입 UI는 제공하지 않음.
  - Next.js Proxy의 검증된 claims 확인과 세션 갱신, 요청/응답 쿠키 동기화, 리다이렉트 쿠키/캐시 헤더 보존 구현. 서버 조회에서도 별도로 인증 확인.
  - 서버 인증 전용 HttpOnly/SameSite=Lax 쿠키, 프로덕션 Secure, 공유 캐시 차단, 10초 네트워크 제한 적용. service-role/secret 키 설정 거부.
  - 사용자별 DB 현황 및 최신 공개 영상 조회, 제목 검색·자막 표시 필터·최대 50개 페이지 이동, 영상/자막 상태 표시 구현. DB 조회 실패를 빈 목록 성공으로 표시하지 않고, 기한이 지난 영상 메타데이터는 숨김.
  - README와 아키텍처 결정, 요구사항 v0.3, TODO 업데이트. 사용자 수정 `AGENT.md`는 변경하거나 커밋에 포함하지 않음. SQL/의존성 변경 없음.
- 변경 파일: `src/app/login/*`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/library/page.tsx`, `src/app/settings/page.tsx`, `src/proxy.ts`, `src/lib/auth/*`, `src/lib/archive.ts`, `src/lib/library-input.ts`, `src/lib/config.ts`, `src/lib/supabase/*`, `tests/auth-*.test.ts`, `tests/archive.test.ts`, `tests/config.test.ts`, `README.md`, `doc/개발기반.md`, `doc/요구사항정의서.md`, `todo.md`, `history.md`.
- 실행한 검증 및 결과:
  - `npm run check`: 린트·타입 검사 통과, 6개 파일 85개 테스트 통과. Auth 액션·Proxy 응답은 모의하며 SQL RLS는 기존 PGlite 엔진 테스트로 실행. 실제 Supabase SDK에 모의 HTTP 응답을 제공해 소유자/필터/페이지 요청과 HEAD count 처리 검증.
  - `npm run build`: 프로덕션 빌드 통과. 서버 전용 쿠키 설정 보강 후 정적 검사/85개 테스트/빌드 재검증.
  - 실제 환경변수 값을 출력하지 않고 상태만 확인: 로컬 Supabase/YouTube 모두 missing. 로컬 프로덕션 `/`, `/login`, `/library`, `/keywords`, `/settings` HTTP 200, 제목 및 private/no-store 헤더, 미설정 로그인 폼 비활성화 확인.
  - `.next/static`의 서버 키 환경변수명 검색: 미검출. 실제 키와 비밀번호는 사용하거나 저장하지 않음. `git diff --check` 통과.
  - 실제 원격 Auth 로그인/재접속/두 계정 RLS 및 브라우저 시각 검수: 미실행. Vercel 환경변수 설정 여부는 질문했으며 응답을 가정하지 않음.
- 결정 사항/근거: 기본 로그인은 Supabase 관리 화면에서 생성한 내부 계정으로 제공하고 프로젝트의 공개 가입 설정도 별도로 비활성화하도록 문서화한다. Supabase 공식 SSR 문서의 getClaims/Proxy/쿠키 동기화 흐름을 적용한다. 기존 SQL은 재실행할 필요가 없다.
- 이슈·제약: 원격 DB 생성 타입은 아직 확보하지 않아 조회 결과 DTO를 명시했다. 실제 원격 통합 검증은 T-024, 영상 수집/쓰기·커서 저장은 T-004/T-005, 기한 만료 데이터 갱신/삭제는 T-023에 유지한다. 공개 회원가입·메일 초대·비밀번호 재설정 흐름은 미구현이다.
- 다음 작업: 이번 코드를 커밋하고 실제 환경에서 `/login` → `/settings`의 DB 조회를 확인한 뒤 YouTube 검색·채널 수집을 구현한다. 원격 push는 수행하지 않는다.

## 2026-11-11 15:25 KST — 메일 수락 후 localhost 이동 원인 검토
- 작업 ID/연관 TODO: `T-029`, `T-024`
- 목적: 사용자가 보고한 메일 Accept 후 localhost:3000 이동의 원인과 현재 앱의 지원 범위를 구분한다.
- 변경 사항: 후속 설정/초대 처리 작업을 TODO에 등록. 사용자는 Vercel Supabase 환경변수 설정 완료도 확인함.
- 변경 파일: `history.md`, `todo.md`.
- 실행한 검증 및 결과: 로그인 액션과 전체 인증 경로 검색으로 이메일·비밀번호 로그인만 구현되고 초대 토큰 확인/세션 교환/비밀번호 설정 경로는 없음을 확인. Supabase 공식 Redirect URLs/Email Templates/Users 문서에서 기본 Site URL localhost:3000 및 초대 리다이렉트 동작 확인. 애플리케이션 코드 변경이 없어 테스트 재실행하지 않음.
- 결정 사항/근거: Supabase Site URL 기본값 또는 메일 redirect_to가 localhost를 가리키는 것으로 추정한다. 실제 프로젝트 설정은 직접 조회하지 않았으므로 확정 진단으로 보고하지 않는다. Site URL/허용 URL 변경만으로 현재 앱의 초대 수락·비밀번호 설정 흐름까지 완성되는 것은 아님을 안내한다.
- 이슈·제약: 실제 배포 도메인/메일 링크/프로젝트 URL Configuration은 확인하지 않음. 기존 초대 토큰은 단일 사용/만료 상태에 따라 재사용되지 않을 수 있음. 계정 삭제나 재초대는 수행하지 않음.
- 다음 작업: 실제 배포 주소로 Auth URL 설정을 확인하고 초대 계정의 비밀번호 설정/콜백 지원이 필요한 경우 T-029에서 구현한다.

## 2026-11-11 15:42 KST — Google OAuth 로그인으로 전환
- 작업 ID/연관 TODO: `T-030`, `T-024`; 로그인 정책 변경 `T-018`, 초대 작업 제외 `T-029`
- 목적: 별도 아이디·비밀번호 입력 없이 Google 계정으로 인증하자는 사용자의 요청을 구현한다.
- 변경 사항:
  - 이메일·비밀번호 폼/입력 검증/비밀번호 로그인 액션을 제거하고 Google 로그인 버튼과 서버 OAuth 시작 액션으로 대체.
  - Supabase PKCE 콜백 추가. 코드 교환, 사용자 취소/누락/실패, 세션 및 verifier 정리 쿠키 보존, 공유 캐시 방지 처리. 인증 코드와 공급자 오류 설명은 로그/화면에 노출하지 않음.
  - 고정 `/auth/callback` URL을 사용하고 복귀 경로는 별도 10분 HttpOnly 쿠키에 저장 후 삭제. Supabase Google 인가 URL 및 앱 내부 복귀 경로만 허용. 선택 `APP_URL`, 요청 Origin, Vercel URL을 사용하고 운영 주소가 없을 때 localhost로 기본 이동하지 않음.
  - 콜백 응답은 상대 Location으로 현재 사이트를 유지하며 임의 forwarded-host나 Next.js의 로컬 호스트 정규화를 이동 주소에 사용하지 않음. 서버/Proxy/콜백 쿠키 옵션을 공통화.
  - Google/Supabase에 등록할 두 콜백 주소, 공급자 키 설정, Google 첫 가입 허용 및 테스트 사용자 안내 문서 추가. 요구사항 v0.4 및 TODO/README 갱신. SQL/의존성/기존 사용자 데이터 변경 없음. 사용자 수정 `AGENT.md` 보존.
- 변경 파일: `.env.example`, `src/app/login/*`, `src/app/auth/callback/route.ts`, 대시보드/설정 안내 문구, `src/lib/auth/*`, `src/lib/supabase/{cookies,server,proxy}.ts`, `tests/{auth-input,google-actions,oauth-callback,oauth-sdk}.test.ts`, 기존 비밀번호 액션 테스트 제거, `README.md`, `doc/Google로그인설정.md`, `doc/개발기반.md`, `doc/요구사항정의서.md`, `todo.md`, `history.md`.
- 실행한 검증 및 결과:
  - `npm run check`: 린트/타입 검사 통과, 8개 파일 95개 테스트 통과. Google OAuth 시작/실패, 코드 교환/쿠키 보존, 취소/중복 코드, 외부 복귀 주소 차단, 기존 RLS/조회 테스트 포함.
  - 실제 설치된 Supabase SDK로 PKCE verifier 쿠키와 S256 challenge를 생성하고 모의 Auth HTTP 응답에 대해 콜백이 동일 verifier를 제출한 뒤 HttpOnly 세션 쿠키를 반환하는 흐름 검증. 외부 Google 계정은 사용하지 않음.
  - `npm run build`: 최종 프로덕션 빌드 통과. `/auth/callback` Route Handler 포함.
  - 최초 로컬 콜백 검사에서 요청한 127.0.0.1이 Next.js의 localhost로 정규화되는 호스트 차이로 검사 실패. 상대 Location으로 수정 후 정적 검사/95개 테스트/빌드 재실행 및 HTTP 재검증 통과.
  - 로컬 `/login` HTTP 200, Google 버튼 존재/이메일·비밀번호 필드 부재 확인. 코드 없는 `/auth/callback`은 307, Location `/login?notice=oauth_failed`, private/no-store 확인. `.next/static`의 서버 키 환경변수명 검색 미검출. `git diff --check` 통과.
  - 실제 Google 인증·Supabase 공급자 설정·원격 두 계정 접근 검증 및 브라우저 시각 검수는 미실행. Google Client ID/Secret 또는 실제 사용자 비밀번호를 확보하거나 저장하지 않음.
- 결정 사항/근거: 사용자 요청으로 초기 비밀번호 로그인 정책을 대체한다. 메일 초대·비밀번호 설정 구현은 취소하며 과거 조사 기록은 보존한다. Supabase 공식 Google/SSR/PKCE 문서를 근거로 서버 흐름을 구현한다. Google Client Secret은 Supabase 공급자 설정에서만 관리하고 앱에는 Google 비밀번호 입력을 제공하지 않는다.
- 이슈·제약: 실제 사용에는 Google OAuth 클라이언트 및 Supabase Google 공급자/허용 URL 설정이 필요하다. 계정의 최초 가입 허용과 Google Audience 대상 사용자는 외부 설정에서 관리한다. 실제 연결 검증은 T-024에 남긴다.
- 다음 작업: 이번 변경을 로컬 커밋으로 기록한 뒤 설정 안내에 따라 Google 공급자를 연결하고 실제 로그인/DB 조회를 확인한다. 원격 push는 수행하지 않는다.

## 2026-11-11 15:51 KST — 문서 전체를 현재 Google 인증·구현 상태로 정비
- 작업 ID/연관 TODO: `T-031`
- 목적: 사용자의 요청에 따라 모든 Markdown 문서를 현재 로그인 방식·설정값·구현 범위와 일치시키고 처음 읽는 사람도 다음 행동을 파악할 수 있게 한다.
- 변경 사항:
  - README에 현재 상태 표, 문서 탐색, 네 환경변수의 필수/선택 여부와 위치, 최근 검증 기준 및 다음 개발 순서 추가.
  - Google 설정 안내에 계정/세션 정보와 비밀번호의 구분, 두 콜백 주소, 신규 Google 등록·대상 계정·APP_URL/도메인 일치, 성공 기준과 오류별 확인 항목 추가. 현재 절차에 필요 없는 비밀번호 계정 생성/초대 안내는 사용하지 않도록 정리.
  - 요구사항 v0.5에 Google 인증 FR-19 및 실제 수용 기준 추가. 전체 목표와 현재 구현을 구분하는 표, 화면별 실제 상태, 소유자 범위 유일키와 11개 테이블 요약을 실제 스키마에 맞춤. 인증 미확정/RLS 권장 등 오래된 표현 정정.
  - 개발 기반에 실제 경로별 역할, 인증 URL 우선순위·상대 콜백 이동, Google 인증과 YouTube 수집 권한 분리, 현황 수와 라이브러리 수 차이, 검증 경계 명시.
  - AGENT의 기존 사용자 경로 수정 의도를 유지하면서 올바른 문서 링크로 정리하고 Google 인증/환경변수/소유권/검증 규칙 동기화. TODO의 미완료 작업에 다음 행동·의존성/차단 요인 및 당시 검증 기준 보강.
  - history 상단에 현재 Google 정책과 과거 비밀번호 기록을 구분하는 안내만 추가하고 기존 모든 작업 항목은 변경 없이 보존. 완료 상태는 코드/로컬 검증과 실제 원격 검증으로 구분.
- 변경 파일: `AGENT.md`, `README.md`, `doc/Google로그인설정.md`, `doc/개발기반.md`, `doc/요구사항정의서.md`, `todo.md`, `history.md`.
- 실행한 검증 및 결과: 전체 7개 Markdown의 내부 링크 35개, 코드 펜스, 중복 없는 TODO 31개 및 작업 참조, FR 19개 및 카테고리 13개, 실제 마이그레이션의 11개 테이블, `.env.example`의 네 변수와 README, npm 명령과 package.json 일치 검사 통과. 과거 history 항목의 본문이 이전 커밋과 동일하게 보존되었음을 확인. 현재 운영 문서의 폐기된 비밀번호 생성/로그인 식별자 미검출. `git diff --check` 통과.
- 결정 사항/근거: 문서에 과거 상태를 현재처럼 복사하지 않고 최신 정책과 실제 수행 범위를 명시한다. 이전 앱 검증(95개 테스트·빌드)은 T-030의 결과로만 표시한다.
- 이슈·제약: 문서만 변경하여 린트/타입/앱 테스트/빌드는 재실행하지 않음. 실제 Google 공급자 설정·원격 계정 로그인·DB 통합 검증, 외부 약관/요금제 재조사는 이번 작업에서 수행하지 않음. 앱/SQL/의존성/실제 키 변경 없음.
- 다음 작업: 문서 변경을 커밋하고 T-024의 실제 Google 로그인·DB 조회 검증 후 T-004/T-005 수집·저장 구현을 진행한다. 원격 push는 수행하지 않는다.

## 2026-11-11 16:19 KST — Google 로그인·문서 변경 원격 반영
- 작업 ID/연관 TODO: `T-032`
- 목적: 사용자의 커밋/push 요청에 따라 대기 중인 Google OAuth 구현과 전체 문서 정비를 원격 main에 반영한다.
- 변경 사항: 기존 `09c1e46`, `e7020b1` 커밋을 push하고 이번 작업 기록을 추가한다. 앱 코드·SQL·환경변수는 변경하지 않는다.
- 변경 파일: `history.md`, `todo.md`.
- 실행한 검증 및 결과: 시작 시 작업 트리 깨끗함 및 main의 미전송 커밋 2개 확인. `git push --quiet origin main` 성공. 로컬 HEAD와 `git ls-remote origin refs/heads/main`이 `e7020b1863730b5d1e05a407b37d6b6d7fe8847c`로 일치함을 확인. 이번 작업은 코드 변경이 없어 앱 검사/95개 테스트/빌드를 재실행하지 않음.
- 결정 사항/근거: 사용자가 명시적으로 원격 push를 요청했다. 필수 작업 기록도 별도 커밋으로 만들어 같은 브랜치에 반영한다.
- 이슈·제약: 원격 Git 반영과 Vercel 배포 성공은 별개이며 이번 작업에서 배포 상태나 Google OAuth 외부 설정을 확인하지 않는다.
- 다음 작업: 작업 기록 커밋도 push한 후 최종 원격 HEAD/작업 트리 확인. 기능 후속 작업은 T-024 실제 Google 로그인·DB 조회 및 T-004/T-005 영상 수집·저장.
