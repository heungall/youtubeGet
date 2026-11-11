# YouTube API 연결 및 수집

Google 로그인은 앱 사용자 식별용이고 공개 영상 수집은 서버의 `YOUTUBE_API_KEY`를 사용한다. YouTube 계정 접근 권한이나 추가 Google OAuth 범위는 필요하지 않다. 영상 파일·제3자 자막 원문은 다운로드하지 않는다.

> 2026-11-11 장기 보관 요구 확인: 사용자는 1년·3년 전 영상도 계속 키워드로 찾기를 원한다. 아래 `002`/maintenance는 현재 구현된 만료 삭제 방식이며 이 요구를 충족하는 자동 갱신 방식은 아직 아니다. T-034에서 갱신/사용자 작성 데이터 분리 보존으로 수정한 뒤 운영 적용 절차를 확정한다. 30일 기준은 게시일이 아니라 API 정보를 마지막으로 가져온 시점이다. 정책은 해당 정보를 갱신하거나 삭제하도록 요구하므로 영상 아카이브를 30일 만에 반드시 폐기해야 한다는 뜻은 아니다. 수동 입력 자막의 현재 30일 기한은 별도 초기 제품 설정이다.

## 이미 배포한 프로젝트에 적용

사용자는 Vercel의 `YOUTUBE_API_KEY` 설정을 완료했다고 확인했다. 키 값은 채팅이나 Git에 넣지 않는다. 코드 변경은 새 배포에 반영해야 한다.

Supabase SQL Editor에서 **다음 순서로** 실행한다. 초기 `001` SQL은 다시 실행하지 않는다.

1. [202611110002_youtube_collection.sql](../supabase/migrations/202611110002_youtube_collection.sql): 작업 임대·API 호출 기록·페이지 저장 RPC·보관 기한 삭제 함수를 추가한다.
2. [maintenance.sql](../supabase/maintenance.sql): DB 소유자(`postgres`)로 매시간 정리 작업을 등록한다. 최종 `maintenance_ready`가 `true`인지 확인한다. 확장 설치가 거절되면 Supabase Integrations → Cron에서 `pg_cron`을 활성화한 뒤 다시 실행한다.
3. 변경된 앱을 배포한 뒤 Google 로그인 → **YouTube 수집**(`/collect`)을 연다. DB와 정기 삭제 설정을 확인해야 수집 버튼이 활성화된다.
4. 키워드 또는 채널 입력 → 안내 동의 → **첫 50개 가져오기**. 결과는 라이브러리에서 확인한다. 다음 페이지는 수집 내역의 버튼으로 진행한다.

신규 프로젝트는 `001` → `002` → `maintenance.sql` 순서다. SQL Editor로 적용한 프로젝트에 CLI를 도입할 때는 기존 마이그레이션 이력을 먼저 동기화한다.

## 입력과 저장 동작

- 검색: 200자 이내 검색어. `search.list(type=video, maxResults=50)` → `videos.list` → `channels.list` 순서로 공개 메타데이터를 확인한다.
- 채널: `UC`로 시작하는 채널 ID, `@핸들`, `https://www.youtube.com/@핸들` 또는 `/channel/UC…` 주소. `channels.list`의 uploads 재생목록 → `playlistItems.list(maxResults=50)` → `videos.list`로 수집한다. `/c/이름`, `/user/이름`, 영상 URL은 지원하지 않는다.
- 공개 상세가 확인된 영상만 저장한다. `contentDetails.caption`의 문자열 `true`/`false`는 표시 있음/없음으로 매핑하고 누락은 확인 불가로 둔다. 자막 원문 확보 상태를 변경하지 않는다.
- 사용자·영상 ID로 upsert한다. 기존 키워드·분석·사용자 요약·자막 상태는 메타데이터 갱신으로 덮어쓰지 않는다. 저장·갱신 건수는 중복 갱신도 포함하므로 라이브러리 고유 영상 수와 다를 수 있다.
- 채널·영상 upsert와 커서 변경은 하나의 DB 트랜잭션이다. DB 저장 실패는 전부 롤백한다. 응답이 끊겨 결과를 알 수 없으면 내역을 새로고침하고 DB의 현재 상태에서 이어간다.
- 한 페이지씩 요청한다. 진행 중 요청은 사용자별로 잠그고 수집 시작 사이에 10초 간격을 둔다. 응답이 끊기면 2분 임대 만료 후 같은 페이지부터 재시도할 수 있다. 자동 무한 재시도는 하지 않는다.
- 검색/목록 응답에는 있으나 성공한 `videos.list` 응답에서 사라졌거나 공개가 아닌 영상은 제외하고, 기존 저장 데이터와 연결 데이터도 삭제한다. API 오류를 영상 삭제로 해석하지 않는다.

## 키·쿼터와 오류

