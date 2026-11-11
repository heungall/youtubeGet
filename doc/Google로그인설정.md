# Google 로그인 설정

최종 정리: 2026-11-11. 코드 구현: T-030. 실제 외부 설정/계정 검증: T-024.

앱에서는 Google 계정 선택만 하면 됩니다. Google 비밀번호는 앱에서 입력받거나 저장하지 않습니다. Supabase가 인증 사용자와 세션을 관리하고, 기존 사용자별 RLS를 그대로 사용합니다.

Supabase에는 사용자 ID와 이메일 등의 계정 정보 및 인증 세션이 관리됩니다. 앱 비밀번호를 새로 만드는 절차가 없다는 뜻이며, 로그인 정보 전체를 전혀 보관하지 않는다는 뜻은 아닙니다. Google 로그인은 앱 사용자 인증용으로만 사용하고 브랜드 YouTube 계정 접근 권한을 부여받는 절차로 사용하지 않습니다.

Vercel 첫 배포, Supabase 프로젝트/초기 SQL, Vercel의 Supabase 환경변수는 사용자가 완료했다고 확인했습니다. 아래 Google 공급자 연결과 실제 로그인은 아직 완료 확인을 받지 않았습니다. 이미 설정한 항목은 값을 확인하고 필요한 부분만 수정합니다.

아래 `https://앱주소`는 실제 사용하는 Vercel 배포 도메인으로 바꿉니다. Google/Supabase의 두 콜백 주소는 서로 다릅니다.

| 설정 위치 | 등록할 주소 |
|---|---|
| Google OAuth 클라이언트의 Authorized JavaScript origins | `https://앱주소` |
| Google OAuth 클라이언트의 Authorized redirect URIs | Supabase Google 공급자 화면의 Callback URL. 일반적으로 `https://프로젝트ID.supabase.co/auth/v1/callback` |
| Supabase Auth의 Site URL | `https://앱주소` |
| Supabase Auth의 Redirect URLs | `https://앱주소/auth/callback` |

## 1. Google OAuth 클라이언트 만들기

