# YouTube Keyword Archive

공개 유튜브 영상의 대표/디테일 키워드와 서머리를 관리하는 내부 도구입니다. 현재 **프로젝트 기반 구성(T-002)과 DB 마이그레이션(T-003)** 단계이며, 영상 검색·수집·로그인·영구 저장 UI는 아직 연결하지 않았습니다.

## 로컬 실행

Node.js 22.13 이상(현재 검증 환경: 24.14), npm을 사용합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000`에서 대시보드, 영상 라이브러리 안내, 13개 키워드 사전, 환경변수 상태 화면을 볼 수 있습니다. 환경변수가 없어도 실행됩니다. 외부 API를 호출하거나 샘플 영상을 저장하지 않습니다.

`.env.local`에는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`(publishable 또는 legacy anon key), `YOUTUBE_API_KEY`를 설정합니다. 현재 설정 화면은 값의 존재와 주소 형식만 확인하며 연결 성공을 보장하지 않습니다. 실제 키를 커밋하거나 `NEXT_PUBLIC_` 변수에 YouTube 키를 넣지 마세요. service-role 키와 AI 키는 사용하지 않습니다.

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

Supabase 프로젝트 준비 후 CLI로 적용합니다. **원격 DB 적용은 이번 작업에서 수행하지 않았습니다.** 아래 명령은 적용할 프로젝트를 직접 확인한 후 사용합니다.

```powershell
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

실제 DB 적용 후 `supabase gen types typescript`로 DB 타입을 생성하고 로그인·세션 갱신을 연결하는 것이 다음 단계입니다. 브라우저의 공개 키만으로는 소유 데이터에 접근할 수 없으며, 로그인 사용자 세션이 필요합니다.

## 구조와 개발 범위

- `src/app`: App Router 기본 화면. 설정 화면은 서버에서만 환경변수를 확인합니다.
- `src/components/ui`: shadcn/ui 방식으로 소스 관리하는 공통 버튼.
- `src/lib`: 고정 분류, 상태 모델, 서버 설정, 사용자 세션 기반 Supabase 클라이언트 준비 코드.
- `supabase/migrations`: 스키마, 인덱스, RLS, 고정 카테고리 시드.
- `tests`: 서버 설정 검증 및 SQL 실행 테스트.
- [아키텍처 결정](doc/개발기반.md), [요구사항](doc/요구사항정의서.md), [작업 목록](todo.md), [개발 이력](history.md).

다음 순서: 로그인·세션 갱신 → YouTube 검색/채널 수집 → DB upsert·커서 저장 → 라이브러리 조회/필터. 외부 API 및 DB 키 없이 검증 가능한 기반부터 구성했습니다. 배포는 요구사항의 Vercel을 대상으로 후속 진행합니다.
