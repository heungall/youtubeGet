# YouTube Keyword Archive

공개 유튜브 영상의 대표/디테일 키워드와 서머리를 관리하는 내부 도구입니다. 기본 프로젝트와 DB 마이그레이션에 이어 **이메일·비밀번호 로그인, 세션 갱신, 사용자별 저장 현황 및 영상 조회**를 구현했습니다. YouTube 검색·수집과 콘텐츠 편집·선정은 다음 단계입니다.

## 로컬 실행

Node.js 22.13 이상(현재 검증 환경: 24.14), npm을 사용합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000`에서 앱을 볼 수 있습니다. 환경변수가 없으면 연결 설정 안내가 표시됩니다. Supabase 설정 후에는 로그인해야 대시보드·라이브러리에 접근할 수 있습니다. 샘플 영상을 실제 데이터로 표시하지 않습니다.

`.env.local` 또는 Vercel 서버 환경변수에는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`(publishable 또는 legacy anon key)를 설정합니다. YouTube 연동 단계에는 `YOUTUBE_API_KEY`도 필요합니다. 설정 화면은 환경변수 상태와 로그인 후 실제 DB 조회 결과를 구분해 보여줍니다. 실제 키를 커밋하거나 `NEXT_PUBLIC_` 변수에 YouTube 키를 넣지 마세요. secret/service-role 키는 거부하며 AI 키는 사용하지 않습니다.

## 로그인 준비

1. Supabase **Authentication → Users → Add user → Create new user**에서 내부 계정을 이메일·비밀번호로 만듭니다. 이메일 인증 상태도 확인합니다. 앱에는 공개 회원가입/메일 초대 처리/비밀번호 재설정 화면을 제공하지 않습니다.
2. 내부 사용자만 사용할 경우 Auth 설정의 공개 가입 허용도 끕니다. 앱에서 회원가입 버튼을 숨기는 것만으로 Supabase 가입 API가 비활성화되지는 않습니다. [공식 설정 안내](https://supabase.com/docs/guides/auth/general-configuration)
3. 서버 환경변수를 설정한 배포에서 `/login`으로 로그인합니다. 비밀번호는 채팅이나 저장소에 기록하지 않습니다.
4. `/settings`에서 로그인과 DB 연결 성공 표시를 확인합니다. 영상이 아직 없다면 라이브러리의 0개/빈 목록은 정상입니다.

로그인 뒤 `/`는 본인 영상·채널·캠페인의 수를 조회하고, `/library`는 본인의 최신 공개 영상만 50개씩 조회합니다. 현재 검색 범위는 제목이며 자막 표시 상태 필터를 제공합니다. 갱신 기한이 지난 메타데이터는 라이브러리에서 숨깁니다. 자동 갱신/삭제와 YouTube 수집은 아직 구현하지 않았습니다.

세션 갱신은 Next.js 16의 `src/proxy.ts`에서 처리하며, 서버에서 검증된 claims로 데이터 접근을 제한합니다. 로그인 응답과 사용자 화면은 공유 캐시를 사용하지 않습니다. [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

## 검증 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check`는 린트·타입 검사·테스트를 순서대로 실행합니다. `npm start`는 프로덕션 빌드 후 실행합니다.

DB 테스트는 PGlite의 실제 PostgreSQL 엔진에 마이그레이션을 적용하고 인증 역할을 전환해 RLS, 사용자 간 참조 차단, upsert, 월별 중복 방지, 분석 출처 제약을 확인합니다. 테스트 데이터는 메모리 DB 안에만 생성됩니다. Supabase Auth 자체와 호스팅 환경을 검증하는 통합 테스트는 별도로 필요합니다.

## DB 구성

마이그레이션: [202611110001_initial_archive.sql](supabase/migrations/202611110001_initial_archive.sql)

사용자가 Supabase 프로젝트 생성과 초기 SQL 적용을 완료했다고 확인했습니다(2026-11-11). 동일 SQL을 다시 실행할 필요는 없습니다. 다음 명령은 **아직 적용하지 않은 신규 프로젝트**에서만 사용합니다. SQL Editor로 직접 적용했다면 CLI 마이그레이션 이력과의 동기화를 먼저 확인합니다.

```powershell
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

실제 프로젝트에서 `supabase gen types typescript`로 전체 DB 타입을 생성하는 작업은 남아 있습니다. 현재 조회 결과 타입은 저장소 마이그레이션을 기준으로 명시한 DTO이며 원격 생성 결과가 아닙니다. 공개 키만으로는 소유 데이터에 접근할 수 없으며, 로그인 사용자 세션이 필요합니다.

## 구조와 개발 범위

- `src/app`: 로그인·서버 액션, 대시보드, 영상 조회, 키워드 사전, 연동 설정.
- `src/components/ui`: shadcn/ui 방식으로 소스 관리하는 공통 버튼.
- `src/lib`: 고정 분류, 상태 모델, 서버 설정, 세션 검증, Supabase 조회 및 쿠키 갱신.
- `src/proxy.ts`: 보호 화면 접근 제한과 세션 갱신. 서버 조회도 별도로 인증을 확인합니다.
- `supabase/migrations`: 스키마, 인덱스, RLS, 고정 카테고리 시드.
- `tests`: 설정·입력 검증, 로그인/로그아웃, 세션 쿠키/접근 제한, SDK 조회 요청, SQL RLS 테스트. Auth/HTTP 응답 모의 테스트는 실제 원격 연동 테스트와 구분합니다.
- [아키텍처 결정](doc/개발기반.md), [요구사항](doc/요구사항정의서.md), [작업 목록](todo.md), [개발 이력](history.md).

다음 순서: 실제 계정 로그인·DB 조회 검증 → YouTube 검색/채널 수집 → DB upsert·커서 저장 → 영상 상세·분류/요약 편집. Vercel 첫 배포는 사용자 확인으로 완료되었으며 새 코드 반영 후 로그인 확인이 필요합니다.