Google Cloud 프로젝트에서 [Google Auth Platform](https://console.cloud.google.com/auth/overview)을 엽니다. Branding/Audience를 구성하고 Clients에서 **Web application** 유형의 OAuth 클라이언트를 만듭니다. 위 표의 앱 origin과 **Supabase 콜백**을 등록합니다. 테스트 모드로 사용하는 경우 Audience의 테스트 사용자에 사용할 Google 계정을 추가합니다. 데이터 권한은 로그인에 필요한 `openid`, 이메일, 프로필만 사용하며 YouTube/Gmail 권한은 추가하지 않습니다.

Google에 등록할 Supabase Callback URL은 공급자 화면에 표시된 실제 값을 복사합니다. 프로젝트 ID를 임의로 추측하거나 앱의 `/auth/callback`을 Google redirect URI에 대신 넣지 않습니다.

## 2. Supabase Google 공급자 켜기

Supabase 프로젝트의 **Authentication → Sign In / Providers → Google**에서 Google 로그인을 켭니다. 화면 명칭은 Dashboard 버전에 따라 Providers로 표시될 수 있습니다. Google에서 발급한 Client ID와 Client Secret을 이곳에 입력하고 저장합니다. Google Client Secret은 저장소·채팅·브라우저 코드에 넣지 않습니다. 앱 환경변수에도 필요하지 않습니다.

Google 계정을 처음 등록하려면 Supabase의 **Allow new users to sign up**도 허용되어 있어야 합니다. 앞서 이메일 가입을 막기 위해 이를 껐다면 Google 첫 로그인도 차단될 수 있습니다. 이메일·비밀번호 로그인을 사용하지 않을 경우 Email 공급자는 별도로 비활성화할 수 있습니다. 허용할 Google 계정 범위는 Google Audience 설정과 함께 관리합니다. 앱 자체에 이메일 허용 목록이나 조직 권한은 추가하지 않았습니다.

Supabase의 Users 화면에서 비밀번호 계정을 수동 생성하거나 Invite user 메일을 발송하는 것은 현재 Google 로그인 준비 절차에 포함되지 않습니다. 기존에 만든 사용자나 데이터도 임의로 삭제하지 않습니다.

## 3. 실제 사이트 주소 등록

Supabase **Authentication → URL Configuration**에서 위 표대로 Site URL 및 Redirect URLs를 등록합니다. 운영 Site URL을 `http://localhost:3000`으로 두지 않습니다. 앱의 콜백은 정확히 `/auth/callback`이며 쿼리 없이 고정됩니다. 로그인 후 원래 화면은 별도의 10분짜리 HttpOnly 쿠키로 기억합니다.

Vercel에는 기존 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 유지합니다. 고정 운영 도메인을 지정하려면 선택 환경변수 `APP_URL=https://앱주소`를 설정합니다. 비워 두면 로그인 요청 주소를 사용하고, 요청 주소가 없으면 Vercel 배포 주소를 사용합니다. 운영에서 임의로 localhost로 돌아가지 않습니다. `APP_URL`을 지정했다면 그 도메인에서 로그인해야 PKCE 쿠키와 콜백 도메인이 일치합니다.

`APP_URL`에는 `https://your-app.vercel.app`처럼 origin만 넣고 `/auth/callback`, 다른 경로, 쿼리, 로그인 자격 증명을 붙이지 않습니다. Preview와 Production 도메인이 다르면 각각 실제 로그인할 도메인의 콜백을 허용하고, 고정 `APP_URL`과 접속 도메인을 일치시킵니다. 환경변수 변경이 반영된 배포인지도 확인합니다.

로컬 테스트를 할 경우에만 `http://localhost:3000/auth/callback`을 추가로 허용합니다. 로컬 설정값을 운영 환경에 덮어쓰지 않습니다.

## 4. 확인

새 코드를 반영한 사이트의 `/login`에서 **Google 계정으로 계속하기**를 누릅니다. Google 계정을 선택한 후 앱으로 돌아오면 `/settings`에서 로그인과 DB 조회 성공을 확인합니다. 로그아웃·재로그인과 다른 브라우저에서도 계정별 데이터 분리를 확인합니다. 코드 교환에는 같은 브라우저에 저장된 PKCE 쿠키가 필요하므로 콜백 주소만 복사해서 다른 브라우저에서 열면 실패합니다.

| 확인 항목 | 성공 기준 |
|---|---|
| 로그인 화면 | Google 버튼이 보이며 이메일·비밀번호 입력란이 없음 |
| Google 인증 | 계정 선택 후 현재 앱으로 돌아옴 |
| 사용자 세션 | 헤더에 로그인한 계정과 로그아웃 버튼이 표시됨 |
| DB 연결 | `/settings`의 사용자 세션 및 DB 연결에서 실제 조회 성공 표시 |
| 빈 데이터 | 아직 수집하지 않았다면 영상/채널 수 0개와 빈 라이브러리가 정상 |
| 계정 분리 | 계정을 바꾸어도 다른 계정 소유 영상이 보이지 않음 |
| 로그아웃 | 앱의 Supabase 세션이 종료되고 보호 화면 접근 시 로그인으로 이동 |

SQL 재실행은 필요 없습니다. 기존 Auth 사용자나 저장 데이터를 삭제하지 않습니다. 실제 프로젝트의 Google 로그인 성공과 공급자 설정은 로컬 모의 테스트로 검증할 수 없으므로 운영 환경에서 별도로 확인해야 합니다.

## 5. 증상별 확인 위치

| 증상 | 확인할 설정·동작 |
|---|---|
| 인증 후 localhost로 이동 | Supabase Site URL, 허용 콜백, `APP_URL`을 실제 도메인으로 확인. 기존 메일 초대 링크는 현재 Google 흐름에 사용하지 않음 |
| `redirect_uri_mismatch` | Google redirect URI가 Supabase 공급자 화면의 Callback URL과 정확히 같은지 확인 |
| 공급자가 활성화되지 않았다는 오류 | Supabase Google 공급자 활성화 및 Client ID/Secret 저장 여부 확인 |
| 신규 가입이 허용되지 않는다는 오류 | 첫 Google 등록이 필요한 경우 Supabase 신규 가입 허용 확인 |
| Google에서 계정 접근을 허용하지 않음 | Google 앱 Audience, 테스트 사용자 및 공개 상태 확인 |
| `/login?notice=oauth_failed` | 로그인 취소/만료, 같은 브라우저의 PKCE 쿠키, `APP_URL`과 접속 도메인, Supabase 허용 콜백 확인 후 버튼부터 다시 시작 |
| 로그인은 되지만 DB 조회 실패 | 초기 SQL 적용, 13개 카테고리 시드, 본인 데이터 RLS/권한 확인. 상태 확인을 위해 RLS를 끄거나 전체 SQL을 반복 실행하지 않음 |
| 라이브러리가 0개 | `/collect` 수집 실행 여부, 본인 계정, 제목/자막 필터, 영상 공개 상태와 갱신 기한 확인. [YouTube 연동 설정](YouTube연동설정.md) 참고 |

Google 인증 버튼은 로그인 시작 주소를 만들 수 있지만 공급자가 실제로 올바르게 설정되었음을 사전에 보장하지 않습니다. 설정 화면의 `설정됨 · 연결 미검증`도 환경변수 상태 표시이며, 별도의 로그인 후 DB 조회 성공 표시와 구분합니다.

구현·설정 근거: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [리다이렉트 URL](https://supabase.com/docs/guides/auth/redirect-urls), [SSR 클라이언트](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