Google Cloud에서 YouTube Data API v3를 활성화하고 서버용 API 키를 사용한다. API 제한은 YouTube Data API v3로 설정한다. HTTP referrer 제한은 브라우저용이므로 서버 요청과 맞지 않는다. 서버 IP 제한을 적용하려면 실제 실행 환경의 고정 출구 IP 구성이 먼저 필요하다. [Google API 키 제한](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys)

키는 서버 `X-Goog-Api-Key` 헤더로만 보내며 URL·오류 메시지·브라우저 번들에 넣지 않는다. `.env.example`에는 주석을 포함해 실제 키를 넣지 않는다. 로컬 실제 값은 Git이 제외하는 `.env.local`에서 관리한다. [Google REST 인증](https://docs.cloud.google.com/docs/authentication/rest)

2026-11-11 확인한 [공식 쿼터 표](https://developers.google.com/youtube/data/determine_quota_cost)는 검색을 기본 일 100회 전용 버킷(호출당 1), 그 외 메서드를 기본 일 10,000단위로 구분한다. `channels.list`, `playlistItems.list`, `videos.list`는 각각 1단위다. 검색 한 페이지는 보통 검색 1회 + 일반 2단위, 채널 한 페이지는 일반 최대 3단위다. 빈 응답에서는 상세 호출을 생략한다. 실제 할당량과 소비량은 프로젝트의 Google Cloud Quotas가 기준이다.

요청 전 호출 추정치를 기록하므로 실패 요청도 포함되고, DB 기록 후 네트워크 전송에 실패하면 실제 소비보다 클 수 있다. 정확한 과금 계측으로 표현하지 않는다. 사용량 초과, 요청 제한, 잘못된 키/비활성 API, 만료된 페이지 토큰, 채널 없음, 네트워크 오류를 구분해 안내한다. 토큰이 만료되면 새 수집을 시작하며 기존 영상은 중복 저장하지 않는다.

## 보관·삭제와 운영 확인

[YouTube 개발자 정책](https://developers.google.com/youtube/terms/developer-policies)에 따라 공개 API 데이터를 30일 이내 갱신하거나 삭제한다. 재수집 시 채널·영상의 기한을 29일 후로 갱신하고 정기 작업은 매시간 17분에 만료 데이터를 삭제한다. 30일 상한을 위한 여유를 둔 것이다. 자막 자체의 `retention_until`도 처리하며, 만료 자막을 참조하는 분석·자막 기반 분류 연결을 먼저 삭제해 FK 오류를 방지한다. 영상·채널 삭제 시 연결된 자막·분석·분류·월별 선정 연결은 같이 삭제한다. 사용자 작성 데이터도 해당 영상과의 연결에 종속되므로 보존된다고 약속하지 않는다. YouTube 원본에는 영향을 주지 않는다.

정기 작업이 없으면 수집을 차단하고 수집 시에도 본인 만료 데이터를 정리한다. 설정 존재 확인은 실제 스케줄러의 실행 성공을 보증하지 않는다. Supabase Cron의 실행 내역에서 실패·프로젝트 중단·보관 기한을 운영자가 확인해야 한다. 정기 작업은 DB에서 실행하므로 앱의 service-role 키나 Vercel Cron 설정은 필요 없다. [Supabase Cron 설치](https://supabase.com/docs/guides/cron/install), [작업 등록/확인](https://supabase.com/docs/guides/cron/quickstart)

내부 이용자에게 `/privacy`의 처리·삭제 안내와 담당자를 공유한다. 삭제 요청을 받으면 운영자는 Supabase에서 해당 사용자 데이터를 최대 7일 이내 삭제한다. 전체 계정 삭제는 관련 소유 데이터에도 연결되므로 처리 범위를 확인한다. 자동 계정 삭제 UI는 현재 없다.

## 검증 범위

실제 YouTube 키로 공개 채널 조회·업로드·영상 상세를 3회 호출하고, 구현한 YouTubeClient로 검색→상세→채널을 두 차례(총 6회) 추가 호출했다. 한국어 `기도` 검색에서 영상 50개·채널 34개·다음 페이지 토큰 및 자막 표시 상태를 확인했다. 총 9회 호출이며 DB 쓰기는 없었다. HTTP 모의 테스트는 검색·채널 페이지·실패 처리, 실제 PostgreSQL 엔진 테스트는 원자 저장·중복·소유권·임대·보관 기한 삭제를 검증한다. PGlite에는 pg_cron 실행 엔진이 없어 작업 준비 여부를 대체한 저장 테스트와 실제 준비 함수의 미설정 차단 테스트를 구분한다. 원격 Supabase `002`/정기 작업 적용, 실제 Google 로그인 후 저장·재접속·두 계정 분리와 Cron 실행 성공은 아직 확인하지 않았다.
